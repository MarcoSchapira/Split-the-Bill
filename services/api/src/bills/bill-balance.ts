import { pairwiseSummaryForBill } from "./bill-pairwise";

export type BillUserSummary = {
  amountCents: number;
  direction: "owed_to_you" | "you_owe" | "none";
  settled: boolean;
};

export type BillShareSettlementStatus = "NOT_PAID" | "PENDING" | "PAID";

export type BillShareBalanceLike = {
  userId: string;
  shareCents: number;
  settledAt: Date | null;
  settlementStatus?: BillShareSettlementStatus;
};

function isPaid(share: BillShareBalanceLike): boolean {
  if (share.settlementStatus) {
    return share.settlementStatus === "PAID";
  }
  return share.settledAt != null;
}

export function userSummaryForBill(
  bill: { payerId: string; shares: BillShareBalanceLike[] },
  currentUserId: string,
  friendUserId?: string,
): BillUserSummary {
  if (friendUserId) {
    return pairwiseUserSummary(bill, currentUserId, friendUserId);
  }

  return fullBillUserSummary(bill, currentUserId);
}

function pairwiseUserSummary(
  bill: { payerId: string; shares: BillShareBalanceLike[] },
  currentUserId: string,
  friendUserId: string,
): BillUserSummary {
  const yourShare = bill.shares.find((share) => share.userId === currentUserId);
  const friendShare = bill.shares.find((share) => share.userId === friendUserId);
  const pairwise = pairwiseSummaryForBill(bill, currentUserId, friendUserId);

  if (!pairwise) {
    return { amountCents: 0, direction: "none", settled: false };
  }

  if (pairwise.direction === "friend_owes_you") {
    return {
      amountCents: pairwise.amountCents,
      direction: "owed_to_you",
      settled: friendShare ? isPaid(friendShare) : false,
    };
  }

  return {
    amountCents: pairwise.amountCents,
    direction: "you_owe",
    settled: yourShare ? isPaid(yourShare) : false,
  };
}

function fullBillUserSummary(
  bill: { payerId: string; shares: BillShareBalanceLike[] },
  currentUserId: string,
): BillUserSummary {
  if (bill.payerId === currentUserId) {
    const debtorShares = bill.shares.filter(
      (share) => share.userId !== currentUserId && share.shareCents > 0,
    );

    if (debtorShares.length === 0) {
      return { amountCents: 0, direction: "none", settled: false };
    }

    const totalDebtCents = debtorShares.reduce((sum, share) => sum + share.shareCents, 0);
    const unsettledDebtCents = debtorShares
      .filter((share) => !isPaid(share))
      .reduce((sum, share) => sum + share.shareCents, 0);
    const allSettled = debtorShares.every((share) => isPaid(share));

    return {
      amountCents: allSettled ? totalDebtCents : unsettledDebtCents,
      direction: "owed_to_you",
      settled: allSettled,
    };
  }

  const ownShare = bill.shares.find((share) => share.userId === currentUserId);

  if (!ownShare || ownShare.shareCents <= 0) {
    return { amountCents: 0, direction: "none", settled: false };
  }

  return {
    amountCents: ownShare.shareCents,
    direction: "you_owe",
    settled: isPaid(ownShare),
  };
}

export function sharesToSettle(
  bill: { payerId: string; shares: Array<BillShareBalanceLike & { id: string }> },
  currentUserId: string,
  friendUserId?: string,
  participantUserId?: string,
): string[] {
  if (participantUserId) {
    const targetShare = bill.shares.find(
      (share) =>
        share.userId === participantUserId &&
        share.userId !== bill.payerId &&
        !isPaid(share),
    );
    return targetShare ? [targetShare.id] : [];
  }

  if (friendUserId) {
    const pairwise = pairwiseSummaryForBill(bill, currentUserId, friendUserId);

    if (!pairwise) {
      return [];
    }

    if (pairwise.direction === "friend_owes_you") {
      const friendShare = bill.shares.find(
        (share) => share.userId === friendUserId && !isPaid(share),
      );
      return friendShare ? [friendShare.id] : [];
    }

    const yourShare = bill.shares.find(
      (share) => share.userId === currentUserId && !isPaid(share),
    );
    return yourShare ? [yourShare.id] : [];
  }

  if (bill.payerId === currentUserId) {
    return bill.shares
      .filter((share) => share.userId !== currentUserId && !isPaid(share))
      .map((share) => share.id);
  }

  const ownShare = bill.shares.find(
    (share) => share.userId === currentUserId && !isPaid(share),
  );
  return ownShare ? [ownShare.id] : [];
}

export function sharesToUnsettle(
  bill: { payerId: string; shares: Array<BillShareBalanceLike & { id: string }> },
  currentUserId: string,
  friendUserId?: string,
  participantUserId?: string,
): string[] {
  if (participantUserId) {
    const targetShare = bill.shares.find(
      (share) => share.userId === participantUserId && share.userId !== bill.payerId && isPaid(share),
    );
    return targetShare ? [targetShare.id] : [];
  }

  if (friendUserId) {
    const pairwise = pairwiseSummaryForBill(bill, currentUserId, friendUserId);

    if (!pairwise) {
      return [];
    }

    if (pairwise.direction === "friend_owes_you") {
      const friendShare = bill.shares.find(
        (share) => share.userId === friendUserId && isPaid(share),
      );
      return friendShare ? [friendShare.id] : [];
    }

    const yourShare = bill.shares.find(
      (share) => share.userId === currentUserId && isPaid(share),
    );
    return yourShare ? [yourShare.id] : [];
  }

  if (bill.payerId === currentUserId) {
    return bill.shares
      .filter((share) => share.userId !== currentUserId && isPaid(share))
      .map((share) => share.id);
  }

  const ownShare = bill.shares.find(
    (share) => share.userId === currentUserId && isPaid(share),
  );
  return ownShare ? [ownShare.id] : [];
}

export function toBillShareBalanceLike(
  shares: Array<{
    user: { id: string };
    shareCents: number;
    settledAt: Date | null;
    settlementStatus?: BillShareSettlementStatus;
  }>,
): BillShareBalanceLike[] {
  return shares.map((share) => ({
    userId: share.user.id,
    shareCents: share.shareCents,
    settledAt: share.settledAt,
    settlementStatus: share.settlementStatus,
  }));
}
