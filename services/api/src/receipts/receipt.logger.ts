import { sanitizeErrorForLog } from "../http/safeLogError";

const LOG_PREFIX = "[receipt-parse]";
const MAX_ZOD_ISSUES = 8;
const MAX_ZOD_MESSAGE_LENGTH = 120;

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
  const safe = sanitizeErrorForLog(error);
  log("error", `failed at ${stage}`, {
    name: safe.name,
    ...(safe.code ? { code: safe.code } : {}),
    message: safe.message,
    ...extra,
  });
}

export function logZodFailure(issues: { path: string; message: string }[]) {
  log("warn", "receipt schema validation failed", {
    issues: issues.slice(0, MAX_ZOD_ISSUES).map((issue) => ({
      path: issue.path.slice(0, 80),
      message: issue.message.slice(0, MAX_ZOD_MESSAGE_LENGTH),
    })),
    ...(issues.length > MAX_ZOD_ISSUES
      ? { truncatedIssueCount: issues.length - MAX_ZOD_ISSUES }
      : {}),
  });
}
