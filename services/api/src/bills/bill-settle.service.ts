import type { PrismaTransaction } from "../db/userContext";
import { ApiError } from "../http/errors";
import { createActivity } from "../activity/activity.service";
import { sharesToSettle, sharesToUnsettle } from "./bill-balance";
import {
  billInclude,
  findVisibleBill,
  presentBill,
} from "./bill.service";

export async function settleBill(
  tx: PrismaTransaction,
  actingUserId: string,
  billId: string,
  friendUserId?: string,
  participantUserId?: string,
) {
  const bill = await findVisibleBill(tx, actingUserId, billId);
  if (participantUserId && bill.payerId !== actingUserId) {
    throw new ApiError(
      403,
      "PARTICIPANT_SETTLE_FORBIDDEN",
      "Only the bill payer can confirm settlement for a participant",
    );
  }
  const shareIds = sharesToSettle(
    {
      payerId: bill.payerId,
      shares: bill.shares.map((share) => ({
        id: share.id,
        userId: share.user.id,
        shareCents: share.shareCents,
        settledAt: share.settledAt,
        settlementStatus: share.settlementStatus,
      })),
    },
    actingUserId,
    friendUserId,
    participantUserId,
  );

  if (shareIds.length === 0) {
    throw new ApiError(400, "NOTHING_TO_SETTLE", "Nothing to settle on this bill");
  }

  const settledAt = new Date();
  await tx.billShare.updateMany({
    where: { id: { in: shareIds } },
    data: { settledAt, settlementStatus: "PAID" },
  });

  const updated = await findVisibleBill(tx, actingUserId, billId);
  await createActivity(tx, {
    actorId: actingUserId,
    recipientIds: updated.shares.map((share) => share.user.id),
    billId,
    type: "BILL_SETTLED",
    message: `settled up on the bill "${updated.description}".`,
  });

  return presentBill(updated, actingUserId, friendUserId);
}

export async function unsettleBill(
  tx: PrismaTransaction,
  actingUserId: string,
  billId: string,
  friendUserId?: string,
  participantUserId?: string,
) {
  const bill = await findVisibleBill(tx, actingUserId, billId);
  if (participantUserId && bill.payerId !== actingUserId) {
    throw new ApiError(
      403,
      "PARTICIPANT_UNSETTLE_FORBIDDEN",
      "Only the bill payer can undo settlement for a participant",
    );
  }
  const shareIds = sharesToUnsettle(
    {
      payerId: bill.payerId,
      shares: bill.shares.map((share) => ({
        id: share.id,
        userId: share.user.id,
        shareCents: share.shareCents,
        settledAt: share.settledAt,
        settlementStatus: share.settlementStatus,
      })),
    },
    actingUserId,
    friendUserId,
    participantUserId,
  );

  if (shareIds.length === 0) {
    throw new ApiError(400, "NOTHING_TO_UNSETTLE", "Nothing to undo on this bill");
  }

  await tx.billShare.updateMany({
    where: { id: { in: shareIds } },
    data: { settledAt: null, settlementStatus: "NOT_PAID" },
  });

  const updated = await findVisibleBill(tx, actingUserId, billId);
  await createActivity(tx, {
    actorId: actingUserId,
    recipientIds: updated.shares.map((share) => share.user.id),
    billId,
    type: "BILL_UNSETTLED",
    message: `undid settlement on the bill "${updated.description}".`,
  });

  return presentBill(updated, actingUserId, friendUserId);
}

export async function settleFriend(
  tx: PrismaTransaction,
  actingUserId: string,
  friendshipId: string,
) {
  const friendship = await tx.friendship.findFirst({
    where: {
      id: friendshipId,
      OR: [{ userAId: actingUserId }, { userBId: actingUserId }],
    },
  });

  if (!friendship) {
    throw new ApiError(404, "FRIENDSHIP_NOT_FOUND", "Friendship not found");
  }

  const friendUserId =
    friendship.userAId === actingUserId ? friendship.userBId : friendship.userAId;
  const settledAt = new Date();
  let settledCount = 0;

  const billsWithFriend = await tx.bill.findMany({
    where: {
      deletedAt: null,
      shares: { some: { userId: actingUserId } },
      AND: [{ shares: { some: { userId: friendUserId } } }],
    },
    include: billInclude,
  });

  for (const bill of billsWithFriend) {
    const shareIds = sharesToSettle(
      {
        payerId: bill.payerId,
        shares: bill.shares.map((share) => ({
          id: share.id,
          userId: share.user.id,
          shareCents: share.shareCents,
          settledAt: share.settledAt,
          settlementStatus: share.settlementStatus,
        })),
      },
      actingUserId,
      friendUserId,
    );

    if (shareIds.length === 0) {
      continue;
    }

    await tx.billShare.updateMany({
      where: { id: { in: shareIds } },
      data: { settledAt, settlementStatus: "PAID" },
    });
    settledCount += shareIds.length;
  }

  if (settledCount > 0) {
    await createActivity(tx, {
      actorId: actingUserId,
      recipientIds: [friendUserId],
      friendshipId,
      type: "FRIEND_SETTLED",
      message: "settled up all outstanding bills.",
    });
  }

  return { settledCount };
}
