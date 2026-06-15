/**
 * Parse Gemini receipt JSON without mutating the payload.
 * Only trims leading/trailing whitespace on the outer string — internal newlines
 * inside JSON string values (e.g. store_address) are preserved.
 */
export function parseGeminiReceiptJson(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new SyntaxError("Gemini returned an empty response");
  }

  try {
    return JSON.parse(trimmed);
  } catch (firstError) {
    // Fallback: markdown-fenced JSON only (do not strip newlines from the body).
    const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
    if (fenced) {
      return JSON.parse(fenced[1].trim());
    }

    throw firstError;
  }
}
