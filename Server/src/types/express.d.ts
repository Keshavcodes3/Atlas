import type { JwtPayload } from "../modules/auth/auth.utils.js";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export {};
