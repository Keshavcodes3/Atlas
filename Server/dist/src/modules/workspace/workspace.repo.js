import { Types } from "mongoose";
import { WorkspaceModel, } from "./workspace.schema.js";
export class WorkspaceRepository {
    async create(data) {
        const ownerObjectId = new Types.ObjectId(data.ownerId);
        return WorkspaceModel.create({
            name: data.name,
            ...(data.description !== undefined
                ? { description: data.description }
                : {}),
            ownerId: ownerObjectId,
            members: [
                {
                    userId: ownerObjectId,
                    role: "OWNER",
                    joinedAt: new Date(),
                },
            ],
        });
    }
    async findById(id) {
        if (!Types.ObjectId.isValid(id))
            return null;
        return WorkspaceModel.findById(id).exec();
    }
    // Workspaces the user owns or is a member of. This is the
    // isolation boundary for listing: never return all workspaces.
    async findForUser(userId) {
        if (!Types.ObjectId.isValid(userId))
            return [];
        const oid = new Types.ObjectId(userId);
        return WorkspaceModel.find({
            $or: [{ ownerId: oid }, { "members.userId": oid }],
        })
            .sort({ updatedAt: -1 })
            .exec();
    }
    async update(id, data) {
        if (!Types.ObjectId.isValid(id))
            return null;
        return WorkspaceModel.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true }).exec();
    }
    async delete(id) {
        if (!Types.ObjectId.isValid(id))
            return null;
        return WorkspaceModel.findByIdAndDelete(id).exec();
    }
    async findMember(workspace, userId) {
        const target = String(userId);
        const member = workspace.members.find((m) => String(m.userId) === target);
        if (!member)
            return null;
        return {
            userId: String(member.userId),
            role: normalizeRole(member.role),
        };
    }
    async addMember(id, userId, role) {
        if (!Types.ObjectId.isValid(id) ||
            !Types.ObjectId.isValid(userId))
            return null;
        const memberUserId = new Types.ObjectId(userId);
        // Guard against duplicates at the DB level too (service
        // checks first for a nicer 409 message).
        const alreadyMember = await WorkspaceModel.findOne({
            _id: new Types.ObjectId(id),
            "members.userId": memberUserId,
        })
            .select({ _id: 1 })
            .lean()
            .exec();
        if (alreadyMember)
            return null;
        return WorkspaceModel.findByIdAndUpdate(id, {
            $push: {
                members: {
                    userId: memberUserId,
                    role,
                    joinedAt: new Date(),
                },
            },
        }, { new: true, runValidators: true }).exec();
    }
    async updateMemberRole(id, userId, role) {
        if (!Types.ObjectId.isValid(id) ||
            !Types.ObjectId.isValid(userId))
            return null;
        return WorkspaceModel.findOneAndUpdate({
            _id: new Types.ObjectId(id),
            "members.userId": new Types.ObjectId(userId),
        }, { $set: { "members.$.role": role } }, { new: true, runValidators: true }).exec();
    }
    async removeMember(id, userId) {
        if (!Types.ObjectId.isValid(id) ||
            !Types.ObjectId.isValid(userId))
            return null;
        return WorkspaceModel.findByIdAndUpdate(id, {
            $pull: {
                members: {
                    userId: new Types.ObjectId(userId),
                },
            },
        }, { new: true }).exec();
    }
    countOwners(workspace) {
        return workspace.members.filter((m) => normalizeRole(m.role) === "OWNER").length;
    }
}
// Legacy data may store lowercase roles ("owner"). Normalize
// defensively so old documents still authorize correctly.
export function normalizeRole(role) {
    const upper = String(role ?? "").toUpperCase();
    if (upper === "OWNER")
        return "OWNER";
    if (upper === "EDITOR")
        return "EDITOR";
    return "VIEWER";
}
export const workspaceRepository = new WorkspaceRepository();
