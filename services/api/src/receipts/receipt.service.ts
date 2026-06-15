import { parseReceiptWithGemini } from "./gemini.service";
import { validateReceiptTotals } from "./receipt.validation";
import type { ParsedReceipt } from "./receipt.types";

export async function parseReceiptImage(buffer: Buffer, mimeType: string): Promise<ParsedReceipt> {
  const receipt = await parseReceiptWithGemini(buffer, mimeType);
  return validateReceiptTotals(receipt);
}
