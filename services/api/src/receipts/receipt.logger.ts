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

export function logValidationFailure(input: {
  reason: string;
  itemCount: number;
  matchedItemsStrategy: string | null;
}) {
  log("warn", "receipt totals validation failed", input);
}

export function logParseSuccess(input: {
  itemCount: number;
  extractionStrategy?: string;
  matchedItemsStrategy?: string | null;
  durationMs: number;
}) {
  log("info", "parse succeeded", input);
}

export function logParseError(
  stage: string,
  error: unknown,
  extra?: {
    mimeType?: string;
    modelName?: string;
    durationMs?: number;
  },
) {
  const message = error instanceof Error ? error.message : String(error);
  log("error", `failed at ${stage}`, { message, ...extra });
}

export function logZodFailure(issues: { path: string; message: string }[]) {
  log("warn", "receipt schema validation failed", { issues });
}
