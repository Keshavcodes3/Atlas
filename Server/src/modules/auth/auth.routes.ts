import { Router } from "express";

import { AuthController } from "./auth.controller.js";
import { AuthRepository } from "./auth.repository.js";
import { AuthService } from "./auth.service.js";
import { AuthUtils } from "./auth.utils.js";
import { requireAuth } from "../../middleware/auth.js";

const router = Router();

const repository = new AuthRepository();
const utils = new AuthUtils();

const service = new AuthService(
  repository,
  utils,
);

const controller = new AuthController(
  service,
);

router.post(
  "/register",
  controller.register,
);

router.post(
  "/login",
  controller.login,
);

router.get(
  "/me",
  requireAuth,
  controller.me,
);

router.post(
  "/logout",
  controller.logout,
);

export default router;
