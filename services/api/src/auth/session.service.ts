import crypto from "crypto";
import type { PrismaClient } from "../generated/prisma/client";
import { prismaAdmin } from "../db/prisma";
import { ApiError } from "../http/errors";
import { refreshTokenMaxAgeMs } from "./cookies";
import { signJwt } from "./jwt";

export type SessionTokens = {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
};

function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function generateRefreshToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function createSession(
  userId: string,
  db: PrismaClient = prismaAdmin,
): Promise<SessionTokens> {
  const refreshToken = generateRefreshToken();
  const expiresAt = new Date(Date.now() + refreshTokenMaxAgeMs());

  const session = await db.session.create({
    data: {
      userId,
      refreshTokenHash: hashRefreshToken(refreshToken),
      expiresAt,
    },
  });

  const accessToken = signJwt({ userId, sessionId: session.id });

  return {
    accessToken,
    refreshToken,
    sessionId: session.id,
  };
}

export async function validateSession(sessionId: string, userId: string): Promise<boolean> {
  const session = await prismaAdmin.session.findFirst({
    where: {
      id: sessionId,
      userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  return session !== null;
}

export async function revokeSession(sessionId: string, userId?: string): Promise<void> {
  await prismaAdmin.session.updateMany({
    where: {
      id: sessionId,
      ...(userId ? { userId } : {}),
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });
}

export async function rotateSession(refreshToken: string): Promise<SessionTokens> {
  const refreshTokenHash = hashRefreshToken(refreshToken);

  const existingSession = await prismaAdmin.session.findFirst({
    where: { refreshTokenHash },
  });

  if (!existingSession) {
    throw new ApiError(401, "INVALID_REFRESH_TOKEN", "Invalid or expired refresh token");
  }

  if (existingSession.revokedAt !== null) {
    await revokeAllSessions(existingSession.userId);
    throw new ApiError(401, "INVALID_REFRESH_TOKEN", "Invalid or expired refresh token");
  }

  if (existingSession.expiresAt <= new Date()) {
    throw new ApiError(401, "INVALID_REFRESH_TOKEN", "Invalid or expired refresh token");
  }

  const consumed = await prismaAdmin.$executeRaw`
    UPDATE sessions
    SET revoked_at = NOW()
    WHERE refresh_token_hash = ${refreshTokenHash}
      AND revoked_at IS NULL
      AND expires_at > NOW()
  `;

  if (consumed === 0) {
    throw new ApiError(401, "INVALID_REFRESH_TOKEN", "Invalid or expired refresh token");
  }

  return createSession(existingSession.userId);
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await prismaAdmin.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeSessionByRefreshToken(refreshToken: string): Promise<void> {
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const session = await prismaAdmin.session.findFirst({
    where: { refreshTokenHash, revokedAt: null },
  });

  if (session) {
    await revokeSession(session.id);
  }
}
