import { ApiError } from "../http/errors";

export type BillShareInput = {
  userId: string;
  shareCents: number;
};

export function equalShares(totalCents: number, participantIds: string[]): BillShareInput[] {
  const ordered = [...new Set(participantIds)].sort();

  if (ordered.length === 0) {
    throw new ApiError(400, "INVALID_SHARES", "At least one share is required");
  }

  const baseShare = Math.floor(totalCents / ordered.length);
  const remainder = totalCents % ordered.length;

  return ordered.map((userId, index) => ({
    userId,
    shareCents: baseShare + (index < remainder ? 1 : 0),
  }));
}

export function buildSharesFromInput(
  totalCents: number,
  memberIds: string[],
  shares: BillShareInput[] | undefined,
): BillShareInput[] {
  if (!shares) {
    return equalShares(totalCents, memberIds);
  }

  if (shares.length === 0) {
    throw new ApiError(400, "INVALID_SHARES", "At least one share is required");
  }

  const seen = new Set<string>();
  let sum = 0;
  let hasPositive = false;

  for (const share of shares) {
    if (seen.has(share.userId)) {
      throw new ApiError(400, "INVALID_SHARES", "Duplicate share entries are not allowed");
    }
    seen.add(share.userId);

    if (!memberIds.includes(share.userId)) {
      throw new ApiError(400, "INVALID_SHARES", "Share user must belong to the bill target");
    }

    if (!Number.isInteger(share.shareCents) || share.shareCents < 0) {
      throw new ApiError(400, "INVALID_SHARES", "Share amounts must be non-negative integers");
    }

    sum += share.shareCents;
    if (share.shareCents > 0) {
      hasPositive = true;
    }
  }

  if (!hasPositive) {
    throw new ApiError(400, "INVALID_SHARES", "At least one share must be greater than zero");
  }

  if (sum !== totalCents) {
    throw new ApiError(
      400,
      "INVALID_SHARE_TOTAL",
      "Share amounts must add up to the bill total",
    );
  }

  return shares.map((share) => ({ userId: share.userId, shareCents: share.shareCents }));
}
