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
  other_fees: null,
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
  other_fees: null,
  tax: 3.8,
  tip: 0,
  total: 51.3,
  payment_method: "MASTERCARD",
  card_last_4: "9981",
};

const rivoliReceipt: ParsedReceipt = {
  store_name: "RIVOLI",
  store_address: "332 QUEEN ST. W.",
  receipt_number: "775888",
  date: "2005-12-17",
  time: "6:22 PM",
  items: [
    { name: "Rivoli Burger", quantity: 1, unit_price: 9.95, total_price: 9.95 },
    { name: "Bloody Caesar", quantity: 1, unit_price: 4.92, total_price: 4.92 },
    { name: "Dinner 2", quantity: 1, unit_price: 14.5, total_price: 14.5 },
    { name: "Amsterdam Blonde Draft", quantity: 3, unit_price: 4.06, total_price: 12.18 },
  ],
  item_count: 6,
  subtotal: 41.55,
  other_fees: null,
  tax: 6.38,
  tip: null,
  total: 48.13,
  payment_method: null,
  card_last_4: null,
};

const tackRoomReceipt: ParsedReceipt = {
  store_name: "The Tack Room",
  store_address: "145 Lincoln Road Lincoln, MA 01773",
  receipt_number: "36",
  date: "2024-04-08",
  time: "7:13 PM",
  items: [
    { name: "BBQ Potato Chips", quantity: 1, unit_price: 7, total_price: 7 },
    { name: "Diet Coke", quantity: 1, unit_price: 3, total_price: 3 },
    { name: "Trillium Fort Point", quantity: 1, unit_price: 10, total_price: 10 },
    { name: "Fried Chicken Sandwich", quantity: 2, unit_price: 17, total_price: 34 },
    { name: "Famous Duck Grilled Cheese", quantity: 1, unit_price: 25, total_price: 25 },
    { name: "Mac & Cheese", quantity: 1, unit_price: 17, total_price: 17 },
    { name: "Burger of the moment", quantity: 1, unit_price: 18, total_price: 18 },
  ],
  item_count: 8,
  subtotal: 114,
  other_fees: 3.42,
  tax: 7.11,
  tip: null,
  total: 124.53,
  payment_method: null,
  card_last_4: null,
};

describe("validateReceiptTotals", () => {
  it("accepts a receipt whose totals add up via total_price", () => {
    expect(validateReceiptTotals(validReceipt)).toEqual(validReceipt);
  });

  it("accepts subtotal equal to sum of per-line unit_price values", () => {
    expect(validateReceiptTotals(defineReceipt)).toEqual(defineReceipt);
  });

  it("accepts Rivoli receipt with 20 cent tax rounding on grand total", () => {
    expect(validateReceiptTotals(rivoliReceipt)).toEqual(rivoliReceipt);
  });

  it("accepts receipt with other fees included in the printed total", () => {
    expect(validateReceiptTotals(tackRoomReceipt)).toEqual(tackRoomReceipt);
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

  it("rejects when grand total is off by more than 25 cents", () => {
    expect(() =>
      validateReceiptTotals({
        ...validReceipt,
        total: 25.71,
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
