import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { signJwt, verifyJwt } from "./jwt";

const previousSecret = process.env.JWT_SECRET;
const previousExpiry = process.env.JWT_EXPIRES_IN;

describe("JWT helpers", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "jwt_unit_test_secret";
    process.env.JWT_EXPIRES_IN = "7d";
  });

  afterEach(() => {
    if (previousSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = previousSecret;
    }

    if (previousExpiry === undefined) {
      delete process.env.JWT_EXPIRES_IN;
    } else {
      process.env.JWT_EXPIRES_IN = previousExpiry;
    }
  });

  it("signs and verifies an internal user id", () => {
    const token = signJwt({ userId: "user-id" });

    expect(typeof token).toBe("string");
    expect(verifyJwt(token)).toEqual({ userId: "user-id" });
  });

  it("rejects an invalid token", () => {
    expect(() => verifyJwt("not-a-token")).toThrow();
  });

  it("rejects an expired token", () => {
    process.env.JWT_EXPIRES_IN = "-1s";
    const token = signJwt({ userId: "user-id" });

    expect(() => verifyJwt(token)).toThrow();
  });
});
