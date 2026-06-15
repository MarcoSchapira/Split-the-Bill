import { z } from "zod";

const nullableString = z.string().nullable();
const nullableNumber = z.number().nullable();

export const receiptItemSchema = z.object({
  name: z.string(),
  quantity: z.number(),
  unit_price: z.number(),
  total_price: z.number(),
});

export const parsedReceiptSchema = z.object({
  store_name: nullableString,
  store_address: nullableString,
  receipt_number: nullableString,
  date: nullableString,
  time: nullableString,
  items: z.array(receiptItemSchema),
  item_count: nullableNumber,
  subtotal: nullableNumber,
  tax: nullableNumber,
  tip: nullableNumber,
  total: nullableNumber,
  payment_method: nullableString,
  card_last_4: nullableString,
});

export type ParsedReceipt = z.infer<typeof parsedReceiptSchema>;
export type ReceiptItem = z.infer<typeof receiptItemSchema>;
