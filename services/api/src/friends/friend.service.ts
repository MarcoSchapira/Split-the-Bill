import type { PrismaTransaction } from "../db/userContext";
import { createActivity } from "../activity/activity.service";
import { safeUserSelect } from "../auth/auth.types";
import { billInclude, presentBill } from "../bills/bill.service";
import { billsSharedBetween } from "../bills/participants";
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
  const bills = (
    await tx.bill.findMany({
      where: billsSharedBetween(userId, friendUserId),
      orderBy: [{ incurredAt: "desc" }, { createdAt: "desc" }],
      include: billInclude,
    })
  ).map((bill) => presentBill(bill, userId, friendUserId));

  return {
    id: friendship.id,
    createdAt: friendship.createdAt,
    friend: friendForUser(friendship, userId),
    bills,
  };
}

export async function removeFriend(
  tx: PrismaTransaction,
  userId: string,
  friendshipId: string,
) {
  const friendship = await tx.friendship.findFirst({
    where: {
      id: friendshipId,
      OR: [{ userAId: userId }, { userBId: userId }],
    },
    select: { id: true, userAId: true, userBId: true },
  });

  if (!friendship) {
    throw new ApiError(404, "FRIENDSHIP_NOT_FOUND", "Friendship not found");
  }

  const friendUserId =
    friendship.userAId === userId ? friendship.userBId : friendship.userAId;

  await createActivity(tx, {
    actorId: userId,
    recipientIds: [friendUserId],
    type: "FRIEND_REMOVED",
    message: "removed you as a friend.",
  });

  await tx.friendship.delete({ where: { id: friendship.id } });
}
