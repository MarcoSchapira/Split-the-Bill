import { parseReceiptWithGemini } from "./gemini.service";
import { parsedReceiptSchema, type ParsedReceipt } from "./receipt.types";

const HARDCODED_RECEIPT: ParsedReceipt = {
  store_name: "Store Name",
  store_address: "123 Main St",
  receipt_number: "123456",
  date: "2026-06-12",
  time: "6:42 PM",
  items: [
    {
      name: "Item Name",
      quantity: 2,
      unit_price: 4.99,
      total_price: 9.98,
    },
    {
      name: "Another Item",
      quantity: 1,
      unit_price: 12.5,
      total_price: 12.5,
    },
  ],
  item_count: 3,
  subtotal: 22.48,
  tax: 2.92,
  tip: 0.0,
  total: 25.4,
  payment_method: "Visa",
  card_last_4: "1234",
};

function useHardcodedReceipt(): boolean {
  const flag = process.env.USE_HARDCODED_RECEIPT;
  if (flag === undefined) {
    return true;
  }
  return flag === "true" || flag === "1";
}

export async function parseReceiptImage(buffer: Buffer, mimeType: string): Promise<ParsedReceipt> {
  if (useHardcodedReceipt()) {
    return parsedReceiptSchema.parse(HARDCODED_RECEIPT);
  }

  return parseReceiptWithGemini(buffer, mimeType);
}
