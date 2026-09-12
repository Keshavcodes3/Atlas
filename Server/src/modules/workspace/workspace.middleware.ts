import type { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";

import { AppError } from "../../lib/errors.js";
import type { Role } from "../../middleware/rbac.js";
import { normalizeRole } from "./workspace.repo.js";
import { WorkspaceModel } from "./workspace.schema.js";


export async function loadWorkspaceMembership(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      next(AppError.unauthorized("Authentication required"));
      return;
    }

    const workspaceId = resolveWorkspaceId(req);
    if (!workspaceId) {
      next(AppError.badRequest("workspaceId is required"));
      return;
    }

    if (!Types.ObjectId.isValid(workspaceId)) {
      next(AppError.notFound("Workspace not found"));
      return;
    }

    const workspace = await WorkspaceModel.findById(workspaceId).exec();
    if (!workspace) {
      next(AppError.notFound("Workspace not found"));
      return;
    }

    const role = roleOfWorkspace(
      String(workspace.ownerId),
      workspace.members.map((m) => ({
        userId: String(m.userId),
        role: normalizeRole(m.role),
      })),
      req.user.userId,
    );

    if (!role) {
      next(
        AppError.forbidden(
          "You are not a member of this workspace",
        ),
      );
      return;
    }

    req.membership = {
      workspaceId: String(workspace._id),
      userId: req.user.userId,
      role,
    };
    // Attach for handlers that need workspace fields without refetching.
    (req as Request & { workspace?: typeof workspace }).workspace =
      workspace;

    next();
  } catch (error) {
    next(error);
  }
}

function resolveWorkspaceId(req: Request): string | null {
  const params = req.params as Record<string, unknown>;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const query = req.query as Record<string, unknown>;

  const candidates = [
    params["workspaceId"],
    params["id"],
    params["workspace_id"],
    body["workspaceId"],
    query["workspaceId"],
    req.headers["x-workspace-id"],
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
}

function roleOfWorkspace(
  ownerId: string,
  members: Array<{ userId: string; role: Role }>,
  userId: string,
): Role | null {
  if (ownerId === userId) return "OWNER";
  return members.find((m) => m.userId === userId)?.role ?? null;
}
