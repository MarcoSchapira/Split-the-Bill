import type { NextFunction, Request, Response } from "express";
import { withUserContext } from "../db/userContext";
import { ApiError } from "../http/errors";
import { authenticatedUserSelect } from "./auth.types";
import { ACCESS_COOKIE } from "./cookies";
import { verifyJwt } from "./jwt";
import { validateSession } from "./session.service";

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const accessCookie = req.cookies?.[ACCESS_COOKIE] as string | undefined;
  const authorization = req.header("authorization");
  const bearerMatch = authorization?.match(/^Bearer\s+(.+)$/i);

  let token: string | undefined;
  let authSource: "cookie" | "bearer" | undefined;

  if (accessCookie) {
    token = accessCookie;
    authSource = "cookie";
  } else if (bearerMatch) {
    token = bearerMatch[1];
    authSource = "bearer";
  }

  if (!token || !authSource) {
    next(new ApiError(401, "AUTHENTICATION_REQUIRED", "Authentication is required"));
    return;
  }

  let payload;

  try {
    payload = verifyJwt(token);
  } catch {
    next(new ApiError(401, "INVALID_TOKEN", "Invalid or expired authentication token"));
    return;
  }

  const isValidSession = await validateSession(payload.sessionId, payload.userId);
  if (!isValidSession) {
    next(new ApiError(401, "INVALID_TOKEN", "Invalid or expired authentication token"));
    return;
  }

  try {
    const user = await withUserContext(payload.userId, (tx) =>
      tx.user.findUnique({
        where: { id: payload.userId },
        select: { ...authenticatedUserSelect, authProvider: true },
      }),
    );

    if (!user || user.authProvider === "deleted") {
      next(new ApiError(401, "INVALID_TOKEN", "Invalid or expired authentication token"));
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      aiReceiptConsentAt: user.aiReceiptConsentAt,
    };
    req.sessionId = payload.sessionId;
    req.authSource = authSource;
    next();
  } catch {
    next(new ApiError(401, "INVALID_TOKEN", "Invalid or expired authentication token"));
  }
}
