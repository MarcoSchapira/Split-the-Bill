import type { GeminiJsonExtractionResult } from "./parse-gemini-json";
import type { ParsedReceipt } from "./receipt.types";
import type { ReceiptTotalsDebug } from "./receipt.validation";

const LOG_PREFIX = "[receipt-parse]";

function log(level: "info" | "warn" | "error", message: string, data?: Record<string, unknown>) {
  const payload = data ? `${message} ${JSON.stringify(data)}` : message;
  console[level](`${LOG_PREFIX} ${payload}`);
}

export function logParseRequest(input: {
  userId?: string;
  mimeType: string;
  imageBytes: number;
}) {
  log("info", "parse request received", input);
}

export function logGeminiRawResponse(input: {
  mimeType: string;
  responseLength: number;
  responsePreview: string;
  extractionStrategy?: string;
}) {
  log("info", "gemini raw response", input);
}

export function logJsonExtraction(result: GeminiJsonExtractionResult) {
  log("info", "json extraction", {
    extractionStrategy: result.strategy,
    presentKeys: result.presentKeys,
    missingKeys: result.missingKeys,
    rawTotals: result.rawTotals,
  });
}

export function logGeminiParsedReceipt(receipt: ParsedReceipt) {
  log("info", "gemini parsed receipt", {
    store_name: receipt.store_name,
    store_address: receipt.store_address,
    receipt_number: receipt.receipt_number,
    date: receipt.date,
    time: receipt.time,
    item_count: receipt.item_count,
    itemCount: receipt.items.length,
    subtotal: receipt.subtotal,
    tax: receipt.tax,
    tip: receipt.tip,
    total: receipt.total,
    payment_method: receipt.payment_method,
    card_last_4: receipt.card_last_4,
    itemsSumTotalPrice: receipt.items.reduce((sum, item) => sum + item.total_price, 0),
    itemsSumUnitPrice: receipt.items.reduce((sum, item) => sum + item.unit_price, 0),
    items: receipt.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price,
    })),
  });
}

export function logValidationFailure(debug: ReceiptTotalsDebug) {
  log("warn", "receipt totals validation failed", debug as unknown as Record<string, unknown>);
}

export function logParseSuccess(input: {
  store_name: string | null;
  itemCount: number;
  subtotal: number | null;
  tax: number | null;
  tip: number | null;
  total: number | null;
  matchedItemsStrategy?: string | null;
  extractionStrategy?: string;
}) {
  log("info", "parse succeeded", input);
}

export function logParseError(stage: string, error: unknown, extra?: Record<string, unknown>) {
  const message = error instanceof Error ? error.message : String(error);
  log("error", `failed at ${stage}`, { message, ...extra });
}

export function logZodFailure(issues: { path: string; message: string }[]) {
  log("warn", "receipt schema validation failed", { issues });
}
