import type { PrismaTransaction } from "../db/userContext";
import { equalShares } from "../bills/bill-split";
import { createActivity } from "../activity/activity.service";

type SettlementSnapshot = {
  payerMarkedAsPaid: boolean;
  lenderConfirmedPaid: boolean;
};

export function isFullyUnsettledGroupBill(
  shares: Array<{ lenderConfirmedPaid: boolean }>,
): boolean {
  return shares.every((share) => !share.lenderConfirmedPaid);
}

export async function findUnsettledGroupBills(tx: PrismaTransaction, groupId: string) {
  const bills = await tx.bill.findMany({
    where: {
      groupId,
      isSplitWithGroup: true,
      deletedAt: null,
    },
    include: {
      shares: {
        select: {
          userId: true,
          payerMarkedAsPaid: true,
          lenderConfirmedPaid: true,
        },
      },
    },
  });

  return bills.filter((bill) => isFullyUnsettledGroupBill(bill.shares));
}

export async function recalcGroupBillEvenShares(
  tx: PrismaTransaction,
  billId: string,
  memberIds: string[],
  options: {
    actingUserId: string;
    preserveSettlement?: boolean;
    emitActivity?: boolean;
  },
) {
  const bill = await tx.bill.findUnique({
    where: { id: billId },
    select: {
      id: true,
      description: true,
      totalCents: true,
      deletedAt: true,
      shares: {
        select: {
          userId: true,
          payerMarkedAsPaid: true,
          lenderConfirmedPaid: true,
        },
      },
    },
  });

  if (!bill || bill.deletedAt) {
    return;
  }

  const participantIds = [...new Set(memberIds)].sort();
  if (participantIds.length === 0) {
    return;
  }

  const shares = equalShares(bill.totalCents, participantIds);
  const settlementByUserId = new Map<string, SettlementSnapshot>(
    bill.shares.map((share) => [
      share.userId,
      {
        payerMarkedAsPaid: share.payerMarkedAsPaid,
        lenderConfirmedPaid: share.lenderConfirmedPaid,
      },
    ]),
  );

  await tx.billShare.deleteMany({ where: { billId } });
  await tx.billShare.createMany({
    data: shares.map((share) => ({
      billId,
      userId: share.userId,
      shareCents: share.shareCents,
      ...(options.preserveSettlement !== false
        ? (settlementByUserId.get(share.userId) ?? {})
        : {}),
    })),
  });

  if (options.emitActivity) {
    await createActivity(tx, {
      actorId: options.actingUserId,
      recipientIds: participantIds,
      billId,
      type: "BILL_UPDATED",
      message: `updated the bill "${bill.description}".`,
    });
  }
}

export async function syncMemberToUnsettledGroupBills(
  tx: PrismaTransaction,
  groupId: string,
  memberIds: string[],
  actingUserId: string,
) {
  const bills = await findUnsettledGroupBills(tx, groupId);

  for (const bill of bills) {
    await recalcGroupBillEvenShares(tx, bill.id, memberIds, {
      actingUserId,
      preserveSettlement: true,
      emitActivity: true,
    });
  }
}

export async function countGroupBills(tx: PrismaTransaction, groupId: string) {
  return tx.bill.count({
    where: {
      groupId,
      isSplitWithGroup: true,
      deletedAt: null,
    },
  });
}

export async function countUnsettledGroupBills(tx: PrismaTransaction, groupId: string) {
  const bills = await findUnsettledGroupBills(tx, groupId);
  return bills.length;
}

export async function memberHasUnsettledGroupBillShares(
  tx: PrismaTransaction,
  groupId: string,
  userId: string,
) {
  const bills = await findUnsettledGroupBills(tx, groupId);
  return bills.some((bill) => bill.shares.some((share) => share.userId === userId));
}
