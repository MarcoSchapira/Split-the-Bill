import type { Prisma } from "../generated/prisma/client";
import type { PrismaTransaction } from "../db/userContext";
import { prismaAdmin } from "../db/prisma";
import { safeUserSelect } from "../auth/auth.types";
import { ApiError } from "../http/errors";

type ActivityInput = {
  type: string;
  message: string;
  actorId: string;
  recipientIds: string[];
  billId?: string;
  friendInvitationId?: string;
  groupId?: string;
};

type ActivityBillLike = {
  id: string;
  description: string;
  incurredAt: Date;
  totalCents: number;
};

const BILL_ACTIVITY_TYPES = new Set([
  "BILL_CREATED",
  "BILL_UPDATED",
  "BILL_SETTLED",
  "BILL_UNSETTLED",
  "BILL_DELETED",
]);

const INVITATION_ACTIVITY_MESSAGES: Record<string, string> = {
  FRIEND_INVITATION_SENT: "sent a friend invitation.",
  FRIEND_INVITATION_ACCEPTED: "accepted a friend invitation.",
  FRIEND_INVITATION_DECLINED: "declined a friend invitation.",
  FRIEND_SETTLED: "settled up all outstanding bills.",
  FRIEND_REMOVED: "removed you as a friend.",
};

function friendshipUsers(firstUserId: string, secondUserId: string) {
  return firstUserId < secondUserId
    ? { userAId: firstUserId, userBId: secondUserId }
    : { userAId: secondUserId, userBId: firstUserId };
}

function formatBillLabel(bill: ActivityBillLike): string {
  const date = bill.incurredAt.toISOString().slice(0, 10);
  const amount = (bill.totalCents / 100).toFixed(2);
  return `"${bill.description}" on ${date} ($${amount})`;
}

export function formatActivityMessage(
  type: string,
  bill: ActivityBillLike | null,
  fallbackMessage: string,
): string {
  if (bill && BILL_ACTIVITY_TYPES.has(type)) {
    const label = formatBillLabel(bill);
    switch (type) {
      case "BILL_CREATED":
        return `added the bill ${label}.`;
      case "BILL_UPDATED":
        return `updated the bill ${label}.`;
      case "BILL_SETTLED":
        return `settled up on the bill ${label}.`;
      case "BILL_UNSETTLED":
        return `undid settlement on the bill ${label}.`;
      case "BILL_DELETED":
        return `deleted the bill ${label}.`;
      default:
        break;
    }
  }

  return INVITATION_ACTIVITY_MESSAGES[type] ?? fallbackMessage;
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
      ...(input.groupId ? { groupId: input.groupId } : {}),
      recipients: {
        create: recipientIds.map((userId) => ({ userId })),
      },
    },
  });
}

function presentActivityBill(bill: ActivityBillLike | null) {
  if (!bill) {
    return null;
  }

  return {
    id: bill.id,
    description: bill.description,
    incurredAt: bill.incurredAt,
    totalCents: bill.totalCents,
  };
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
      groupId: true,
      actorId: true,
      bill: {
        select: {
          id: true,
          description: true,
          incurredAt: true,
          totalCents: true,
        },
      },
      recipients: {
        select: { userId: true },
      },
    },
  });

  // Actors may not be visible under users RLS (pending invites, removed friends,
  // former group members). Load them with the admin client, matching invitations.
  const actorIds = [...new Set(events.map((event) => event.actorId))];
  const actors =
    actorIds.length === 0
      ? []
      : await prismaAdmin.user.findMany({
          where: { id: { in: actorIds } },
          select: safeUserSelect,
        });
  const actorsById = new Map(actors.map((actor) => [actor.id, actor]));

  return Promise.all(
    events.map(async (event) => {
      const actor = actorsById.get(event.actorId);
      if (!actor) {
        return null;
      }

      let friendshipId: string | null = null;

      if (event.type === "FRIEND_SETTLED") {
        // A recipient can only read their own ActivityRecipient row under RLS.
        // The actor is therefore the reliable counterpart for recipients; the
        // actor can inspect recipient rows to find the other person.
        const otherUserId =
          event.actorId !== userId
            ? event.actorId
            : event.recipients.find((recipient) => recipient.userId !== userId)
                ?.userId;
        if (otherUserId) {
          const friendship = await tx.friendship.findUnique({
            where: { userAId_userBId: friendshipUsers(userId, otherUserId) },
            select: { id: true },
          });
          friendshipId = friendship?.id ?? null;
        }
      }

      const bill = event.bill;

      return {
        id: event.id,
        type: event.type,
        message: formatActivityMessage(event.type, bill, event.message),
        createdAt: event.createdAt,
        billId: event.billId,
        friendInvitationId: event.friendInvitationId,
        friendshipId,
        groupId: event.groupId,
        bill: presentActivityBill(bill),
        actor,
      };
    }),
  ).then((rows) => rows.filter((row) => row !== null));
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
