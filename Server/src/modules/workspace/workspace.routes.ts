import { Router } from "express";

import { requireAuth } from "../../middleware/auth.js";
import {
  requirePermission,
  requireRole,
} from "../../middleware/rbac.js";
import { workspaceController } from "./workspace.controller.js";
import { loadWorkspaceMembership } from "./workspace.middleware.js";

const router = Router();

// All workspace routes require a logged-in user.
router.use(requireAuth);

router.post("/", workspaceController.create);
router.get("/", workspaceController.listMine);

router.get(
  "/:workspaceId/members",
  loadWorkspaceMembership,
  requirePermission("workspace:view"),
  workspaceController.listMembers,
);

router.post(
  "/:workspaceId/members",
  loadWorkspaceMembership,
  requirePermission("member:manage"),
  workspaceController.addMember,
);

router.patch(
  "/:workspaceId/members/:memberUserId",
  loadWorkspaceMembership,
  requirePermission("member:manage"),
  workspaceController.updateMemberRole,
);

router.delete(
  "/:workspaceId/members/:memberUserId",
  loadWorkspaceMembership,
  requirePermission("workspace:view"),
  workspaceController.removeMember,
);

router.get(
  "/:workspaceId",
  loadWorkspaceMembership,
  requirePermission("workspace:view"),
  workspaceController.getOne,
);

router.patch(
  "/:workspaceId",
  loadWorkspaceMembership,
  requireRole("OWNER"),
  workspaceController.update,
);

router.delete(
  "/:workspaceId",
  loadWorkspaceMembership,
  requireRole("OWNER"),
  workspaceController.remove,
);

export default router;
