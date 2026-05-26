import { prisma } from "../db/prisma";
import { safeUserSelect } from "../auth/auth.types";
import { ApiError } from "../http/errors";
import { requireGroupMember } from "../groups/group.authorization";
import { createActivity } from "../activity/activity.service";
import type { BillInput, BillListQuery } from "./bill.types";

const billInclude = {
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
      user: { select: safeUserSelect },
    },
  },
} as const;

type TargetParticipants = {
  userIds: string[];
  friendshipId?: string;
  groupId?: string;
};

function withPermissions<T extends { creatorId: string }>(bill: T, userId: string) {
  return {
    ...bill,
    canEdit: true,
    canDelete: true,
    canRetarget: bill.creatorId === userId,
  };
}

async function resolveTargetParticipants(
  actingUserId: string,
  targetType: "friendship" | "group",
  targetId: string,
): Promise<TargetParticipants> {
  if (targetType === "friendship") {
    const friendship = await prisma.friendship.findUnique({ where: { id: targetId } });

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

  await requireGroupMember(actingUserId, targetId);
  const members = await prisma.groupMember.findMany({
    where: { groupId: targetId },
    orderBy: { userId: "asc" },
    select: { userId: true },
  });

  return {
    groupId: targetId,
    userIds: members.map((member) => member.userId),
  };
}

function equalShares(totalCents: number, participantIds: string[], payerId: string) {
  if (!participantIds.includes(payerId)) {
    throw new ApiError(400, "INVALID_PAYER", "Payer must be a participant in the bill");
  }

  const uniqueParticipants = [...new Set(participantIds)].sort();
  const ordered = [payerId, ...uniqueParticipants.filter((id) => id !== payerId)];
  const baseShare = Math.floor(totalCents / ordered.length);
  const remainder = totalCents % ordered.length;

  return ordered.map((userId, index) => ({
    userId,
    shareCents: baseShare + (index < remainder ? 1 : 0),
  }));
}

async function findVisibleBill(userId: string, billId: string) {
  const bill = await prisma.bill.findFirst({
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

export async function createBill(actingUserId: string, input: BillInput) {
  const target = await resolveTargetParticipants(actingUserId, input.targetType, input.targetId);
  const shares = equalShares(input.totalCents, target.userIds, input.payerId);

  return prisma.$transaction(async (tx) => {
    const bill = await tx.bill.create({
      data: {
        description: input.description,
        incurredAt: input.incurredAt,
        totalCents: input.totalCents,
        targetType: input.targetType,
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
      recipientIds: target.userIds,
      billId: bill.id,
      type: "BILL_CREATED",
      message: `added the bill "${input.description}".`,
    });
    return withPermissions(bill, actingUserId);
  });
}

export async function listBills(userId: string, query: BillListQuery = {}) {
  let whereTarget = {};

  if (query.targetType && query.targetId) {
    await resolveTargetParticipants(userId, query.targetType, query.targetId);
    whereTarget =
      query.targetType === "friendship"
        ? { friendshipId: query.targetId }
        : { groupId: query.targetId };
  }

  const bills = await prisma.bill.findMany({
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

  return bills.map((bill) => withPermissions(bill, userId));
}

export async function updateBill(actingUserId: string, billId: string, input: BillInput) {
  const bill = await findVisibleBill(actingUserId, billId);
  const currentTargetId = bill.targetType === "friendship" ? bill.friendshipId : bill.groupId;
  const targetChanged =
    input.targetType !== bill.targetType || input.targetId !== currentTargetId;

  if (targetChanged && bill.creatorId !== actingUserId) {
    throw new ApiError(403, "BILL_RETARGET_FORBIDDEN", "Only the bill creator can change its target");
  }

  const target = targetChanged
    ? await resolveTargetParticipants(actingUserId, input.targetType, input.targetId)
    : {
        ...(bill.friendshipId ? { friendshipId: bill.friendshipId } : {}),
        ...(bill.groupId ? { groupId: bill.groupId } : {}),
        userIds: bill.shares.map((share) => share.user.id),
      };
  const shares = equalShares(input.totalCents, target.userIds, input.payerId);
  const recipients = [...new Set([...bill.shares.map((share) => share.user.id), ...target.userIds])];

  return prisma.$transaction(async (tx) => {
    await tx.billShare.deleteMany({ where: { billId } });
    const updated = await tx.bill.update({
      where: { id: billId },
      data: {
        description: input.description,
        incurredAt: input.incurredAt,
        totalCents: input.totalCents,
        targetType: input.targetType,
        payerId: input.payerId,
        friendshipId: target.friendshipId ?? null,
        groupId: target.groupId ?? null,
        shares: { create: shares },
      },
      include: billInclude,
    });
    await createActivity(tx, {
      actorId: actingUserId,
      recipientIds: recipients,
      billId,
      type: "BILL_UPDATED",
      message: `updated the bill "${input.description}".`,
    });
    return withPermissions(updated, actingUserId);
  });
}

export async function deleteBill(actingUserId: string, billId: string) {
  const bill = await findVisibleBill(actingUserId, billId);

  await prisma.$transaction(async (tx) => {
    await tx.bill.update({ where: { id: billId }, data: { deletedAt: new Date() } });
    await createActivity(tx, {
      actorId: actingUserId,
      recipientIds: bill.shares.map((share) => share.user.id),
      billId,
      type: "BILL_DELETED",
      message: `deleted the bill "${bill.description}".`,
    });
  });
}
