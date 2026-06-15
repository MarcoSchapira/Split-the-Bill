import { parseReceiptWithGemini } from "./gemini.service";
import { logParseSuccess } from "./receipt.logger";
import { getReceiptTotalsDebug, validateReceiptTotals } from "./receipt.validation";
import type { ParsedReceipt } from "./receipt.types";

export async function parseReceiptImage(buffer: Buffer, mimeType: string): Promise<ParsedReceipt> {
  const receipt = await parseReceiptWithGemini(buffer, mimeType);
  const validated = validateReceiptTotals(receipt);
  const debug = getReceiptTotalsDebug(validated);
  logParseSuccess({
    store_name: validated.store_name,
    itemCount: validated.items.length,
    total: validated.total,
    matchedItemsStrategy: debug.matchedItemsStrategy,
  });
  return validated;
}
