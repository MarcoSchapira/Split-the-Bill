import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../http/errors";
import { ACCESS_COOKIE, CSRF_COOKIE, REFRESH_COOKIE } from "./cookies";

const CSRF_EXEMPT_PATHS = new Set([
  "/auth/login",
  "/auth/register",
  "/auth/register/send-code",
  "/health",
]);

function hasBearerAuth(req: Request): boolean {
  return /^Bearer\s+.+/i.test(req.header("authorization") ?? "");
}

export function requireCsrf(req: Request, _res: Response, next: NextFunction): void {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    next();
    return;
  }

  if (CSRF_EXEMPT_PATHS.has(req.path)) {
    next();
    return;
  }

  if (hasBearerAuth(req)) {
    next();
    return;
  }

  const hasAuthCookie =
    Boolean(req.cookies?.[ACCESS_COOKIE]) || Boolean(req.cookies?.[REFRESH_COOKIE]);

  if (!hasAuthCookie) {
    next();
    return;
  }

  const csrfCookie = req.cookies?.[CSRF_COOKIE] as string | undefined;
  const csrfHeader = req.header("x-csrf-token");

  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    next(new ApiError(403, "CSRF_VALIDATION_FAILED", "CSRF validation failed"));
    return;
  }

  next();
}
