const MAX_MESSAGE_LENGTH = 200;

const SENSITIVE_PATTERNS: RegExp[] = [
  // Connection strings and URLs with credentials
  /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp|https?):\/\/[^\s"']+/gi,
  // Bearer / JWT-looking tokens
  /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  // Common secret env-style assignments that may appear in driver errors
  /\b(?:password|passwd|pwd|api[_-]?key|secret|token|authorization)\s*[:=]\s*[^\s"',;]+/gi,
];

export type SafeErrorLog = {
  name: string;
  code?: string;
  message: string;
};

function truncate(value: string, max = MAX_MESSAGE_LENGTH): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max)}…`;
}

function redact(value: string): string {
  let next = value;
  for (const pattern of SENSITIVE_PATTERNS) {
    next = next.replace(pattern, "[REDACTED]");
  }
  return next;
}

function readCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined;
  }

  const code = (error as { code?: unknown }).code;
  if (typeof code === "string" && code.trim()) {
    return truncate(code.trim(), 64);
  }
  if (typeof code === "number" && Number.isFinite(code)) {
    return String(code);
  }
  return undefined;
}

/**
 * Allowlisted diagnostic fields for production logs.
 * Never returns stacks, request bodies, cookies, or full SDK payloads.
 */
export function sanitizeErrorForLog(error: unknown): SafeErrorLog {
  if (error instanceof Error) {
    const messageLines = error.message
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const rawMessage = messageLines[messageLines.length - 1] ?? error.message;
    const code = readCode(error);

    return {
      name: truncate(error.name || "Error", 64),
      ...(code ? { code } : {}),
      message: truncate(redact(rawMessage)),
    };
  }

  if (typeof error === "object" && error !== null) {
    const record = error as { name?: unknown; message?: unknown };
    const name =
      typeof record.name === "string" && record.name.trim()
        ? truncate(record.name.trim(), 64)
        : "Error";
    const message =
      typeof record.message === "string" && record.message.trim()
        ? truncate(redact(record.message.trim()))
        : "Unknown error";
    const code = readCode(error);

    return {
      name,
      ...(code ? { code } : {}),
      message,
    };
  }

  return {
    name: "Error",
    message: truncate(redact(String(error))),
  };
}

export function safeLogError(context: string, error: unknown): void {
  console.error(context, sanitizeErrorForLog(error));
}
