import { prisma } from "../db/prisma";
import { safeUserSelect } from "../auth/auth.types";
import { ApiError } from "../http/errors";
import { listBills } from "../bills/bill.service";

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

export async function listFriends(userId: string) {
  const friendships = await prisma.friendship.findMany({
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

export async function getFriend(userId: string, friendshipId: string) {
  const friendship = await prisma.friendship.findFirst({
    where: {
      id: friendshipId,
      OR: [{ userAId: userId }, { userBId: userId }],
    },
    include: friendshipInclude,
  });

  if (!friendship) {
    throw new ApiError(404, "FRIENDSHIP_NOT_FOUND", "Friendship not found");
  }

  const bills = await listBills(userId, { targetType: "friendship", targetId: friendshipId });

  return {
    id: friendship.id,
    createdAt: friendship.createdAt,
    friend: friendForUser(friendship, userId),
    bills,
  };
}
