import jwt, { type SignOptions } from "jsonwebtoken";

export type JwtPayload = {
  userId: string;
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

export function signJwt(payload: JwtPayload): string {
  const expiresIn = (process.env.JWT_EXPIRES_IN ?? "7d") as SignOptions["expiresIn"];

  return jwt.sign(payload, getJwtSecret(), { algorithm: "HS256", expiresIn });
}

export function verifyJwt(token: string): JwtPayload {
  const payload = jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] });

  if (typeof payload === "string" || typeof payload.userId !== "string") {
    throw new Error("Invalid JWT payload");
  }

  return { userId: payload.userId };
}
