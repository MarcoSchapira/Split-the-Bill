import { afterEach, describe, expect, it, vi } from "vitest";
import { safeLogError, sanitizeErrorForLog } from "./safeLogError";

describe("sanitizeErrorForLog", () => {
  it("keeps allowlisted Error fields only", () => {
    const error = Object.assign(new Error("Connection refused"), {
      code: "ECONNREFUSED",
      stack: "Error: Connection refused\n    at secret",
    });

    expect(sanitizeErrorForLog(error)).toEqual({
      name: "Error",
      code: "ECONNREFUSED",
      message: "Connection refused",
    });
  });

  it("redacts connection strings and bearer tokens from messages", () => {
    const error = new Error(
      "Failed postgres://user:hunter2@db.example.com:5432/app with Bearer eyJhbGciOiJIUzI1NiJ9.aaa.bbb",
    );

    const sanitized = sanitizeErrorForLog(error);

    expect(sanitized.message).not.toContain("hunter2");
    expect(sanitized.message).not.toContain("Bearer");
    expect(sanitized.message).not.toContain("eyJ");
    expect(sanitized.message).toContain("[REDACTED]");
  });

  it("uses the last non-empty message line for multiline errors", () => {
    const error = new Error("PrismaClientKnownRequestError\nThe column users.auth_provider does not exist");

    expect(sanitizeErrorForLog(error).message).toBe(
      "The column users.auth_provider does not exist",
    );
  });

  it("handles plain objects from SDKs", () => {
    expect(
      sanitizeErrorForLog({
        name: "application_error",
        message: "Unable to send email",
        statusCode: 500,
      }),
    ).toEqual({
      name: "application_error",
      message: "Unable to send email",
    });
  });

  it("truncates long messages", () => {
    const message = "x".repeat(250);
    expect(sanitizeErrorForLog(new Error(message)).message.length).toBeLessThanOrEqual(201);
  });
});

describe("safeLogError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs context with sanitized payload instead of the raw error", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = Object.assign(new Error("password=super-secret boom"), {
      code: "AUTH",
    });

    safeLogError("Unexpected API error", error);

    expect(consoleError).toHaveBeenCalledWith("Unexpected API error", {
      name: "Error",
      code: "AUTH",
      message: expect.stringContaining("[REDACTED]"),
    });
    expect(consoleError.mock.calls[0]?.[1]).not.toHaveProperty("stack");
  });
});
