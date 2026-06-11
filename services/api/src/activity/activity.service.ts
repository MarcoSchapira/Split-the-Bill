import type { Prisma } from "../generated/prisma/client";
import type { PrismaTransaction } from "../db/userContext";
import { safeUserSelect } from "../auth/auth.types";

type ActivityInput = {
  type: string;
  message: string;
  actorId: string;
  recipientIds: string[];
  billId?: string;
  friendInvitationId?: string;
  groupInvitationId?: string;
};

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
      ...(input.groupInvitationId
        ? { groupInvitationId: input.groupInvitationId }
        : {}),
      recipients: {
        create: recipientIds.map((userId) => ({ userId })),
      },
    },
  });
}

export async function listActivity(tx: PrismaTransaction, userId: string) {
  return tx.activityEvent.findMany({
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
      actor: { select: safeUserSelect },
    },
  });
}
