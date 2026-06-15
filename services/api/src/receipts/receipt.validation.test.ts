import { describe, expect, it } from "vitest";
import { ApiError } from "../http/errors";
import {
  RECEIPT_TOTALS_MISMATCH_MESSAGE,
  validateReceiptTotals,
} from "./receipt.validation";
import type { ParsedReceipt } from "./receipt.types";

const validReceipt: ParsedReceipt = {
  store_name: "Store Name",
  store_address: "123 Main St",
  receipt_number: "123456",
  date: "2026-06-12",
  time: "6:42 PM",
  items: [
    { name: "Item Name", quantity: 2, unit_price: 4.99, total_price: 9.98 },
    { name: "Another Item", quantity: 1, unit_price: 12.5, total_price: 12.5 },
  ],
  item_count: 3,
  subtotal: 22.48,
  tax: 2.92,
  tip: 0,
  total: 25.4,
  payment_method: "Visa",
  card_last_4: "1234",
};

describe("validateReceiptTotals", () => {
  it("accepts a receipt whose totals add up", () => {
    expect(validateReceiptTotals(validReceipt)).toEqual(validReceipt);
  });

  it("accepts null tax and tip treated as zero", () => {
    const receipt: ParsedReceipt = {
      ...validReceipt,
      tax: null,
      tip: null,
      total: 22.48,
    };
    expect(validateReceiptTotals(receipt)).toEqual(receipt);
  });

  it("rejects when line items do not sum to subtotal", () => {
    expect(() =>
      validateReceiptTotals({
        ...validReceipt,
        subtotal: 99.99,
      }),
    ).toThrow(ApiError);

    try {
      validateReceiptTotals({ ...validReceipt, subtotal: 99.99 });
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      const apiError = error as ApiError;
      expect(apiError.code).toBe("RECEIPT_TOTALS_MISMATCH");
      expect(apiError.message).toBe(RECEIPT_TOTALS_MISMATCH_MESSAGE);
      expect(apiError.statusCode).toBe(422);
    }
  });

  it("rejects when subtotal plus tax and tip do not equal total", () => {
    expect(() =>
      validateReceiptTotals({
        ...validReceipt,
        total: 99.99,
      }),
    ).toThrow(ApiError);
  });

  it("rejects when subtotal is missing", () => {
    expect(() =>
      validateReceiptTotals({
        ...validReceipt,
        subtotal: null,
      }),
    ).toThrow(ApiError);
  });

  it("rejects when total is missing", () => {
    expect(() =>
      validateReceiptTotals({
        ...validReceipt,
        total: null,
      }),
    ).toThrow(ApiError);
  });
});
