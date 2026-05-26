import { afterEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "./errors";

const previousNodeEnv = process.env.NODE_ENV;

function sendUnexpectedError(error: Error & { code?: string }) {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));

  errorHandler(error, {} as never, { status } as never, vi.fn());

  return { status, json };
}

describe("unexpected API errors", () => {
  afterEach(() => {
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
  });

  it("returns the underlying cause in development", () => {
    process.env.NODE_ENV = "development";
    const error = Object.assign(new Error("The column users.auth_provider does not exist"), {
      code: "P2022",
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { status, json } = sendUnexpectedError(error);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "P2022: The column users.auth_provider does not exist",
      },
    });
    consoleError.mockRestore();
  });

  it("keeps unexpected production failures generic", () => {
    process.env.NODE_ENV = "production";
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { json } = sendUnexpectedError(new Error("Database credentials leaked here"));

    expect(json).toHaveBeenCalledWith({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred",
      },
    });
    consoleError.mockRestore();
  });
});
