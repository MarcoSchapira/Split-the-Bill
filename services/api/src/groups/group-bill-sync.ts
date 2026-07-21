import type { PrismaTransaction } from "../db/userContext";

export function hasUnresolvedGroupBalance(
  shares: Array<{
    userId: string;
    lenderId: string;
    shareCents: number;
    lenderConfirmedPaid: boolean;
  }>,
): boolean {
  return shares.some(
    (share) =>
      share.userId !== share.lenderId &&
      share.shareCents > 0 &&
      !share.lenderConfirmedPaid,
  );
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
          lenderId: true,
          shareCents: true,
          payerMarkedAsPaid: true,
          lenderConfirmedPaid: true,
        },
      },
    },
  });

  return bills.filter((bill) => hasUnresolvedGroupBalance(bill.shares));
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

export async function countAllGroupBills(tx: PrismaTransaction, groupId: string) {
  return countGroupBills(tx, groupId);
}

export async function countUnsettledGroupBills(tx: PrismaTransaction, groupId: string) {
  const bills = await findUnsettledGroupBills(tx, groupId);
  return bills.length;
}
