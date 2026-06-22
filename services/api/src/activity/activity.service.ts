import type { Prisma } from "../generated/prisma/client";
import type { PrismaTransaction } from "../db/userContext";
import { safeUserSelect } from "../auth/auth.types";
import { ApiError } from "../http/errors";

type ActivityInput = {
  type: string;
  message: string;
  actorId: string;
  recipientIds: string[];
  billId?: string;
  friendInvitationId?: string;
};

function friendshipUsers(firstUserId: string, secondUserId: string) {
  return firstUserId < secondUserId
    ? { userAId: firstUserId, userBId: secondUserId }
    : { userAId: secondUserId, userBId: firstUserId };
}

export async function createActivity(
  tx: Prisma.TransactionClient,
  input: ActivityInput,
) {
  const recipientIds = [...new Set([input.actorId, ...input.recipientIds])];

  return tx.activityEvent.create({
    data: {
      type: input.type,
      message: input.message,
      actorId: input.actorId,
      ...(input.billId ? { billId: input.billId } : {}),
      ...(input.friendInvitationId
        ? { friendInvitationId: input.friendInvitationId }
        : {}),
      recipients: {
        create: recipientIds.map((userId) => ({ userId })),
      },
    },
  });
}

export async function listActivity(tx: PrismaTransaction, userId: string) {
  const events = await tx.activityEvent.findMany({
    where: {
      recipients: {
        some: { userId },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      type: true,
      message: true,
      createdAt: true,
      billId: true,
      friendInvitationId: true,
      actor: { select: safeUserSelect },
      recipients: {
        select: { userId: true },
      },
    },
  });

  return Promise.all(
    events.map(async (event) => {
      let friendshipId: string | null = null;

      if (event.type === "FRIEND_SETTLED") {
        const otherUserId = event.recipients.find((recipient) => recipient.userId !== userId)?.userId;
        if (otherUserId) {
          const friendship = await tx.friendship.findUnique({
            where: { userAId_userBId: friendshipUsers(userId, otherUserId) },
            select: { id: true },
          });
          friendshipId = friendship?.id ?? null;
        }
      }

      return {
        id: event.id,
        type: event.type,
        message: event.message,
        createdAt: event.createdAt,
        billId: event.billId,
        friendInvitationId: event.friendInvitationId,
        friendshipId,
        actor: event.actor,
      };
    }),
  );
}

export async function dismissActivity(
  tx: PrismaTransaction,
  userId: string,
  eventId: string,
) {
  const result = await tx.activityRecipient.deleteMany({
    where: { eventId, userId },
  });

  if (result.count === 0) {
    throw new ApiError(404, "ACTIVITY_NOT_FOUND", "Activity not found");
  }
}
