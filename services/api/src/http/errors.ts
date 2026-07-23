import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { safeLogError } from "./safeLogError";

type ValidationIssue = {
  path: string;
  message: string;
};

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly issues?: ValidationIssue[],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new ApiError(404, "NOT_FOUND", "Resource not found"));
};

function developmentErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Unknown server error";
  }

  const code =
    "code" in error && typeof error.code === "string" ? `${error.code}: ` : "";
  const messageLines = error.message
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const message = messageLines[messageLines.length - 1] ?? error.message;

  return `${code}${message}`;
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request body",
        issues: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
    });
    return;
  }

  if (error instanceof ApiError) {
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.issues ? { issues: error.issues } : {}),
      },
    });
    return;
  }

  safeLogError("Unexpected API error", error);
  const message =
    process.env.NODE_ENV === "production"
      ? "An unexpected error occurred"
      : developmentErrorMessage(error);

  res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message,
    },
  });
};
