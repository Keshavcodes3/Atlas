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
}
