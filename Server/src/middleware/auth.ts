import {
  Request,
  Response,
  NextFunction,
} from "express";

import { AppError } from "../lib/errors.js";
import { AuthUtils } from "../modules/auth/auth.utils.js";

const authUtils = new AuthUtils();

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return null;
  }

  const token = header.slice("Bearer ".length).trim();

  return token.length > 0 ? token : null;
}

// Verifies the JWT from `Authorization: Bearer <token>` and
// attaches the payload as `req.user`. Use on every route that
// requires a logged-in user (e.g. GET /v1/auth/me).
export function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const token = extractBearerToken(req);

  if (!token) {
    next(
      AppError.unauthorized(
        "Missing or malformed Authorization header",
      ),
    );
    return;
  }

  try {
    req.user = authUtils.verifyToken(token);
    next();
  } catch {
    next(
      AppError.unauthorized("Invalid or expired token"),
    );
  }
}
