import {
  Request,
  Response,
  NextFunction,
} from "express";

import {
  loginSchema,
  registerSchema,
} from "./auth.schema.js";

import { AuthService } from "./auth.service.js";
import {
  clearAuthCookie,
  setAuthCookie,
} from "./auth.cookies.js";

export class AuthController {
  constructor(
    private readonly service: AuthService,
  ) {}

  register = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const input =
        registerSchema.parse(req.body);

      const result =
        await this.service.register(input);

      setAuthCookie(res, result.token);

      return res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  login = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const input =
        loginSchema.parse(req.body);

      const result =
        await this.service.login(input);

      setAuthCookie(res, result.token);

      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  me = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      if (!req.user) {
        return res
          .status(401)
          .json({
            message: "Unauthorized",
          });
      }

      const user =
        await this.service.getUser(
          req.user.userId,
        );

      return res.json({ user });
    } catch (error) {
      next(error);
    }
  };

  logout = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      clearAuthCookie(res);

      return res.json({ message: "Logged out" });
    } catch (error) {
      next(error);
    }
  };
}
