import { Types } from "mongoose";
import { AppError } from "../../lib/errors.js";
import { User } from "../auth/auth.model.js";
import { normalizeRole, workspaceRepository, } from "./workspace.repo.js";
// Business rules + workspace isolation. Every method takes the
// acting `userId` and re-checks membership against the DB, so
// isolation holds even if a route forgets its RBAC middleware.
// (`WHERE workspace_id = current_workspace`, enforced in code.)
export class WorkspaceService {
    repo;
    constructor(repo = workspaceRepository) {
        this.repo = repo;
    }
    async createWorkspace(ownerId, input) {
        const name = input.name.trim();
        if (!name) {
            throw AppError.badRequest("Workspace name is required");
        }
        const workspace = await this.repo.create({
            name,
            ...(input.description !== undefined
                ? { description: input.description.trim() || undefined }
                : {}),
            ownerId,
        });
        return this.serialize(workspace, "OWNER");
    }
    async listMyWorkspaces(userId) {
        const workspaces = await this.repo.findForUser(userId);
        return workspaces.map((w) => this.serialize(w, this.roleOf(w, userId) ?? undefined));
    }
    async getWorkspace(id, userId) {
        const workspace = await this.requireMembership(id, userId);
        return this.serialize(workspace.workspace, workspace.role);
    }
    async updateWorkspace(id, userId, input) {
        const { workspace, role } = await this.requireMembership(id, userId);
        this.requireOwner(role);
        const patch = {};
        if (input.name !== undefined) {
            const name = input.name.trim();
            if (!name) {
                throw AppError.badRequest("Workspace name cannot be empty");
            }
            patch.name = name;
        }
        if (input.description !== undefined) {
            patch.description = input.description.trim();
        }
        void workspace;
        const updated = await this.repo.update(id, patch);
        if (!updated) {
            throw AppError.notFound("Workspace not found");
        }
        return this.serialize(updated, role);
    }
    async deleteWorkspace(id, userId) {
        const { role } = await this.requireMembership(id, userId);
        this.requireOwner(role);
        const deleted = await this.repo.delete(id);
        if (!deleted) {
            throw AppError.notFound("Workspace not found");
        }
    }
    async listMembers(id, userId) {
        const { workspace } = await this.requireMembership(id, userId);
        return this.serializeMembers(workspace);
    }
    async addMember(id, actingUserId, input) {
        const { workspace, role } = await this.requireMembership(id, actingUserId);
        this.requireOwner(role);
        const targetUserId = await this.resolveTargetUserId(input);
        const existing = await this.repo.findMember(workspace, targetUserId);
        if (existing) {
            throw AppError.conflict("User is already a member of this workspace");
        }
        const updated = await this.repo.addMember(id, targetUserId, input.role);
        if (!updated) {
            throw AppError.conflict("User is already a member of this workspace");
        }
        return this.serialize(updated, role);
    }
    async updateMemberRole(id, actingUserId, targetUserId, role) {
        const { workspace, role: actorRole } = await this.requireMembership(id, actingUserId);
        this.requireOwner(actorRole);
        const existing = await this.repo.findMember(workspace, targetUserId);
        if (!existing) {
            throw AppError.notFound("Member not found in this workspace");
        }
        // Never leave a workspace without an owner.
        if (existing.role === "OWNER" &&
            role !== "OWNER" &&
            this.repo.countOwners(workspace) <= 1) {
            throw AppError.badRequest("Cannot demote the last owner of the workspace");
        }
        const updated = await this.repo.updateMemberRole(id, targetUserId, role);
        if (!updated) {
            throw AppError.notFound("Member not found in this workspace");
        }
        return this.serialize(updated, actorRole);
    }
    async removeMember(id, actingUserId, targetUserId) {
        const { workspace, role: actorRole } = await this.requireMembership(id, actingUserId);
        const isSelfLeave = actingUserId === targetUserId;
        if (!isSelfLeave) {
            this.requireOwner(actorRole);
        }
        const existing = await this.repo.findMember(workspace, targetUserId);
        if (!existing) {
            throw AppError.notFound("Member not found in this workspace");
        }
        if (existing.role === "OWNER" &&
            this.repo.countOwners(workspace) <= 1) {
            throw AppError.badRequest("Cannot remove the last owner of the workspace");
        }
        // The creator record stays immutable — membership rows are
        // what grant/revoke access. Prevent orphaning ownerId while
        // still allowing owner rotation via role changes.
        if (String(workspace.ownerId) === targetUserId) {
            const otherOwners = workspace.members.filter((m) => String(m.userId) !== targetUserId &&
                normalizeRole(m.role) === "OWNER");
            if (otherOwners.length === 0) {
                throw AppError.badRequest("Transfer ownership to another owner before removing the creator");
            }
        }
        const updated = await this.repo.removeMember(id, targetUserId);
        if (!updated) {
            throw AppError.notFound("Workspace not found");
        }
        return this.serialize(updated, actorRole);
    }
    // -- helpers ---------------------------------------------------
    async requireMembership(id, userId) {
        if (!Types.ObjectId.isValid(id)) {
            throw AppError.notFound("Workspace not found");
        }
        const workspace = await this.repo.findById(id);
        if (!workspace) {
            throw AppError.notFound("Workspace not found");
        }
        const role = this.roleOf(workspace, userId);
        if (!role) {
            // Deliberately FORBIDDEN (not NOT_FOUND) once the id is
            // known-valid: callers already passed `loadWorkspaceMembership`,
            // and 403 makes mis-scoped tokens debuggable. The id itself
            // is unguessable (ObjectId), so enumeration risk is minimal.
            throw AppError.forbidden("You are not a member of this workspace");
        }
        return { workspace, role };
    }
    roleOf(workspace, userId) {
        const target = String(userId);
        if (String(workspace.ownerId) === target)
            return "OWNER";
        const member = workspace.members.find((m) => String(m.userId) === target);
        return member ? normalizeRole(member.role) : null;
    }
    requireOwner(role) {
        if (role !== "OWNER") {
            throw AppError.forbidden("Only workspace owners can perform this action");
        }
    }
    async resolveTargetUserId(input) {
        if (input.userId && Types.ObjectId.isValid(input.userId)) {
            const user = await User.findById(input.userId)
                .select({ _id: 1 })
                .exec();
            if (!user) {
                throw AppError.notFound("Target user not found");
            }
            return String(user._id);
        }
        if (input.email) {
            const email = input.email.trim().toLowerCase();
            if (!email) {
                throw AppError.badRequest("Provide userId or email of the member to add");
            }
            const user = await User.findOne({ email })
                .select({ _id: 1 })
                .exec();
            if (!user) {
                throw AppError.notFound("No user found with that email");
            }
            return String(user._id);
        }
        throw AppError.badRequest("Provide userId or email of the member to add");
    }
    serialize(workspace, currentUserRole) {
        return {
            id: String(workspace._id),
            name: workspace.name,
            ...(workspace.description !== undefined
                ? { description: workspace.description }
                : {}),
            ownerId: String(workspace.ownerId),
            members: this.serializeMembers(workspace),
            settings: {
                allowMemberUpload: workspace.settings?.allowMemberUpload ?? true,
                allowMemberQuery: workspace.settings?.allowMemberQuery ?? true,
            },
            createdAt: workspace.createdAt,
            updatedAt: workspace.updatedAt,
            ...(currentUserRole
                ? { currentUserRole }
                : {}),
        };
    }
    serializeMembers(workspace) {
        return workspace.members.map((m) => ({
            userId: String(m.userId),
            role: normalizeRole(m.role),
            joinedAt: m.joinedAt,
        }));
    }
}
export const workspaceService = new WorkspaceService();
