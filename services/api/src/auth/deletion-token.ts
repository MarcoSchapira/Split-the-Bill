import jwt from "jsonwebtoken";
import { ApiError } from "../http/errors";

const DELETION_TOKEN_PURPOSE = "account_deletion";
const DELETION_TOKEN_TTL = "15m";

export type DeletionTokenPayload = {
  userId: string;
  email: string;
};

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is missing");
  }

  return secret;
}

export function signDeletionToken(payload: DeletionTokenPayload): string {
  return jwt.sign({ ...payload, purpose: DELETION_TOKEN_PURPOSE }, getJwtSecret(), {
    algorithm: "HS256",
    expiresIn: DELETION_TOKEN_TTL,
  });
}

export function verifyDeletionToken(token: string): DeletionTokenPayload {
  let payload: string | jwt.JwtPayload;

  try {
    payload = jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] });
  } catch {
    throw new ApiError(400, "DELETION_TOKEN_INVALID", "Deletion request is invalid or expired");
  }

  if (
    typeof payload === "string" ||
    payload.purpose !== DELETION_TOKEN_PURPOSE ||
    typeof payload.userId !== "string" ||
    typeof payload.email !== "string"
  ) {
    throw new ApiError(400, "DELETION_TOKEN_INVALID", "Deletion request is invalid or expired");
  }

  return {
    userId: payload.userId,
    email: payload.email,
  };
}
