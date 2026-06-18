import type { PrismaTransaction } from "../db/userContext";
import { safeUserSelect } from "../auth/auth.types";
import { ApiError } from "../http/errors";
import { createActivity } from "../activity/activity.service";
import { buildSharesFromInput } from "./bill-split";
import { toBillShareBalanceLike, userSummaryForBill } from "./bill-balance";
import { pairwiseSummaryForBill } from "./bill-pairwise";
import type { BillInput, BillListQuery } from "./bill.types";
import { assertParticipantsAllowed, sortedParticipantKey } from "./participants";

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
  lineItems: {
    orderBy: { sortOrder: "asc" as const },
    select: {
      id: true,
      name: true,
      quantity: true,
      unitPriceCents: true,
      totalPriceCents: true,
      sortOrder: true,
      assignments: {
        orderBy: { userId: "asc" as const },
        select: {
          id: true,
          user: { select: safeUserSelect },
        },
      },
    },
  },
} as const;

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

function assertPayerIsParticipant(payerId: string, participantIds: string[]) {
  if (!participantIds.includes(payerId)) {
    throw new ApiError(400, "INVALID_PAYER", "Payer must be a participant in this bill");
  }
}

async function resolveLegacyTargetParticipants(
  tx: PrismaTransaction,
  actingUserId: string,
  targetType: "friendship" | "group",
  targetId: string,
) {
  if (targetType === "friendship") {
    const friendship = await tx.friendship.findUnique({ where: { id: targetId } });
    if (
      !friendship ||
      (friendship.userAId !== actingUserId && friendship.userBId !== actingUserId)
    ) {
      throw new ApiError(403, "FRIENDSHIP_ACCESS_FORBIDDEN", "You are not part of this friendship");
    }
    return [friendship.userAId, friendship.userBId];
  }

  const memberRows = await tx.groupMember.findMany({
    where: { groupId: targetId },
    select: { userId: true },
  });
  if (!memberRows.some((row) => row.userId === actingUserId)) {
    throw new ApiError(403, "GROUP_ACCESS_FORBIDDEN", "You are not a member of this group");
  }
  return memberRows.map((row) => row.userId);
}

async function determineBillContext(
  tx: PrismaTransaction,
  actingUserId: string,
  input: BillInput,
) {
  if (input.participantIds && input.participantIds.length > 0) {
    return {
      participantIds: sortedParticipantKey(input.participantIds),
      targetType: null as "friendship" | "group" | null,
      targetId: null as string | null,
    };
  }

  if (input.targetType && input.targetId) {
    return {
      participantIds: sortedParticipantKey(
        await resolveLegacyTargetParticipants(tx, actingUserId, input.targetType, input.targetId),
      ),
      targetType: input.targetType,
      targetId: input.targetId,
    };
  }

  throw new ApiError(
    400,
    "INVALID_PARTICIPANTS",
    "Either participantIds or targetType/targetId must be supplied",
  );
}

function normalizeLineItems(input: BillInput, participantIds: string[]) {
  const allowedParticipantIds = new Set(participantIds);

  return input.lineItems.map((item, index) => {
    const assignedUserIds = sortedParticipantKey(item.assignedUserIds);

    if (assignedUserIds.length === 0) {
      throw new ApiError(400, "INVALID_LINE_ITEM_ASSIGNMENTS", "Each item must have assignees");
    }

    for (const assignedUserId of assignedUserIds) {
      if (!allowedParticipantIds.has(assignedUserId)) {
        throw new ApiError(
          400,
          "INVALID_LINE_ITEM_ASSIGNMENTS",
          "Line-item assignees must be bill participants",
        );
      }
    }

    return {
      name: item.name,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      totalPriceCents: item.totalPriceCents,
      sortOrder: index,
      assignments: {
        create: assignedUserIds.map((userId) => ({ userId })),
      },
    };
  });
}

export async function findVisibleBill(tx: PrismaTransaction, userId: string, billId: string) {
  const bill = await tx.bill.findFirst({
    where: {
      id: billId,
      deletedAt: null,
      shares: { some: { userId } },
    },
    include: billInclude,
  });

  if (!bill) {
    throw new ApiError(404, "BILL_NOT_FOUND", "Bill not found");
  }

  return bill;
}

export async function createBill(tx: PrismaTransaction, actingUserId: string, input: BillInput) {
  const billContext = await determineBillContext(tx, actingUserId, input);
  const participantIds = billContext.participantIds;
  await assertParticipantsAllowed(tx, actingUserId, participantIds);
  assertPayerIsParticipant(input.payerId, participantIds);
  const shares = buildSharesFromInput(input.totalCents, participantIds, input.shares);
  const recipientIds = shares.map((share) => share.userId);
  const lineItems = normalizeLineItems(input, participantIds);

  const bill = await tx.bill.create({
    data: {
      description: input.description,
      incurredAt: input.incurredAt,
      totalCents: input.totalCents,
      source: input.source,
      storeName: input.storeName,
      storeAddress: input.storeAddress,
      receiptNumber: input.receiptNumber,
      receiptDate: input.receiptDate,
      receiptTime: input.receiptTime,
      paymentMethod: input.paymentMethod,
      cardLast4: input.cardLast4,
      itemCount: input.itemCount,
      subtotalCents: input.subtotalCents,
      taxCents: input.taxCents,
      tipCents: input.tipCents,
      targetType: billContext.targetType,
      friendshipId:
        billContext.targetType === "friendship" ? billContext.targetId : null,
      groupId: billContext.targetType === "group" ? billContext.targetId : null,
      payerId: input.payerId,
      creatorId: actingUserId,
      shares: { create: shares },
      lineItems: { create: lineItems },
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
  const whereTarget =
    query.targetType && query.targetId
      ? query.targetType === "friendship"
        ? { friendshipId: query.targetId }
        : { groupId: query.targetId }
      : {};

  const whereParticipant = query.participantId
    ? { shares: { some: { userId: query.participantId } } }
    : {};

  const bills = await tx.bill.findMany({
    where: {
      deletedAt: null,
      ...whereTarget,
      ...whereParticipant,
      shares: { some: { userId } },
    },
    orderBy: [{ incurredAt: "desc" }, { createdAt: "desc" }],
    include: billInclude,
  });

  return bills.map((bill) => presentBill(bill, userId));
}

export async function getBill(tx: PrismaTransaction, userId: string, billId: string) {
  const bill = await findVisibleBill(tx, userId, billId);
  return presentBill(bill, userId);
}

export async function updateBill(
  tx: PrismaTransaction,
  actingUserId: string,
  billId: string,
  input: BillInput,
) {
  const bill = await findVisibleBill(tx, actingUserId, billId);
  const billContext = await determineBillContext(tx, actingUserId, input);
  const participantIds = billContext.participantIds;
  await assertParticipantsAllowed(tx, actingUserId, participantIds);
  assertPayerIsParticipant(input.payerId, participantIds);
  const shares = buildSharesFromInput(
    input.totalCents,
    participantIds,
    input.shares,
  );
  const lineItems = normalizeLineItems(input, participantIds);
  const recipientIds = [
    ...new Set([...bill.shares.map((share) => share.user.id), ...shares.map((share) => share.userId)]),
  ];

  const settledByUserId = new Map(
    bill.shares.map((share) => [share.user.id, share.settledAt] as const),
  );

  const updated = await tx.bill.update({
    where: { id: billId },
    data: {
      description: input.description,
      incurredAt: input.incurredAt,
      totalCents: input.totalCents,
      source: input.source,
      storeName: input.storeName,
      storeAddress: input.storeAddress,
      receiptNumber: input.receiptNumber,
      receiptDate: input.receiptDate,
      receiptTime: input.receiptTime,
      paymentMethod: input.paymentMethod,
      cardLast4: input.cardLast4,
      itemCount: input.itemCount,
      subtotalCents: input.subtotalCents,
      taxCents: input.taxCents,
      tipCents: input.tipCents,
      targetType: billContext.targetType,
      payerId: input.payerId,
      friendshipId:
        billContext.targetType === "friendship" ? billContext.targetId : null,
      groupId: billContext.targetType === "group" ? billContext.targetId : null,
      shares: {
        deleteMany: {},
        create: shares.map((share) => ({
          userId: share.userId,
          shareCents: share.shareCents,
          ...(settledByUserId.get(share.userId)
            ? { settledAt: settledByUserId.get(share.userId) }
            : {}),
        })),
      },
      lineItems: {
        deleteMany: {},
        create: lineItems,
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
