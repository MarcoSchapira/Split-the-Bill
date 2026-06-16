import type { PrismaTransaction } from "../db/userContext";
import { safeUserSelect } from "../auth/auth.types";
import { ApiError } from "../http/errors";
import { requireGroupMember } from "../groups/group.authorization";
import { createActivity } from "../activity/activity.service";
import { buildSharesFromInput } from "./bill-split";
import { toBillShareBalanceLike, userSummaryForBill } from "./bill-balance";
import { pairwiseSummaryForBill } from "./bill-pairwise";
import type { BillInput, BillListQuery } from "./bill.types";

export const billInclude = {
  payer: { select: safeUserSelect },
  creator: { select: safeUserSelect },
  group: { select: { id: true, name: true } },
  friendship: {
    select: {
      id: true,
      userA: { select: safeUserSelect },
      userB: { select: safeUserSelect },
    },
  },
  shares: {
    orderBy: { userId: "asc" as const },
    select: {
      id: true,
      shareCents: true,
      settledAt: true,
      user: { select: safeUserSelect },
    },
  },
} as const;

type TargetParticipants = {
  userIds: string[];
  friendshipId?: string;
  groupId?: string;
};

export function withPermissions<T extends { creatorId: string }>(bill: T, userId: string) {
  return {
    ...bill,
    canEdit: true,
    canDelete: true,
    canRetarget: bill.creatorId === userId,
  };
}

type BillWithShares = {
  payerId: string;
  creatorId: string;
  shares: Array<{
    id: string;
    shareCents: number;
    settledAt: Date | null;
    user: { id: string; email: string; name: string | null; createdAt: Date };
  }>;
};

export function presentBill<T extends BillWithShares>(
  bill: T,
  userId: string,
  friendUserId?: string,
) {
  const shareBalance = toBillShareBalanceLike(bill.shares);
  const presented = {
    ...withPermissions(bill, userId),
    userSummary: userSummaryForBill(
      { payerId: bill.payerId, shares: shareBalance },
      userId,
      friendUserId,
    ),
  };

  if (!friendUserId) {
    return presented;
  }

  const pairwise = pairwiseSummaryForBill(
    { payerId: bill.payerId, shares: shareBalance },
    userId,
    friendUserId,
  );

  return pairwise ? { ...presented, pairwise } : presented;
}

async function resolveTargetParticipants(
  tx: PrismaTransaction,
  actingUserId: string,
  targetType: "friendship" | "group",
  targetId: string,
): Promise<TargetParticipants> {
  if (targetType === "friendship") {
    const friendship = await tx.friendship.findUnique({ where: { id: targetId } });

    if (
      !friendship ||
      (friendship.userAId !== actingUserId && friendship.userBId !== actingUserId)
    ) {
      throw new ApiError(403, "FRIENDSHIP_ACCESS_FORBIDDEN", "You are not part of this friendship");
    }

    return {
      friendshipId: friendship.id,
      userIds: [friendship.userAId, friendship.userBId],
    };
  }

  await requireGroupMember(tx, actingUserId, targetId);
  const members = await tx.groupMember.findMany({
    where: { groupId: targetId },
    orderBy: { userId: "asc" },
    select: { userId: true },
  });

  return {
    groupId: targetId,
    userIds: members.map((member) => member.userId),
  };
}

function assertPayerIsParticipant(payerId: string, participantIds: string[]) {
  if (!participantIds.includes(payerId)) {
    throw new ApiError(400, "INVALID_PAYER", "Payer must be a participant in this bill's target");
  }
}

export async function findVisibleBill(tx: PrismaTransaction, userId: string, billId: string) {
  const bill = await tx.bill.findFirst({
    where: {
      id: billId,
      deletedAt: null,
      OR: [
        { friendship: { OR: [{ userAId: userId }, { userBId: userId }] } },
        { group: { members: { some: { userId } } } },
      ],
    },
    include: billInclude,
  });

  if (!bill) {
    throw new ApiError(404, "BILL_NOT_FOUND", "Bill not found");
  }

  return bill;
}

export async function createBill(tx: PrismaTransaction, actingUserId: string, input: BillInput) {
  const target = await resolveTargetParticipants(tx, actingUserId, input.targetType, input.targetId);
  assertPayerIsParticipant(input.payerId, target.userIds);
  const shares = buildSharesFromInput(input.totalCents, target.userIds, input.shares);
  const recipientIds = shares.map((share) => share.userId);

  const bill = await tx.bill.create({
    data: {
      description: input.description,
      incurredAt: input.incurredAt,
      totalCents: input.totalCents,
      targetType: input.targetType,
      source: input.source,
      payerId: input.payerId,
      creatorId: actingUserId,
      ...(target.friendshipId ? { friendshipId: target.friendshipId } : {}),
      ...(target.groupId ? { groupId: target.groupId } : {}),
      shares: { create: shares },
    },
    include: billInclude,
  });
  await createActivity(tx, {
    actorId: actingUserId,
    recipientIds,
    billId: bill.id,
    type: "BILL_CREATED",
    message: `added the bill "${input.description}".`,
  });
  return presentBill(bill, actingUserId);
}

export async function listBills(
  tx: PrismaTransaction,
  userId: string,
  query: BillListQuery = {},
) {
  let whereTarget = {};

  if (query.targetType && query.targetId) {
    await resolveTargetParticipants(tx, userId, query.targetType, query.targetId);
    whereTarget =
      query.targetType === "friendship"
        ? { friendshipId: query.targetId }
        : { groupId: query.targetId };
  }

  const bills = await tx.bill.findMany({
    where: {
      deletedAt: null,
      ...whereTarget,
      OR: [
        { friendship: { OR: [{ userAId: userId }, { userBId: userId }] } },
        { group: { members: { some: { userId } } } },
      ],
    },
    orderBy: [{ incurredAt: "desc" }, { createdAt: "desc" }],
    include: billInclude,
  });

  return bills.map((bill) => presentBill(bill, userId));
}

export async function updateBill(
  tx: PrismaTransaction,
  actingUserId: string,
  billId: string,
  input: BillInput,
) {
  const bill = await findVisibleBill(tx, actingUserId, billId);
  const currentTargetId = bill.targetType === "friendship" ? bill.friendshipId : bill.groupId;
  const targetChanged =
    input.targetType !== bill.targetType || input.targetId !== currentTargetId;

  if (targetChanged && bill.creatorId !== actingUserId) {
    throw new ApiError(403, "BILL_RETARGET_FORBIDDEN", "Only the bill creator can change its target");
  }

  const resolvedTarget = await resolveTargetParticipants(
    tx,
    actingUserId,
    input.targetType,
    input.targetId,
  );
  assertPayerIsParticipant(input.payerId, resolvedTarget.userIds);
  const shares = buildSharesFromInput(
    input.totalCents,
    resolvedTarget.userIds,
    input.shares,
  );
  const recipientIds = [
    ...new Set([...bill.shares.map((share) => share.user.id), ...shares.map((share) => share.userId)]),
  ];

  await tx.billShare.deleteMany({ where: { billId } });
  const settledByUserId = new Map(
    bill.shares.map((share) => [share.user.id, share.settledAt] as const),
  );
  const updated = await tx.bill.update({
    where: { id: billId },
    data: {
      description: input.description,
      incurredAt: input.incurredAt,
      totalCents: input.totalCents,
      targetType: input.targetType,
      payerId: input.payerId,
      friendshipId: resolvedTarget.friendshipId ?? null,
      groupId: resolvedTarget.groupId ?? null,
      shares: {
        create: shares.map((share) => ({
          userId: share.userId,
          shareCents: share.shareCents,
          ...(settledByUserId.get(share.userId)
            ? { settledAt: settledByUserId.get(share.userId) }
            : {}),
        })),
      },
    },
    include: billInclude,
  });
  await createActivity(tx, {
    actorId: actingUserId,
    recipientIds,
    billId,
    type: "BILL_UPDATED",
    message: `updated the bill "${input.description}".`,
  });
  return presentBill(updated, actingUserId);
}

export async function deleteBill(tx: PrismaTransaction, actingUserId: string, billId: string) {
  const bill = await findVisibleBill(tx, actingUserId, billId);

  await tx.bill.update({ where: { id: billId }, data: { deletedAt: new Date() } });
  await createActivity(tx, {
    actorId: actingUserId,
    recipientIds: bill.shares.map((share) => share.user.id),
    billId,
    type: "BILL_DELETED",
    message: `deleted the bill "${bill.description}".`,
  });
}
