import type { PrismaTransaction } from "../db/userContext";

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
