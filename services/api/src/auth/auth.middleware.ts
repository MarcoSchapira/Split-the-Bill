import type { NextFunction, Request, Response } from "express";
import { prisma } from "../db/prisma";
import { ApiError } from "../http/errors";
import { safeUserSelect } from "./auth.types";
import { verifyJwt } from "./jwt";

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const authorization = req.header("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    next(new ApiError(401, "AUTHENTICATION_REQUIRED", "Authentication is required"));
    return;
  }

  let userId: string;

  try {
    userId = verifyJwt(match[1]).userId;
  } catch {
    next(new ApiError(401, "INVALID_TOKEN", "Invalid or expired authentication token"));
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: safeUserSelect,
  });

  if (!user) {
    next(new ApiError(401, "INVALID_TOKEN", "Invalid or expired authentication token"));
    return;
  }

  req.user = user;
  next();
}
