import type { PrismaTransaction } from "../db/userContext";
import { safeUserSelect } from "../auth/auth.types";
import { pairwiseSummaryForBill, type PairwiseSummary } from "../bills/bill-pairwise";
import { billInclude, listBills, withPermissions } from "../bills/bill.service";
import { ApiError } from "../http/errors";

function friendForUser<T extends { userA: unknown; userB: unknown; userAId: string }>(
  friendship: T,
  userId: string,
) {
  return friendship.userAId === userId ? friendship.userB : friendship.userA;
}

const friendshipInclude = {
  userA: { select: safeUserSelect },
  userB: { select: safeUserSelect },
} as const;

export async function listFriends(tx: PrismaTransaction, userId: string) {
  const friendships = await tx.friendship.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
    orderBy: { createdAt: "desc" },
    include: friendshipInclude,
  });

  return friendships.map((friendship) => ({
    id: friendship.id,
    createdAt: friendship.createdAt,
    friend: friendForUser(friendship, userId),
  }));
}

export async function getFriend(tx: PrismaTransaction, userId: string, friendshipId: string) {
  const friendship = await tx.friendship.findFirst({
    where: {
      id: friendshipId,
      OR: [{ userAId: userId }, { userBId: userId }],
    },
    include: friendshipInclude,
  });

  if (!friendship) {
    throw new ApiError(404, "FRIENDSHIP_NOT_FOUND", "Friendship not found");
  }

  const friendUserId =
    friendship.userAId === userId ? friendship.userBId : friendship.userAId;
  const bills = await listBills(tx, userId, { targetType: "friendship", targetId: friendshipId });

  const sharedMemberships = await tx.groupMember.findMany({
    where: {
      userId,
      group: { members: { some: { userId: friendUserId } } },
    },
    orderBy: { group: { name: "asc" } },
    select: {
      group: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  const sharedGroupIds = sharedMemberships.map((membership) => membership.group.id);
  type SharedGroupBill = Awaited<ReturnType<typeof listBills>>[number] & {
    pairwise: PairwiseSummary;
  };
  const billsByGroupId = new Map<string, SharedGroupBill[]>();

  for (const membership of sharedMemberships) {
    billsByGroupId.set(membership.group.id, []);
  }

  if (sharedGroupIds.length > 0) {
    const groupBills = await tx.bill.findMany({
      where: {
        deletedAt: null,
        groupId: { in: sharedGroupIds },
        group: { members: { some: { userId } } },
      },
      orderBy: [{ incurredAt: "desc" }, { createdAt: "desc" }],
      include: billInclude,
    });

    for (const bill of groupBills) {
      if (!bill.groupId) {
        continue;
      }

      const pairwise = pairwiseSummaryForBill(
        {
          payerId: bill.payerId,
          shares: bill.shares.map((share) => ({
            userId: share.user.id,
            shareCents: share.shareCents,
          })),
        },
        userId,
        friendUserId,
      );

      if (!pairwise) {
        continue;
      }

      const groupBillsForFriend = billsByGroupId.get(bill.groupId) ?? [];
      groupBillsForFriend.push({
        ...withPermissions(bill, userId),
        pairwise,
      });
      billsByGroupId.set(bill.groupId, groupBillsForFriend);
    }
  }

  const sharedGroups = sharedMemberships.map((membership) => ({
    id: membership.group.id,
    name: membership.group.name,
    bills: billsByGroupId.get(membership.group.id) ?? [],
  }));

  return {
    id: friendship.id,
    createdAt: friendship.createdAt,
    friend: friendForUser(friendship, userId),
    bills,
    sharedGroups,
  };
}
