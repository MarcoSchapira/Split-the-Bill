import { ApiError } from "../http/errors";
import type { ParsedReceipt } from "./receipt.types";

const TOLERANCE = 0.02;

export const RECEIPT_TOTALS_MISMATCH_MESSAGE =
  "We couldn't verify the receipt totals. Please retake the photo with the full receipt clearly visible.";

export function validateReceiptTotals(receipt: ParsedReceipt): ParsedReceipt {
  if (receipt.subtotal === null || receipt.total === null) {
    throw new ApiError(422, "RECEIPT_TOTALS_MISMATCH", RECEIPT_TOTALS_MISMATCH_MESSAGE);
  }

  const itemsSum = receipt.items.reduce((sum, item) => sum + item.total_price, 0);
  if (Math.abs(itemsSum - receipt.subtotal) > TOLERANCE) {
    throw new ApiError(422, "RECEIPT_TOTALS_MISMATCH", RECEIPT_TOTALS_MISMATCH_MESSAGE);
  }

  const tax = receipt.tax ?? 0;
  const tip = receipt.tip ?? 0;
  const expectedTotal = receipt.subtotal + tax + tip;
  if (Math.abs(expectedTotal - receipt.total) > TOLERANCE) {
    throw new ApiError(422, "RECEIPT_TOTALS_MISMATCH", RECEIPT_TOTALS_MISMATCH_MESSAGE);
  }

  return receipt;
}
