export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(
    statusCode: number,
    message: string,
    code = "INTERNAL_ERROR",
    details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static badRequest(
    message: string,
    details?: unknown,
  ): AppError {
    return new AppError(400, message, "BAD_REQUEST", details);
  }

  static unauthorized(
    message = "Unauthorized",
  ): AppError {
    return new AppError(401, message, "UNAUTHORIZED");
  }

  static forbidden(message = "Forbidden"): AppError {
    return new AppError(403, message, "FORBIDDEN");
  }

  static notFound(
    message = "Not found",
  ): AppError {
    return new AppError(404, message, "NOT_FOUND");
  }

  static conflict(message: string): AppError {
    return new AppError(409, message, "CONFLICT");
  }
}
