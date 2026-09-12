import { Types } from "mongoose";
import { AppError } from "../../lib/errors.js";
import { normalizeRole } from "./workspace.repo.js";
import { WorkspaceModel } from "./workspace.schema.js";
export async function loadWorkspaceMembership(req, _res, next) {
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
        const role = roleOfWorkspace(String(workspace.ownerId), workspace.members.map((m) => ({
            userId: String(m.userId),
            role: normalizeRole(m.role),
        })), req.user.userId);
        if (!role) {
            next(AppError.forbidden("You are not a member of this workspace"));
            return;
        }
        req.membership = {
            workspaceId: String(workspace._id),
            userId: req.user.userId,
            role,
        };
        // Attach for handlers that need workspace fields without refetching.
        req.workspace =
            workspace;
        next();
    }
    catch (error) {
        next(error);
    }
}
function resolveWorkspaceId(req) {
    const params = req.params;
    const body = (req.body ?? {});
    const query = req.query;
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
function roleOfWorkspace(ownerId, members, userId) {
    if (ownerId === userId)
        return "OWNER";
    return members.find((m) => m.userId === userId)?.role ?? null;
}
