import type { Response } from "express";
import crypto from "crypto";

export const ACCESS_COOKIE = "equisplit_access";
export const REFRESH_COOKIE = "equisplit_refresh";
export const CSRF_COOKIE = "equisplit_csrf";

function cookieSecure(): boolean {
  if (process.env.COOKIE_SECURE !== undefined) {
    return process.env.COOKIE_SECURE === "true";
  }

  return process.env.NODE_ENV === "production";
}

function cookieSameSite(): "strict" | "lax" | "none" {
  const value = process.env.COOKIE_SAME_SITE ?? "lax";
  if (value === "strict" || value === "none") {
    return value;
  }
  return "lax";
}

function baseCookieOptions(maxAgeMs: number) {
  return {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: cookieSameSite(),
    maxAge: maxAgeMs,
    path: "/",
  } as const;
}

export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string,
  accessMaxAgeMs: number,
  refreshMaxAgeMs: number,
  csrfToken: string,
): void {
  res.cookie(ACCESS_COOKIE, accessToken, baseCookieOptions(accessMaxAgeMs));
  res.cookie(REFRESH_COOKIE, refreshToken, baseCookieOptions(refreshMaxAgeMs));
  res.cookie(CSRF_COOKIE, csrfToken, {
    ...baseCookieOptions(refreshMaxAgeMs),
    httpOnly: false,
  });
}

export function clearAuthCookies(res: Response): void {
  const options = {
    path: "/",
    secure: cookieSecure(),
    sameSite: cookieSameSite(),
  };

  res.clearCookie(ACCESS_COOKIE, options);
  res.clearCookie(REFRESH_COOKIE, { ...options, httpOnly: true });
  res.clearCookie(CSRF_COOKIE, { ...options, httpOnly: false });
}

export function parseDurationMs(value: string, fallbackMs: number): number {
  const match = value.trim().match(/^(\d+)([smhd])$/i);
  if (!match) {
    return fallbackMs;
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };

  return amount * (multipliers[unit] ?? fallbackMs);
}

export function accessTokenMaxAgeMs(): number {
  return parseDurationMs(
    process.env.ACCESS_TOKEN_EXPIRES_IN ?? process.env.JWT_EXPIRES_IN ?? "15m",
    900_000,
  );
}

export function refreshTokenMaxAgeMs(): number {
  return parseDurationMs(process.env.REFRESH_TOKEN_EXPIRES_IN ?? "30d", 2_592_000_000);
}
