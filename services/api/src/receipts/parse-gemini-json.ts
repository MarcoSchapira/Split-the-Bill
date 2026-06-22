export type ExtractionStrategy = "direct" | "fenced" | "brace_balanced" | "array";

export const EXPECTED_RECEIPT_KEYS = [
  "store_name",
  "store_address",
  "receipt_number",
  "date",
  "time",
  "items",
  "item_count",
  "subtotal",
  "other_fees",
  "tax",
  "tip",
  "total",
  "payment_method",
  "card_last_4",
] as const;

export type GeminiJsonExtractionResult = {
  strategy: ExtractionStrategy;
  parsed: Record<string, unknown>;
  presentKeys: string[];
  missingKeys: string[];
  rawTotals: {
    subtotal: unknown;
    other_fees: unknown;
    tax: unknown;
    tip: unknown;
    total: unknown;
  };
};

function asObject(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new SyntaxError("Gemini response is not a JSON object");
}

function checkCompleteness(parsed: Record<string, unknown>): Pick<
  GeminiJsonExtractionResult,
  "presentKeys" | "missingKeys" | "rawTotals"
> {
  const presentKeys = EXPECTED_RECEIPT_KEYS.filter((key) => key in parsed);
  const missingKeys = EXPECTED_RECEIPT_KEYS.filter((key) => !(key in parsed));

  return {
    presentKeys: [...presentKeys],
    missingKeys: [...missingKeys],
    rawTotals: {
      subtotal: parsed.subtotal ?? null,
      other_fees: parsed.other_fees ?? null,
      tax: parsed.tax ?? null,
      tip: parsed.tip ?? null,
      total: parsed.total ?? null,
    },
  };
}

function buildResult(
  strategy: ExtractionStrategy,
  parsed: unknown,
): GeminiJsonExtractionResult {
  const object = asObject(parsed);
  return {
    strategy,
    parsed: object,
    ...checkCompleteness(object),
  };
}

function extractFencedJson(text: string): string | null {
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  return fenced ? fenced[1].trim() : null;
}

/**
 * Extract a complete top-level JSON object using string-aware brace counting.
 */
export function extractBalancedJsonObject(text: string): string {
  const start = text.indexOf("{");
  if (start === -1) {
    throw new SyntaxError("No JSON object found");
  }

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      if (escape) {
        escape = false;
      } else if (char === "\\") {
        escape = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      depth++;
    } else if (char === "}") {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  throw new SyntaxError("Unclosed JSON object");
}

function tryParseObject(text: string): unknown {
  const parsed = JSON.parse(text);
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) {
      throw new SyntaxError("Gemini returned an empty JSON array");
    }
    return parsed[0];
  }
  return parsed;
}

/**
 * Parse Gemini receipt JSON using a strategy chain. Never strips internal newlines
 * from string values — only trims outer whitespace on the input.
 */
export function parseGeminiReceiptJson(raw: string): GeminiJsonExtractionResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new SyntaxError("Gemini returned an empty response");
  }

  // Strategy A — direct parse
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) {
        throw new SyntaxError("Gemini returned an empty JSON array");
      }
      return buildResult("array", parsed[0]);
    }
    return buildResult("direct", parsed);
  } catch {
    // continue to fallbacks
  }

  // Strategy B — markdown fence unwrap
  const fencedBody = extractFencedJson(trimmed);
  if (fencedBody) {
    try {
      const parsed = tryParseObject(fencedBody);
      const strategy: ExtractionStrategy = fencedBody.trimStart().startsWith("[") ? "array" : "fenced";
      return buildResult(strategy, parsed);
    } catch {
      // continue to fallbacks
    }
  }

  // Strategy C — brace-balanced object extraction (handles preamble/postamble)
  try {
    const balanced = extractBalancedJsonObject(trimmed);
    const parsed = tryParseObject(balanced);
    return buildResult("brace_balanced", parsed);
  } catch {
    // continue to fallbacks
  }

  // Strategy D — array wrapper fallback from first '['
  const arrayStart = trimmed.indexOf("[");
  if (arrayStart !== -1) {
    try {
      const parsed = JSON.parse(trimmed.slice(arrayStart));
      if (Array.isArray(parsed) && parsed.length > 0) {
        return buildResult("array", parsed[0]);
      }
    } catch {
      // fall through
    }
  }

  throw new SyntaxError("Unable to extract valid receipt JSON from Gemini response");
}
