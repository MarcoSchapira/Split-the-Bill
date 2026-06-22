import { describe, expect, it } from "vitest";
import {
  EXPECTED_RECEIPT_KEYS,
  extractBalancedJsonObject,
  parseGeminiReceiptJson,
} from "./parse-gemini-json";

const sampleReceipt = {
  store_name: "RIVOLI",
  store_address: "332 QUEEN ST. W.",
  receipt_number: "775888",
  date: "2005-12-17",
  time: "6:22 PM",
  items: [
    { name: "Burger", quantity: 1, unit_price: 9.95, total_price: 9.95 },
  ],
  item_count: 1,
  subtotal: 9.95,
  other_fees: null,
  tax: 1.29,
  tip: 0,
  total: 11.24,
  payment_method: null,
  card_last_4: null,
};

describe("parseGeminiReceiptJson", () => {
  it("parses pure JSON via direct strategy", () => {
    const raw = JSON.stringify(sampleReceipt);
    const result = parseGeminiReceiptJson(raw);

    expect(result.strategy).toBe("direct");
    expect(result.parsed.subtotal).toBe(9.95);
    expect(result.parsed.total).toBe(11.24);
    expect(result.missingKeys).toEqual([]);
    expect(result.presentKeys).toEqual([...EXPECTED_RECEIPT_KEYS]);
  });

  it("parses markdown-fenced JSON", () => {
    const raw = "```json\n" + JSON.stringify(sampleReceipt) + "\n```";
    const result = parseGeminiReceiptJson(raw);

    expect(result.strategy).toBe("fenced");
    expect(result.rawTotals.subtotal).toBe(9.95);
    expect(result.rawTotals.total).toBe(11.24);
  });

  it("parses JSON with preamble and postamble via brace-balanced strategy", () => {
    const raw = `Here is the receipt:\n${JSON.stringify(sampleReceipt)}\nThanks!`;
    const result = parseGeminiReceiptJson(raw);

    expect(result.strategy).toBe("brace_balanced");
    expect(result.rawTotals.total).toBe(11.24);
  });

  it("parses array-wrapped JSON via array strategy", () => {
    const raw = JSON.stringify([sampleReceipt]);
    const result = parseGeminiReceiptJson(raw);

    expect(result.strategy).toBe("array");
    expect(result.parsed.store_name).toBe("RIVOLI");
  });

  it("preserves escaped newlines inside string values", () => {
    const payload = {
      ...sampleReceipt,
      store_address: "123 CULINARY AVENUE\nDOWNTOWN DISTRICT",
    };
    const result = parseGeminiReceiptJson(JSON.stringify(payload));

    expect(result.parsed.store_address).toBe("123 CULINARY AVENUE\nDOWNTOWN DISTRICT");
    expect(result.rawTotals.subtotal).toBe(9.95);
    expect(result.rawTotals.total).toBe(11.24);
  });

  it("does not truncate when a string value contains a closing brace", () => {
    const payload = {
      ...sampleReceipt,
      store_name: "Store } Name",
    };
    const raw = `prefix ${JSON.stringify(payload)} suffix`;
    const result = parseGeminiReceiptJson(raw);

    expect(result.strategy).toBe("brace_balanced");
    expect(result.parsed.store_name).toBe("Store } Name");
    expect(result.rawTotals.total).toBe(11.24);
  });

  it("reports missing keys without dropping present totals", () => {
    const partial = { subtotal: 9.95, other_fees: 0, tax: 1.29, total: 11.24, items: [] };
    const result = parseGeminiReceiptJson(JSON.stringify(partial));

    expect(result.rawTotals.subtotal).toBe(9.95);
    expect(result.rawTotals.total).toBe(11.24);
    expect(result.missingKeys.length).toBeGreaterThan(0);
    expect(result.missingKeys).toContain("store_name");
  });
});

describe("extractBalancedJsonObject", () => {
  it("extracts a complete object from surrounding text", () => {
    const inner = JSON.stringify({ subtotal: 1, other_fees: 0, total: 2 });
    const extracted = extractBalancedJsonObject(`noise ${inner} noise`);
    expect(JSON.parse(extracted)).toEqual({ subtotal: 1, other_fees: 0, total: 2 });
  });
});
