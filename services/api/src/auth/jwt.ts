import jwt, { type SignOptions } from "jsonwebtoken";

export type JwtPayload = {
  userId: string;
  sessionId: string;
};

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is missing");
  }

  return secret;
}

export function assertJwtConfiguration(): void {
  getJwtSecret();
}

function getAccessExpiresIn(): SignOptions["expiresIn"] {
  return (process.env.ACCESS_TOKEN_EXPIRES_IN ??
    process.env.JWT_EXPIRES_IN ??
    "15m") as SignOptions["expiresIn"];
}

export function signJwt(payload: JwtPayload): string {
  return jwt.sign(payload, getJwtSecret(), { algorithm: "HS256", expiresIn: getAccessExpiresIn() });
}

export function verifyJwt(token: string): JwtPayload {
  const payload = jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] });

  if (
    typeof payload === "string" ||
    typeof payload.userId !== "string" ||
    typeof payload.sessionId !== "string"
  ) {
    throw new Error("Invalid JWT payload");
  }

  return {
    userId: payload.userId,
    sessionId: payload.sessionId,
  };
}
