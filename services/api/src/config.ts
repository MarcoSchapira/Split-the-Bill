const EXAMPLE_JWT_SECRET = "dev_secret_change_later";

export function assertProductionConfiguration(): void {
  const nodeEnv = process.env.NODE_ENV;

  if (nodeEnv !== "production") {
    return;
  }

  const jwtSecret = process.env.JWT_SECRET ?? "";

  if (jwtSecret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters in production");
  }

  if (jwtSecret === EXAMPLE_JWT_SECRET) {
    throw new Error("JWT_SECRET must not use the example default in production");
  }

  if (!process.env.WEB_ORIGIN) {
    throw new Error("WEB_ORIGIN is required in production");
  }

  if (!process.env.DIRECT_URL) {
    throw new Error("DIRECT_URL is required in production");
  }

  if (process.env.DIRECT_URL === process.env.DATABASE_URL) {
    throw new Error("DIRECT_URL must differ from DATABASE_URL in production");
  }

  if (process.env.ALLOW_AUTH_TOKEN_RESPONSE === "true") {
    throw new Error("ALLOW_AUTH_TOKEN_RESPONSE must not be enabled in production");
  }

  if (process.env.COOKIE_SECURE === "false") {
    console.warn("WARNING: COOKIE_SECURE is false in production");
  }

  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is required in production");
  }

  if (!process.env.EMAIL_FROM) {
    throw new Error("EMAIL_FROM is required in production");
  }
}

export function getWebOrigin(): string {
  return process.env.WEB_ORIGIN ?? "http://localhost:5173";
}

export function shouldTrustProxy(): boolean {
  return process.env.TRUST_PROXY === "true";
}
