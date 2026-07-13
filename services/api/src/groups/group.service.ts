import type { PrismaTransaction } from "../db/userContext";
import { safeUserSelect } from "../auth/auth.types";
import { billInclude, presentBill } from "../bills/bill.service";
import { ApiError } from "../http/errors";
import { createActivity } from "../activity/activity.service";
import {
  countGroupBills,
  countUnsettledGroupBills,
  memberHasUnsettledGroupBillShares,
  syncMemberToUnsettledGroupBills,
} from "./group-bill-sync";
import { assertGroupMember, getGroupMemberIds } from "./group-access";
import type {
  AddGroupMemberInput,
  CreateGroupInput,
  MembershipChangeInput,
  UpdateGroupInput,
} from "./group.types";

const groupMemberInclude = {
  user: { select: safeUserSelect },
} as const;

const groupInclude = {
  creator: { select: safeUserSelect },
  members: {
    orderBy: { joinedAt: "asc" as const },
    include: groupMemberInclude,
  },
} as const;

async function assertGroupMemberForService(
  tx: PrismaTransaction,
  groupId: string,
  userId: string,
) {
  await assertGroupMember(tx, groupId, userId);
}

async function getGroupOrThrow(tx: PrismaTransaction, groupId: string, userId: string) {
  await assertGroupMemberForService(tx, groupId, userId);

  const group = await tx.group.findUnique({
    where: { id: groupId },
    include: groupInclude,
  });

  if (!group) {
    throw new ApiError(404, "GROUP_NOT_FOUND", "Group not found");
  }

  return group;
}

async function assertFriendship(
  tx: PrismaTransaction,
  actingUserId: string,
  friendUserId: string,
) {
  const friendship = await tx.friendship.findFirst({
    where: {
      OR: [
        { userAId: actingUserId, userBId: friendUserId },
        { userAId: friendUserId, userBId: actingUserId },
      ],
    },
    select: { id: true },
  });

  if (!friendship) {
    throw new ApiError(403, "PARTICIPANT_NOT_ALLOWED", "Added user must be your friend");
  }
}

function computeGroupNetBalanceCents(
  bills: Array<{
    payerId: string;
    totalCents: number;
    shares: Array<{
      userId: string;
      shareCents: number;
      payerMarkedAsPaid: boolean;
      lenderConfirmedPaid: boolean;
    }>;
  }>,
  userId: string,
) {
  let netBalanceCents = 0;

  for (const bill of bills) {
    if (bill.payerId === userId) {
      for (const share of bill.shares) {
        if (share.userId !== userId && !share.lenderConfirmedPaid) {
          netBalanceCents += share.shareCents;
        }
      }
      continue;
    }

    const ownShare = bill.shares.find((share) => share.userId === userId);
    if (ownShare && !ownShare.lenderConfirmedPaid) {
      netBalanceCents -= ownShare.shareCents;
    }
  }

  return netBalanceCents;
}

function presentGroupSummary(
  group: {
    id: string;
    name: string;
    iconKey: string;
    creatorId: string;
    createdAt: Date;
    updatedAt: Date;
    members: Array<{ user: { id: string; email: string; name: string | null; createdAt: Date } }>;
  },
  netBalanceCents: number,
) {
  return {
    id: group.id,
    name: group.name,
    iconKey: group.iconKey,
    creatorId: group.creatorId,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
    memberCount: group.members.length,
    memberPreview: group.members.slice(0, 4).map((member) => member.user),
    netBalanceCents,
  };
}

export async function listGroups(tx: PrismaTransaction, userId: string) {
  const memberships = await tx.groupMember.findMany({
    where: { userId },
    select: { groupId: true },
  });
  const groupIds = memberships.map((membership) => membership.groupId);

  if (groupIds.length === 0) {
    return [];
  }

  const groups = await tx.group.findMany({
    where: { id: { in: groupIds } },
    include: groupInclude,
    orderBy: { updatedAt: "desc" },
  });

  const bills = await tx.bill.findMany({
    where: {
      groupId: { in: groupIds },
      isSplitWithGroup: true,
      deletedAt: null,
    },
    select: {
      groupId: true,
      payerId: true,
      totalCents: true,
      shares: {
        select: {
          userId: true,
          shareCents: true,
          payerMarkedAsPaid: true,
          lenderConfirmedPaid: true,
        },
      },
    },
  });

  const billsByGroupId = new Map<string, typeof bills>();
  for (const bill of bills) {
    if (!bill.groupId) continue;
    const existing = billsByGroupId.get(bill.groupId) ?? [];
    existing.push(bill);
    billsByGroupId.set(bill.groupId, existing);
  }

  return groups.map((group) => {
    const groupBills = billsByGroupId.get(group.id) ?? [];
    const netBalanceCents = computeGroupNetBalanceCents(groupBills, userId);
    return presentGroupSummary(group, netBalanceCents);
  });
}

export async function createGroup(
  tx: PrismaTransaction,
  actingUserId: string,
  input: CreateGroupInput,
) {
  const group = await tx.group.create({
    data: {
      name: input.name,
      iconKey: input.iconKey,
      creatorId: actingUserId,
      members: {
        create: { userId: actingUserId },
      },
    },
    include: groupInclude,
  });

  await createActivity(tx, {
    actorId: actingUserId,
    recipientIds: [actingUserId],
    groupId: group.id,
    type: "GROUP_CREATED",
    message: `created the group "${group.name}".`,
  });

  return presentGroupSummary(group, 0);
}

export async function getGroup(tx: PrismaTransaction, userId: string, groupId: string) {
  const group = await getGroupOrThrow(tx, groupId, userId);
  const [bills, billCount, unsettledBillCount] = await Promise.all([
    tx.bill.findMany({
      where: {
        groupId,
        isSplitWithGroup: true,
        deletedAt: null,
      },
      orderBy: [{ incurredAt: "desc" }, { createdAt: "desc" }],
      include: billInclude,
    }),
    countGroupBills(tx, groupId),
    countUnsettledGroupBills(tx, groupId),
  ]);

  const groupBillsForBalance = bills.map((bill) => ({
    payerId: bill.payerId,
    totalCents: bill.totalCents,
    shares: bill.shares.map((share) => ({
      userId: share.user.id,
      shareCents: share.shareCents,
      payerMarkedAsPaid: share.payerMarkedAsPaid,
      lenderConfirmedPaid: share.lenderConfirmedPaid,
    })),
  }));

  const netBalanceCents = computeGroupNetBalanceCents(groupBillsForBalance, userId);
  const totalGroupSpendCents = bills.reduce((sum, bill) => sum + bill.totalCents, 0);

  return {
    id: group.id,
    name: group.name,
    iconKey: group.iconKey,
    creatorId: group.creatorId,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
    creator: group.creator,
    members: group.members.map((member) => ({
      id: member.id,
      joinedAt: member.joinedAt,
      user: member.user,
      isCreator: member.user.id === group.creatorId,
    })),
    bills: bills.map((bill) => presentBill(bill, userId)),
    billCount,
    hasExistingBills: billCount > 0,
    unsettledBillCount,
    netBalanceCents,
    totalGroupSpendCents,
  };
}

export async function updateGroup(
  tx: PrismaTransaction,
  actingUserId: string,
  groupId: string,
  input: UpdateGroupInput,
) {
  await assertGroupMemberForService(tx, groupId, actingUserId);

  const group = await tx.group.update({
    where: { id: groupId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.iconKey !== undefined ? { iconKey: input.iconKey } : {}),
    },
    include: groupInclude,
  });

  const memberIds = group.members.map((member) => member.user.id);
  await createActivity(tx, {
    actorId: actingUserId,
    recipientIds: memberIds,
    groupId: group.id,
    type: "GROUP_UPDATED",
    message: `updated the group "${group.name}".`,
  });

  const bills = await tx.bill.findMany({
    where: { groupId, isSplitWithGroup: true, deletedAt: null },
    select: {
      payerId: true,
      totalCents: true,
      shares: {
        select: {
          userId: true,
          shareCents: true,
          payerMarkedAsPaid: true,
          lenderConfirmedPaid: true,
        },
      },
    },
  });

  return presentGroupSummary(group, computeGroupNetBalanceCents(bills, actingUserId));
}

export async function deleteGroup(tx: PrismaTransaction, actingUserId: string, groupId: string) {
  const group = await tx.group.findUnique({
    where: { id: groupId },
    include: { members: { select: { userId: true } } },
  });

  if (!group) {
    throw new ApiError(404, "GROUP_NOT_FOUND", "Group not found");
  }

  if (group.creatorId !== actingUserId) {
    throw new ApiError(403, "GROUP_FORBIDDEN", "Only the group creator can delete the group");
  }

  const activeBillCount = await countGroupBills(tx, groupId);
  if (activeBillCount > 0) {
    throw new ApiError(
      409,
      "GROUP_HAS_BILLS",
      "Cannot delete a group that still has bills. Remove or reassign bills first.",
    );
  }

  const memberIds = group.members.map((member) => member.userId);
  await createActivity(tx, {
    actorId: actingUserId,
    recipientIds: memberIds,
    groupId: group.id,
    type: "GROUP_DELETED",
    message: `deleted the group "${group.name}".`,
  });

  await tx.group.delete({ where: { id: groupId } });
}

export async function addGroupMember(
  tx: PrismaTransaction,
  actingUserId: string,
  groupId: string,
  input: AddGroupMemberInput,
) {
  const group = await getGroupOrThrow(tx, groupId, actingUserId);

  if (input.userId === actingUserId) {
    throw new ApiError(400, "INVALID_MEMBER", "You are already in this group");
  }

  if (group.members.some((member) => member.user.id === input.userId)) {
    throw new ApiError(409, "MEMBER_EXISTS", "User is already a member of this group");
  }

  await assertFriendship(tx, actingUserId, input.userId);

  await tx.groupMember.create({
    data: {
      groupId,
      userId: input.userId,
    },
  });

  const memberIds = [...group.members.map((member) => member.user.id), input.userId];

  if (input.retroactiveScope === "unsettled_bills") {
    await syncMemberToUnsettledGroupBills(tx, groupId, memberIds, actingUserId);
  }

  await createActivity(tx, {
    actorId: actingUserId,
    recipientIds: memberIds,
    groupId,
    type: "GROUP_MEMBER_ADDED",
    message: `added a member to "${group.name}".`,
  });

  return getGroup(tx, actingUserId, groupId);
}

async function removeMemberFromGroup(
  tx: PrismaTransaction,
  actingUserId: string,
  groupId: string,
  memberUserId: string,
  retroactiveScope: "new_only" | "unsettled_bills",
) {
  const group = await tx.group.findUnique({
    where: { id: groupId },
    include: groupInclude,
  });

  if (!group) {
    throw new ApiError(404, "GROUP_NOT_FOUND", "Group not found");
  }

  const membership = group.members.find((member) => member.user.id === memberUserId);
  if (!membership) {
    throw new ApiError(404, "MEMBER_NOT_FOUND", "Member not found in this group");
  }

  await tx.groupMember.delete({ where: { id: membership.id } });

  const remainingMemberIds = group.members
    .filter((member) => member.user.id !== memberUserId)
    .map((member) => member.user.id);

  if (retroactiveScope === "unsettled_bills") {
    await syncMemberToUnsettledGroupBills(tx, groupId, remainingMemberIds, actingUserId);
  }

  if (remainingMemberIds.length === 0) {
    await tx.group.delete({ where: { id: groupId } });
    return null;
  }

  await createActivity(tx, {
    actorId: actingUserId,
    recipientIds: [...remainingMemberIds, memberUserId],
    groupId,
    type: "GROUP_MEMBER_REMOVED",
    message: `removed a member from "${group.name}".`,
  });

  return getGroup(tx, actingUserId, groupId);
}

export async function removeGroupMember(
  tx: PrismaTransaction,
  actingUserId: string,
  groupId: string,
  memberUserId: string,
  input: MembershipChangeInput,
) {
  const group = await tx.group.findUnique({
    where: { id: groupId },
    select: { creatorId: true },
  });

  if (!group) {
    throw new ApiError(404, "GROUP_NOT_FOUND", "Group not found");
  }

  await assertGroupMemberForService(tx, groupId, actingUserId);

  if (group.creatorId !== actingUserId) {
    throw new ApiError(403, "GROUP_FORBIDDEN", "Only the group creator can remove members");
  }

  if (memberUserId === actingUserId) {
    throw new ApiError(400, "INVALID_MEMBER", "Use leave to remove yourself from the group");
  }

  return removeMemberFromGroup(tx, actingUserId, groupId, memberUserId, input.retroactiveScope);
}

export async function leaveGroup(
  tx: PrismaTransaction,
  actingUserId: string,
  groupId: string,
  input: MembershipChangeInput,
) {
  await assertGroupMemberForService(tx, groupId, actingUserId);

  const hasUnsettledShares = await memberHasUnsettledGroupBillShares(
    tx,
    groupId,
    actingUserId,
  );

  if (hasUnsettledShares && input.retroactiveScope === "new_only") {
    // no-op for existing bills; member simply won't be on new group bills
  }

  return removeMemberFromGroup(tx, actingUserId, groupId, actingUserId, input.retroactiveScope);
}

export { getGroupMemberIds, assertGroupMember as assertActingUserInGroup } from "./group-access";
