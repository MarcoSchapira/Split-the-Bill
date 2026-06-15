import { ApiError } from "../http/errors";
import type { BillShareInput } from "./bill-split";
import type { ParsedReceipt } from "../receipts/receipt.types";

export type CaptureBillItemInput = {
  name: string;
  quantity: number;
  unitPriceCents: number;
  totalPriceCents: number;
  assignedUserIds: string[];
};

function dollarsToCents(value: number | null | undefined): number {
  if (value == null) {
    return 0;
  }
  return Math.round(value * 100);
}

function allocateRemainderCents(
  orderedUserIds: string[],
  baseAmounts: Map<string, number>,
  remainderCents: number,
): Map<string, number> {
  const result = new Map(baseAmounts);
  for (let i = 0; i < remainderCents; i++) {
    const userId = orderedUserIds[i % orderedUserIds.length];
    result.set(userId, (result.get(userId) ?? 0) + 1);
  }
  return result;
}

export function computeCaptureShares(
  receipt: ParsedReceipt,
  items: CaptureBillItemInput[],
  participantIds: string[],
): { shares: BillShareInput[]; totalCents: number } {
  const participants = [...new Set(participantIds)].sort();
  if (participants.length === 0) {
    throw new ApiError(400, "INVALID_PARTICIPANTS", "At least one participant is required");
  }

  const baseCents = new Map<string, number>();
  for (const userId of participants) {
    baseCents.set(userId, 0);
  }

  let itemsSubtotalCents = 0;

  for (const item of items) {
    if (item.assignedUserIds.length === 0) {
      throw new ApiError(400, "UNASSIGNED_ITEM", `Item "${item.name}" has no assignees`);
    }

    const assignees = [...new Set(item.assignedUserIds)].sort();
    for (const assignee of assignees) {
      if (!participants.includes(assignee)) {
        throw new ApiError(400, "INVALID_ASSIGNEE", "Assignee must be a participant");
      }
    }

    itemsSubtotalCents += item.totalPriceCents;
    const perAssignee = Math.floor(item.totalPriceCents / assignees.length);
    const remainder = item.totalPriceCents % assignees.length;

    assignees.forEach((userId, index) => {
      const extra = index < remainder ? 1 : 0;
      baseCents.set(userId, (baseCents.get(userId) ?? 0) + perAssignee + extra);
    });
  }

  const taxCents = dollarsToCents(receipt.tax);
  const tipCents = dollarsToCents(receipt.tip);
  const extrasCents = taxCents + tipCents;

  const extrasBase = new Map<string, number>();
  for (const userId of participants) {
    extrasBase.set(userId, 0);
  }

  if (extrasCents > 0) {
    if (itemsSubtotalCents > 0) {
      let allocated = 0;
      const ordered = [...participants].sort();
      for (let i = 0; i < ordered.length; i++) {
        const userId = ordered[i];
        const userBase = baseCents.get(userId) ?? 0;
        if (i === ordered.length - 1) {
          extrasBase.set(userId, extrasCents - allocated);
        } else {
          const share = Math.floor((extrasCents * userBase) / itemsSubtotalCents);
          extrasBase.set(userId, share);
          allocated += share;
        }
      }
    } else {
      const perUser = Math.floor(extrasCents / participants.length);
      const remainder = extrasCents % participants.length;
      const allocated = allocateRemainderCents(
        participants,
        new Map(participants.map((id) => [id, perUser])),
        remainder,
      );
      for (const [userId, amount] of allocated) {
        extrasBase.set(userId, amount);
      }
    }
  }

  const totalCents =
    receipt.total != null ? dollarsToCents(receipt.total) : itemsSubtotalCents + extrasCents;

  const shares: BillShareInput[] = participants.map((userId) => ({
    userId,
    shareCents: (baseCents.get(userId) ?? 0) + (extrasBase.get(userId) ?? 0),
  }));

  const shareSum = shares.reduce((sum, share) => sum + share.shareCents, 0);
  if (shareSum !== totalCents) {
    const diff = totalCents - shareSum;
    const payerCandidate = shares.find((s) => s.shareCents > 0) ?? shares[0];
    payerCandidate.shareCents += diff;
  }

  return { shares, totalCents };
}

export function parseReceiptIncurredAt(receipt: ParsedReceipt): Date {
  if (receipt.date) {
    const timePart = receipt.time ? ` ${receipt.time}` : "";
    const parsed = Date.parse(`${receipt.date}${timePart}`);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed);
    }
  }
  return new Date();
}
