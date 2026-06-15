import { ApiError } from "../http/errors";
import { logValidationFailure } from "./receipt.logger";
import type { ParsedReceipt, ReceiptItem } from "./receipt.types";

/** Allow 1 cent rounding drift for line-item vs subtotal checks. */
const ITEMS_TOLERANCE_CENTS = 1;

/** Allow wider drift for tax rounding on printed grand totals. */
const GRAND_TOTAL_TOLERANCE_CENTS = 25;

export const RECEIPT_TOTALS_MISMATCH_MESSAGE =
  "We couldn't verify the receipt totals. Please retake the photo with the full receipt clearly visible.";

/** Max share of item total that can be "missing" from subtotal (unlisted discounts). */
const MAX_IMPLICIT_ADJUSTMENT_RATIO = 0.35;

export type ReceiptTotalsDebug = {
  reason:
    | "missing_subtotal"
    | "missing_total"
    | "items_subtotal_mismatch"
    | "grand_total_mismatch";
  itemsSumTotalPriceCents: number;
  itemsSumUnitPriceTimesQtyCents: number;
  itemsSumUnitPriceCents: number;
  matchedItemsStrategy:
    | "total_price"
    | "unit_price_times_qty"
    | "unit_price"
    | "implicit_adjustment"
    | null;
  subtotalCents: number | null;
  taxCents: number;
  tipCents: number;
  totalCents: number | null;
  expectedTotalCents: number | null;
  expectedTotalFromItemsCents: number | null;
  itemsSubtotalDeltaCents: number | null;
  grandTotalDeltaCents: number | null;
  grandTotalFromItemsDeltaCents: number | null;
  itemCount: number;
  summary?: string;
};

export function toCents(value: number): number {
  return Math.round(Number(value.toFixed(2)) * 100);
}

function sumItemCents(items: ReceiptItem[], strategy: "total_price" | "unit_price_times_qty" | "unit_price"): number {
  return items.reduce((sum, item) => {
    if (strategy === "total_price") {
      return sum + toCents(item.total_price);
    }
    if (strategy === "unit_price_times_qty") {
      return sum + toCents(item.unit_price * item.quantity);
    }
    return sum + toCents(item.unit_price);
  }, 0);
}

function withinItemsTolerance(a: number, b: number): boolean {
  return Math.abs(a - b) <= ITEMS_TOLERANCE_CENTS;
}

function withinGrandTotalTolerance(a: number, b: number): boolean {
  return Math.abs(a - b) <= GRAND_TOTAL_TOLERANCE_CENTS;
}

function pickItemsSubtotalStrategy(
  items: ReceiptItem[],
  subtotalCents: number,
): ReceiptTotalsDebug["matchedItemsStrategy"] {
  const strategies: Array<
    Exclude<ReceiptTotalsDebug["matchedItemsStrategy"], "implicit_adjustment" | null>
  > = ["total_price", "unit_price_times_qty", "unit_price"];

  for (const strategy of strategies) {
    if (withinItemsTolerance(sumItemCents(items, strategy), subtotalCents)) {
      return strategy;
    }
  }

  const itemsSumTotalPriceCents = sumItemCents(items, "total_price");
  if (itemsSumTotalPriceCents > subtotalCents) {
    const adjustmentCents = itemsSumTotalPriceCents - subtotalCents;
    const adjustmentRatio = adjustmentCents / itemsSumTotalPriceCents;
    if (adjustmentRatio <= MAX_IMPLICIT_ADJUSTMENT_RATIO) {
      return "implicit_adjustment";
    }
  }

  return null;
}

export function getReceiptTotalsDebug(receipt: ParsedReceipt): ReceiptTotalsDebug {
  const itemsSumTotalPriceCents = sumItemCents(receipt.items, "total_price");
  const itemsSumUnitPriceTimesQtyCents = sumItemCents(receipt.items, "unit_price_times_qty");
  const itemsSumUnitPriceCents = sumItemCents(receipt.items, "unit_price");
  const subtotalCents = receipt.subtotal === null ? null : toCents(receipt.subtotal);
  const taxCents = toCents(receipt.tax ?? 0);
  const tipCents = toCents(receipt.tip ?? 0);
  const totalCents = receipt.total === null ? null : toCents(receipt.total);
  const expectedTotalCents = subtotalCents === null ? null : subtotalCents + taxCents + tipCents;
  const expectedTotalFromItemsCents = itemsSumTotalPriceCents + taxCents + tipCents;
  const matchedItemsStrategy =
    subtotalCents === null ? null : pickItemsSubtotalStrategy(receipt.items, subtotalCents);

  const matchedItemsSumCents =
    matchedItemsStrategy === "total_price"
      ? itemsSumTotalPriceCents
      : matchedItemsStrategy === "unit_price_times_qty"
        ? itemsSumUnitPriceTimesQtyCents
        : matchedItemsStrategy === "unit_price"
          ? itemsSumUnitPriceCents
          : matchedItemsStrategy === "implicit_adjustment"
            ? itemsSumTotalPriceCents
            : itemsSumTotalPriceCents;

  const grandTotalDeltaCents =
    expectedTotalCents === null || totalCents === null
      ? null
      : expectedTotalCents - totalCents;
  const grandTotalFromItemsDeltaCents =
    totalCents === null ? null : expectedTotalFromItemsCents - totalCents;

  const summary =
    subtotalCents !== null && totalCents !== null
      ? `subtotal + tax + tip = ${(expectedTotalCents! / 100).toFixed(2)}, total = ${(totalCents / 100).toFixed(2)}, delta = ${grandTotalDeltaCents} cents`
      : undefined;

  return {
    reason: "items_subtotal_mismatch",
    itemsSumTotalPriceCents,
    itemsSumUnitPriceTimesQtyCents,
    itemsSumUnitPriceCents,
    matchedItemsStrategy,
    subtotalCents,
    taxCents,
    tipCents,
    totalCents,
    expectedTotalCents,
    expectedTotalFromItemsCents,
    itemsSubtotalDeltaCents:
      subtotalCents === null ? null : matchedItemsSumCents - subtotalCents,
    grandTotalDeltaCents,
    grandTotalFromItemsDeltaCents,
    itemCount: receipt.items.length,
    summary,
  };
}

function grandTotalMatches(debug: ReceiptTotalsDebug): boolean {
  if (debug.expectedTotalCents === null || debug.totalCents === null) {
    return false;
  }

  if (withinGrandTotalTolerance(debug.expectedTotalCents, debug.totalCents)) {
    return true;
  }

  if (
    debug.expectedTotalFromItemsCents !== null &&
    withinGrandTotalTolerance(debug.expectedTotalFromItemsCents, debug.totalCents)
  ) {
    return true;
  }

  return false;
}

export function validateReceiptTotals(receipt: ParsedReceipt): ParsedReceipt {
  const debug = getReceiptTotalsDebug(receipt);

  if (receipt.subtotal === null) {
    logValidationFailure({ ...debug, reason: "missing_subtotal" });
    throw new ApiError(422, "RECEIPT_TOTALS_MISMATCH", RECEIPT_TOTALS_MISMATCH_MESSAGE);
  }

  if (receipt.total === null) {
    logValidationFailure({ ...debug, reason: "missing_total" });
    throw new ApiError(422, "RECEIPT_TOTALS_MISMATCH", RECEIPT_TOTALS_MISMATCH_MESSAGE);
  }

  if (debug.matchedItemsStrategy === null) {
    logValidationFailure({ ...debug, reason: "items_subtotal_mismatch" });
    throw new ApiError(422, "RECEIPT_TOTALS_MISMATCH", RECEIPT_TOTALS_MISMATCH_MESSAGE);
  }

  if (!grandTotalMatches(debug)) {
    logValidationFailure({ ...debug, reason: "grand_total_mismatch" });
    throw new ApiError(422, "RECEIPT_TOTALS_MISMATCH", RECEIPT_TOTALS_MISMATCH_MESSAGE);
  }

  return receipt;
}
