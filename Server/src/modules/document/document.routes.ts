import { Router } from "express";

import { uploadSingle } from "../../config/upload.js";
import { requireAuth } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import { loadWorkspaceMembership } from "../workspace/workspace.middleware.js";
import { documentController } from "./document.controller.js";

// Nested under workspaces so `workspaceId` stays in the URL and
// `loadWorkspaceMembership` can enforce isolation before RBAC:
//   requireAuth -> loadWorkspaceMembership -> requirePermission -> handler
// Mounted in app.ts as `/v1/workspaces/:workspaceId/documents`
// with `mergeParams: true` so `:workspaceId` survives here.
const router = Router({ mergeParams: true });

router.use(requireAuth);
router.use(loadWorkspaceMembership);

router.get(
  "/",
  requirePermission("workspace:view"),
  documentController.list,
);

router.post(
  "/",
  requirePermission("document:upload"),
  documentController.create,
);

router.post(
  "/upload",
  requirePermission("document:upload"),
  uploadSingle("file"),
  documentController.upload,
);

router.get(
  "/:documentId",
  requirePermission("workspace:view"),
  documentController.getOne,
);

router.patch(
  "/:documentId",
  requirePermission("document:upload"),
  documentController.update,
);

router.delete(
  "/:documentId",
  requirePermission("document:delete"),
  documentController.remove,
);

export default router;
