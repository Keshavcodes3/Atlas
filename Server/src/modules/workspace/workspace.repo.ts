import { Types } from "mongoose";

import type { Role } from "../../middleware/rbac.js";
import {
  WorkspaceModel,
  type IWorkspace,
} from "./workspace.schema.js";

export interface CreateWorkspaceData {
  name: string;
  description?: string;
  ownerId: string;
}

export interface UpdateWorkspaceData {
  name?: string;
  description?: string;
}


export class WorkspaceRepositoryClass {
  async create(
    data: CreateWorkspaceData,
  ): Promise<IWorkspace> {
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
          role: "OWNER" satisfies Role,
          joinedAt: new Date(),
        },
      ],
    });
  }

  async findById(id: string): Promise<IWorkspace | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return WorkspaceModel.findById(id).exec();
  }

  // Workspaces the user owns or is a member of. This is the
  // isolation boundary for listing: never return all workspaces.
  async findForUser(userId: string): Promise<IWorkspace[]> {
    if (!Types.ObjectId.isValid(userId)) return [];
    const oid = new Types.ObjectId(userId);
    return WorkspaceModel.find({
      $or: [{ ownerId: oid }, { "members.userId": oid }],
    })
      .sort({ updatedAt: -1 })
      .exec();
  }

  async update(
    id: string,
    data: UpdateWorkspaceData,
  ): Promise<IWorkspace | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return WorkspaceModel.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true, runValidators: true },
    ).exec();
  }

  async delete(id: string): Promise<IWorkspace | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return WorkspaceModel.findByIdAndDelete(id).exec();
  }

  async findMember(
    workspace: IWorkspace,
    userId: string,
  ): Promise<{ userId: string; role: Role } | null> {
    const target = String(userId);
    const member = workspace.members.find(
      (m) => String(m.userId) === target,
    );
    if (!member) return null;
    return {
      userId: String(member.userId),
      role: normalizeRole(member.role),
    };
  }

  async addMember(
    id: string,
    userId: string,
    role: Role,
  ): Promise<IWorkspace | null> {
    if (
      !Types.ObjectId.isValid(id) ||
      !Types.ObjectId.isValid(userId)
    )
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
    if (alreadyMember) return null;

    return WorkspaceModel.findByIdAndUpdate(
      id,
      {
        $push: {
          members: {
            userId: memberUserId,
            role,
            joinedAt: new Date(),
          },
        },
      },
      { new: true, runValidators: true },
    ).exec();
  }

  async updateMemberRole(
    id: string,
    userId: string,
    role: Role,
  ): Promise<IWorkspace | null> {
    if (
      !Types.ObjectId.isValid(id) ||
      !Types.ObjectId.isValid(userId)
    )
      return null;
    return WorkspaceModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        "members.userId": new Types.ObjectId(userId),
      },
      { $set: { "members.$.role": role } },
      { new: true, runValidators: true },
    ).exec();
  }

  async removeMember(
    id: string,
    userId: string,
  ): Promise<IWorkspace | null> {
    if (
      !Types.ObjectId.isValid(id) ||
      !Types.ObjectId.isValid(userId)
    )
      return null;
    return WorkspaceModel.findByIdAndUpdate(
      id,
      {
        $pull: {
          members: {
            userId: new Types.ObjectId(userId),
          },
        },
      },
      { new: true },
    ).exec();
  }

  countOwners(workspace: IWorkspace): number {
    return workspace.members.filter(
      (m) => normalizeRole(m.role) === "OWNER",
    ).length;
  }
}

// Legacy data may store lowercase roles ("owner"). Normalize
// defensively so old documents still authorize correctly.
export function normalizeRole(role: unknown): Role {
  const upper = String(role ?? "").toUpperCase();
  if (upper === "OWNER") return "OWNER";
  if (upper === "EDITOR") return "EDITOR";
  return "VIEWER";
}

export const workspaceRepository =
  new WorkspaceRepositoryClass();
