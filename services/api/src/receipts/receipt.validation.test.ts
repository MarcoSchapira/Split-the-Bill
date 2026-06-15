import { describe, expect, it } from "vitest";
import { ApiError } from "../http/errors";
import { parseGeminiReceiptJson } from "./parse-gemini-json";
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

const defineReceipt: ParsedReceipt = {
  store_name: "DINEFINE RESTAURANT",
  store_address: "123 CULINARY AVENUE\nDOWNTOWN DISTRICT",
  receipt_number: "#R-2547",
  date: "2025-09-30",
  time: "20:15",
  items: [
    { name: "CAESAR SALAD", quantity: 2, unit_price: 12, total_price: 24 },
    { name: "GRILLED SALMON", quantity: 1, unit_price: 22, total_price: 22 },
    { name: "CHEESECAKE", quantity: 1, unit_price: 7.5, total_price: 7.5 },
    { name: "SPARKLING WATER", quantity: 2, unit_price: 3, total_price: 6 },
  ],
  item_count: 6,
  subtotal: 47.5,
  tax: 3.8,
  tip: 0,
  total: 51.3,
  payment_method: "MASTERCARD",
  card_last_4: "9981",
};

describe("parseGeminiReceiptJson", () => {
  it("preserves escaped newlines inside string values", () => {
    const parsed = parseGeminiReceiptJson(
      '{"store_address":"123 CULINARY AVENUE\\nDOWNTOWN DISTRICT","subtotal":47.5,"total":51.3}',
    ) as { store_address: string; subtotal: number; total: number };

    expect(parsed.store_address).toBe("123 CULINARY AVENUE\nDOWNTOWN DISTRICT");
    expect(parsed.subtotal).toBe(47.5);
    expect(parsed.total).toBe(51.3);
  });
});

describe("validateReceiptTotals", () => {
  it("accepts a receipt whose totals add up via total_price", () => {
    expect(validateReceiptTotals(validReceipt)).toEqual(validReceipt);
  });

  it("accepts subtotal equal to sum of per-line unit_price values", () => {
    expect(validateReceiptTotals(defineReceipt)).toEqual(defineReceipt);
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

  it("rejects when no item sum strategy matches subtotal", () => {
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
