import { AppError } from "../lib/errors.js";
// Higher number = more privilege. OWNER > EDITOR > VIEWER.
const ROLE_RANK = {
    VIEWER: 1,
    EDITOR: 2,
    OWNER: 3,
};
// Mirrors the RBAC table in the README. Authorization must run
// before business logic, never after.
const ROLE_PERMISSIONS = {
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
export function hasPermission(role, permission) {
    return ROLE_PERMISSIONS[role].includes(permission);
}
export function outranksOrEquals(role, minimum) {
    return ROLE_RANK[role] >= ROLE_RANK[minimum];
}
function resolveRole(req) {
    return req.membership?.role;
}
// Requires the request to carry a workspace membership with one of
// the allowed roles. Intended chain (Stage 2):
//   requireAuth -> loadWorkspaceMembership -> requireRole(...)
// `loadWorkspaceMembership` (workspace module) is responsible for
// setting `req.membership` and enforcing workspace isolation
// (`WHERE workspace_id = current_workspace`).
export function requireRole(...allowed) {
    return (req, _res, next) => {
        if (!req.user) {
            next(AppError.unauthorized("Authentication required"));
            return;
        }
        const role = resolveRole(req);
        if (!role || !allowed.includes(role)) {
            next(AppError.forbidden("Insufficient permissions for this workspace"));
            return;
        }
        next();
    };
}
// Requires a specific permission (checked against the membership role).
export function requirePermission(permission) {
    return (req, _res, next) => {
        if (!req.user) {
            next(AppError.unauthorized("Authentication required"));
            return;
        }
        const role = resolveRole(req);
        if (!role || !hasPermission(role, permission)) {
            next(AppError.forbidden(`Missing required permission: ${permission}`));
            return;
        }
        next();
    };
}
