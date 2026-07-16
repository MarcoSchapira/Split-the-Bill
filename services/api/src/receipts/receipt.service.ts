import { parseReceiptWithGemini } from "./gemini.service";
import { logParseSuccess } from "./receipt.logger";
import { getReceiptTotalsDebug, validateReceiptTotals } from "./receipt.validation";
import type { ParsedReceipt } from "./receipt.types";

export async function parseReceiptImage(buffer: Buffer, mimeType: string): Promise<ParsedReceipt> {
  const startedAt = Date.now();
  const { receipt, extractionStrategy } = await parseReceiptWithGemini(buffer, mimeType);
  const validated = validateReceiptTotals(receipt);
  const debug = getReceiptTotalsDebug(validated);
  logParseSuccess({
    itemCount: validated.items.length,
    matchedItemsStrategy: debug.matchedItemsStrategy,
    extractionStrategy,
    durationMs: Date.now() - startedAt,
  });
  return validated;
}
