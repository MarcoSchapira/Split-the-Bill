import type { Request } from "express";
import { ApiError } from "../http/errors";
import type { AuthenticatedUser } from "./auth.types";

export function currentUser(req: Request): AuthenticatedUser {
  if (!req.user) {
    throw new ApiError(401, "AUTHENTICATION_REQUIRED", "Authentication is required");
  }

  return req.user;
}
