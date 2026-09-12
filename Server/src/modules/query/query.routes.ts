import { Router } from "express";

import { requireAuth } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import { loadWorkspaceMembership } from "../workspace/workspace.middleware.js";
import { queryController } from "./query.controller.js";

// Mounted as /v1/workspaces/:workspaceId/query — same isolation chain
// as documents: requireAuth -> loadWorkspaceMembership -> requirePermission.
const router = Router({ mergeParams: true });

router.use(requireAuth);
router.use(loadWorkspaceMembership);

router.post(
  "/",
  requirePermission("knowledge:query"),
  queryController.ask,
);

export default router;
