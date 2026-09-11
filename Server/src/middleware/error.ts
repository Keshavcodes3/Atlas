import {
  Request,
  Response,
  NextFunction,
} from "express";
import { ZodError } from "zod";

import { AppError } from "../lib/errors.js";

export function notFoundHandler(
  _req: Request,
  res: Response,
): void {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: "Route not found",
    },
  });
}

// Centralized error handler. Must be registered last via
// `app.use(errorHandler)` so Zod/auth/service errors all
// produce consistent JSON responses instead of 500s.
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request data",
        details: err.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined
          ? { details: err.details }
          : {}),
      },
    });
    return;
  }

  // Mongoose duplicate-key race (e.g. two concurrent registers).
  if (isMongoDuplicateKeyError(err)) {
    res.status(409).json({
      error: {
        code: "CONFLICT",
        message: "Resource already exists",
      },
    });
    return;
  }

  console.error(err);

  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Something went wrong",
    },
  });
}

function isMongoDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === 11000
  );
}
