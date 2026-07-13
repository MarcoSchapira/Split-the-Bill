import type { PrismaTransaction } from "../db/userContext";
import { safeUserSelect } from "../auth/auth.types";

type BalanceContact = {
  user: {
    id: string;
    email: string;
    name: string | null;
    createdAt: Date;
  };
  relationship: "friend" | "group";
  friendshipId?: string;
  groupId?: string;
  balanceCents: number;
};

export async function getDashboard(tx: PrismaTransaction, userId: string) {
  const [friendships, groups, bills] = await Promise.all([
    tx.friendship.findMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
      include: {
        userA: { select: safeUserSelect },
        userB: { select: safeUserSelect },
      },
    }),
    tx.groupMember.findMany({
      where: { userId },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            iconKey: true,
            createdAt: true,
          },
        },
      },
    }),
    tx.bill.findMany({
      where: {
        deletedAt: null,
        shares: { some: { userId } },
      },
      select: {
        payerId: true,
        groupId: true,
        payer: { select: safeUserSelect },
        shares: {
          select: {
            shareCents: true,
            payerMarkedAsPaid: true,
            lenderConfirmedPaid: true,
            user: { select: safeUserSelect },
          },
        },
      },
    }),
  ]);
  const contacts = new Map<string, BalanceContact>();

  for (const friendship of friendships) {
    const friend =
      friendship.userAId === userId ? friendship.userB : friendship.userA;
    contacts.set(friend.id, {
      user: friend,
      relationship: "friend",
      friendshipId: friendship.id,
      balanceCents: 0,
    });
  }

  function adjustBalance(
    contactUser: BalanceContact["user"],
    amountCents: number,
  ) {
    const existing = contacts.get(contactUser.id);
    if (!existing) return;
    existing.balanceCents += amountCents;
  }

  for (const bill of bills) {
    if (bill.payerId === userId) {
      for (const share of bill.shares) {
        if (share.user.id !== userId && !share.lenderConfirmedPaid) {
          adjustBalance(share.user, share.shareCents);
        }
      }
      continue;
    }

    const ownShare = bill.shares.find((share) => share.user.id === userId);

    if (ownShare && !ownShare.lenderConfirmedPaid) {
      adjustBalance(bill.payer, -ownShare.shareCents);
    }
  }

  const balances = [...contacts.values()]
    .filter((contact) => contact.balanceCents !== 0)
    .sort((left, right) => {
      const byBalance = Math.abs(right.balanceCents) - Math.abs(left.balanceCents);
      return byBalance || (left.user.name ?? left.user.email).localeCompare(right.user.name ?? right.user.email);
    });
  const totalOwedToYouCents = balances.reduce(
    (sum, contact) => sum + Math.max(contact.balanceCents, 0),
    0,
  );
  const totalYouOweCents = balances.reduce(
    (sum, contact) => sum + Math.max(-contact.balanceCents, 0),
    0,
  );

  const groupBalances: Array<{
    group: {
      id: string;
      name: string;
      iconKey: string;
      createdAt: Date;
    };
    balanceCents: number;
  }> = [];

  for (const membership of groups) {
    const groupBills = bills.filter((bill) => bill.groupId === membership.group.id);
    let balanceCents = 0;

    for (const bill of groupBills) {
      if (bill.payerId === userId) {
        for (const share of bill.shares) {
          if (share.user.id !== userId && !share.lenderConfirmedPaid) {
            balanceCents += share.shareCents;
          }
        }
        continue;
      }

      const ownShare = bill.shares.find((share) => share.user.id === userId);
      if (ownShare && !ownShare.lenderConfirmedPaid) {
        balanceCents -= ownShare.shareCents;
      }
    }

    if (balanceCents !== 0) {
      groupBalances.push({
        group: membership.group,
        balanceCents,
      });
    }
  }

  groupBalances.sort(
    (left, right) =>
      Math.abs(right.balanceCents) - Math.abs(left.balanceCents) ||
      left.group.name.localeCompare(right.group.name),
  );

  return {
    totalOwedToYouCents,
    totalYouOweCents,
    netBalanceCents: totalOwedToYouCents - totalYouOweCents,
    balances,
    groupBalances,
  };
}
