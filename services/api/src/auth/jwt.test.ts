import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { signJwt, verifyJwt } from "./jwt";

const previousSecret = process.env.JWT_SECRET;
const previousAccessExpiry = process.env.ACCESS_TOKEN_EXPIRES_IN;
const previousExpiry = process.env.JWT_EXPIRES_IN;

describe("JWT helpers", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "jwt_unit_test_secret";
    process.env.ACCESS_TOKEN_EXPIRES_IN = "15m";
    process.env.JWT_EXPIRES_IN = "7d";
  });

  afterEach(() => {
    if (previousSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = previousSecret;
    }

    if (previousAccessExpiry === undefined) {
      delete process.env.ACCESS_TOKEN_EXPIRES_IN;
    } else {
      process.env.ACCESS_TOKEN_EXPIRES_IN = previousAccessExpiry;
    }

    if (previousExpiry === undefined) {
      delete process.env.JWT_EXPIRES_IN;
    } else {
      process.env.JWT_EXPIRES_IN = previousExpiry;
    }
  });

  it("signs and verifies an internal user id with session id", () => {
    const token = signJwt({ userId: "user-id", sessionId: "session-id" });

    expect(typeof token).toBe("string");
    expect(verifyJwt(token)).toEqual({ userId: "user-id", sessionId: "session-id" });
  });

  it("rejects tokens without a session id", () => {
    const token = jwt.sign({ userId: "user-id" }, process.env.JWT_SECRET!, {
      algorithm: "HS256",
    });

    expect(() => verifyJwt(token)).toThrow();
  });

  it("rejects an invalid token", () => {
    expect(() => verifyJwt("not-a-token")).toThrow();
  });

  it("rejects an expired token", () => {
    process.env.ACCESS_TOKEN_EXPIRES_IN = "-1s";
    const token = signJwt({ userId: "user-id", sessionId: "session-id" });

    expect(() => verifyJwt(token)).toThrow();
  });
});
