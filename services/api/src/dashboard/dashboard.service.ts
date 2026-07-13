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
  const [friendships, groups, shares] = await Promise.all([
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
    tx.billShare.findMany({
      where: {
        bill: { deletedAt: null },
        OR: [{ lenderId: userId }, { userId }],
      },
      select: {
        shareCents: true,
        userId: true,
        lenderId: true,
        payerMarkedAsPaid: true,
        lenderConfirmedPaid: true,
        user: { select: safeUserSelect },
        lender: { select: safeUserSelect },
        bill: { select: { groupId: true } },
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

  let totalOwedToYouCents = 0;
  let owedToYouPendingConfirmationCents = 0;
  let totalYouOweCents = 0;
  let youOwePendingConfirmationCents = 0;
  let youOweOutstandingCents = 0;

  for (const share of shares) {
    if (
      share.lenderId === userId &&
      share.userId !== userId &&
      !share.lenderConfirmedPaid
    ) {
      totalOwedToYouCents += share.shareCents;
      if (share.payerMarkedAsPaid) {
        owedToYouPendingConfirmationCents += share.shareCents;
      }
      adjustBalance(share.user, share.shareCents);
    }

    if (
      share.userId === userId &&
      share.lenderId !== userId &&
      !share.lenderConfirmedPaid
    ) {
      youOweOutstandingCents += share.shareCents;
      if (share.payerMarkedAsPaid) {
        youOwePendingConfirmationCents += share.shareCents;
      }
    }

    if (
      share.userId === userId &&
      share.lenderId !== userId &&
      !share.payerMarkedAsPaid &&
      !share.lenderConfirmedPaid
    ) {
      totalYouOweCents += share.shareCents;
      adjustBalance(share.lender, -share.shareCents);
    }
  }

  const balances = [...contacts.values()]
    .filter((contact) => contact.balanceCents !== 0)
    .sort((left, right) => {
      const byBalance = Math.abs(right.balanceCents) - Math.abs(left.balanceCents);
      return byBalance || (left.user.name ?? left.user.email).localeCompare(right.user.name ?? right.user.email);
    });

  const owedToYouPendingConfirmationPercent =
    totalOwedToYouCents === 0
      ? null
      : Math.round(
          (owedToYouPendingConfirmationCents / totalOwedToYouCents) * 100,
        );

  const youOwePendingConfirmationPercent =
    youOweOutstandingCents === 0
      ? null
      : Math.round(
          (youOwePendingConfirmationCents / youOweOutstandingCents) * 100,
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
    const groupId = membership.group.id;
    let balanceCents = 0;

    for (const share of shares) {
      if (share.bill.groupId !== groupId) continue;

      if (
        share.lenderId === userId &&
        share.userId !== userId &&
        !share.lenderConfirmedPaid
      ) {
        balanceCents += share.shareCents;
      }

      if (
        share.userId === userId &&
        share.lenderId !== userId &&
        !share.payerMarkedAsPaid &&
        !share.lenderConfirmedPaid
      ) {
        balanceCents -= share.shareCents;
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
    owedToYouPendingConfirmationPercent,
    youOwePendingConfirmationPercent,
    balances,
    groupBalances,
  };
}
