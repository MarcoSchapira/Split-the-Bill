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
  balanceCents: number;
};

export async function getDashboard(tx: PrismaTransaction, userId: string) {
  const [friendships, bills] = await Promise.all([
    tx.friendship.findMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
      include: {
        userA: { select: safeUserSelect },
        userB: { select: safeUserSelect },
      },
    }),
    tx.bill.findMany({
      where: {
        deletedAt: null,
        shares: { some: { userId } },
      },
      select: {
        payerId: true,
        payer: { select: safeUserSelect },
        shares: {
          select: {
            shareCents: true,
            settledAt: true,
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

    if (existing) {
      existing.balanceCents += amountCents;
      return;
    }

    contacts.set(contactUser.id, {
      user: contactUser,
      relationship: "group",
      balanceCents: amountCents,
    });
  }

  for (const bill of bills) {
    if (bill.payerId === userId) {
      for (const share of bill.shares) {
        if (share.user.id !== userId && share.settledAt == null) {
          adjustBalance(share.user, share.shareCents);
        }
      }
      continue;
    }

    const ownShare = bill.shares.find((share) => share.user.id === userId);

    if (ownShare && ownShare.settledAt == null) {
      adjustBalance(bill.payer, -ownShare.shareCents);
    }
  }

  const balances = [...contacts.values()]
    .filter((contact) => contact.relationship === "friend" || contact.balanceCents !== 0)
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

  return {
    totalOwedToYouCents,
    totalYouOweCents,
    netBalanceCents: totalOwedToYouCents - totalYouOweCents,
    balances,
  };
}
