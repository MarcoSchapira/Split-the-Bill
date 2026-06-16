import type { PrismaTransaction } from "../db/userContext";
import { ApiError } from "../http/errors";
import { createActivity } from "../activity/activity.service";
import { pairwiseSummaryForBill } from "./bill-pairwise";
import { sharesToSettle } from "./bill-balance";
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
) {
  const bill = await findVisibleBill(tx, actingUserId, billId);
  const shareIds = sharesToSettle(
    {
      payerId: bill.payerId,
      shares: bill.shares.map((share) => ({
        id: share.id,
        userId: share.user.id,
        shareCents: share.shareCents,
        settledAt: share.settledAt,
      })),
    },
    actingUserId,
    friendUserId,
  );

  if (shareIds.length === 0) {
    throw new ApiError(400, "NOTHING_TO_SETTLE", "Nothing to settle on this bill");
  }

  const settledAt = new Date();
  await tx.billShare.updateMany({
    where: { id: { in: shareIds } },
    data: { settledAt },
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

  const directBills = await tx.bill.findMany({
    where: {
      deletedAt: null,
      friendshipId,
      OR: [
        { friendship: { OR: [{ userAId: actingUserId }, { userBId: actingUserId }] } },
      ],
    },
    include: billInclude,
  });

  for (const bill of directBills) {
    const shareIds = sharesToSettle(
      {
        payerId: bill.payerId,
        shares: bill.shares.map((share) => ({
          id: share.id,
          userId: share.user.id,
          shareCents: share.shareCents,
          settledAt: share.settledAt,
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
      data: { settledAt },
    });
    settledCount += shareIds.length;
  }

  const sharedMemberships = await tx.groupMember.findMany({
    where: {
      userId: actingUserId,
      group: { members: { some: { userId: friendUserId } } },
    },
    select: { groupId: true },
  });
  const sharedGroupIds = sharedMemberships.map((membership) => membership.groupId);

  if (sharedGroupIds.length > 0) {
    const groupBills = await tx.bill.findMany({
      where: {
        deletedAt: null,
        groupId: { in: sharedGroupIds },
      },
      include: billInclude,
    });

    for (const bill of groupBills) {
      const pairwise = pairwiseSummaryForBill(
        {
          payerId: bill.payerId,
          shares: bill.shares.map((share) => ({
            userId: share.user.id,
            shareCents: share.shareCents,
          })),
        },
        actingUserId,
        friendUserId,
      );

      if (!pairwise) {
        continue;
      }

      const shareIds = sharesToSettle(
        {
          payerId: bill.payerId,
          shares: bill.shares.map((share) => ({
            id: share.id,
            userId: share.user.id,
            shareCents: share.shareCents,
            settledAt: share.settledAt,
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
        data: { settledAt },
      });
      settledCount += shareIds.length;
    }
  }

  if (settledCount > 0) {
    await createActivity(tx, {
      actorId: actingUserId,
      recipientIds: [friendUserId],
      type: "FRIEND_SETTLED",
      message: "settled up all outstanding bills.",
    });
  }

  return { settledCount };
}
