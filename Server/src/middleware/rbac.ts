import {
  Request,
  Response,
  NextFunction,
} from "express";

import { AppError } from "../lib/errors.js";

export type Role = "OWNER" | "EDITOR" | "VIEWER";

export type Permission =
  | "workspace:view"
  | "knowledge:query"
  | "document:upload"
  | "document:delete"
  | "member:manage"
  | "agent:run"
  | "action:approve";

// Higher number = more privilege. OWNER > EDITOR > VIEWER.
const ROLE_RANK: Record<Role, number> = {
  VIEWER: 1,
  EDITOR: 2,
  OWNER: 3,
};

// Mirrors the RBAC table in the README. Authorization must run
// before business logic, never after.
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  VIEWER: ["workspace:view", "knowledge:query", "agent:run"],
  EDITOR: [
    "workspace:view",
    "knowledge:query",
    "document:upload",
    "document:delete",
    "agent:run",
    "action:approve",
  ],
  OWNER: [
    "workspace:view",
    "knowledge:query",
    "document:upload",
    "document:delete",
    "member:manage",
    "agent:run",
    "action:approve",
  ],
};

export interface WorkspaceMembership {
  workspaceId: string;
  userId: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      membership?: WorkspaceMembership;
    }
  }
}

export function hasPermission(
  role: Role,
  permission: Permission,
): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function outranksOrEquals(
  role: Role,
  minimum: Role,
): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

function resolveRole(req: Request): Role | undefined {
  return req.membership?.role;
}

// Requires the request to carry a workspace membership with one of
// the allowed roles. Intended chain (Stage 2):
//   requireAuth -> loadWorkspaceMembership -> requireRole(...)
// `loadWorkspaceMembership` (workspace module) is responsible for
// setting `req.membership` and enforcing workspace isolation
// (`WHERE workspace_id = current_workspace`).
export function requireRole(...allowed: Role[]) {
  return (
    req: Request,
    _res: Response,
    next: NextFunction,
  ): void => {
    if (!req.user) {
      next(
        AppError.unauthorized(
          "Authentication required",
        ),
      );
      return;
    }

    const role = resolveRole(req);

    if (!role || !allowed.includes(role)) {
      next(
        AppError.forbidden(
          "Insufficient permissions for this workspace",
        ),
      );
      return;
    }

    next();
  };
}

// Requires a specific permission (checked against the membership role).
export function requirePermission(permission: Permission) {
  return (
    req: Request,
    _res: Response,
    next: NextFunction,
  ): void => {
    if (!req.user) {
      next(
        AppError.unauthorized(
          "Authentication required",
        ),
      );
      return;
    }

    const role = resolveRole(req);

    if (!role || !hasPermission(role, permission)) {
      next(
        AppError.forbidden(
          `Missing required permission: ${permission}`,
        ),
      );
      return;
    }

    next();
  };
}
