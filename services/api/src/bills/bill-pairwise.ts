export type PairwiseSummary = {
  amountCents: number;
  direction: "friend_owes_you" | "you_owe_friend";
  yourShareCents: number;
  friendShareCents: number;
};

type BillShareLike = {
  userId: string;
  shareCents: number;
};

export function pairwiseSummaryForBill(
  bill: { payerId: string; shares: BillShareLike[] },
  currentUserId: string,
  friendUserId: string,
): PairwiseSummary | null {
  const yourShareCents =
    bill.shares.find((share) => share.userId === currentUserId)?.shareCents ?? 0;
  const friendShareCents =
    bill.shares.find((share) => share.userId === friendUserId)?.shareCents ?? 0;

  if (bill.payerId === currentUserId && friendShareCents > 0) {
    return {
      amountCents: friendShareCents,
      direction: "friend_owes_you",
      yourShareCents,
      friendShareCents,
    };
  }

  if (bill.payerId === friendUserId && yourShareCents > 0) {
    return {
      amountCents: yourShareCents,
      direction: "you_owe_friend",
      yourShareCents,
      friendShareCents,
    };
  }

  return null;
}
