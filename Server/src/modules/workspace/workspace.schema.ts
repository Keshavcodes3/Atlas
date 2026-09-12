import { Document, Schema, model, Types } from "mongoose";

import type { Role } from "../../middleware/rbac.js";

// Canonical workspace roles. Must stay in sync with `Role`
// in middleware/rbac.ts (OWNER > EDITOR > VIEWER) and the
// RBAC permission table in the README.
export const WorkspaceRole = {
  OWNER: "OWNER",
  EDITOR: "EDITOR",
  VIEWER: "VIEWER",
} as const;

export type WorkspaceRole =
  (typeof WorkspaceRole)[keyof typeof WorkspaceRole];

export const WORKSPACE_ROLES: Role[] = [
  WorkspaceRole.OWNER,
  WorkspaceRole.EDITOR,
  WorkspaceRole.VIEWER,
];

export interface IWorkspaceMember {
  userId: Types.ObjectId;
  role: WorkspaceRole;
  joinedAt: Date;
}

export interface IWorkspace extends Document {
  name: string;
  description?: string;

  ownerId: Types.ObjectId;

  members: IWorkspaceMember[];

  settings: {
    allowMemberUpload: boolean;
    allowMemberQuery: boolean;
  };

  createdAt: Date;
  updatedAt: Date;
}

const workspaceMemberSchema =
  new Schema<IWorkspaceMember>(
    {
      userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },

      role: {
        type: String,
        enum: Object.values(WorkspaceRole),
        default: WorkspaceRole.VIEWER,
      },

      joinedAt: {
        type: Date,
        default: Date.now,
      },
    },
    {
      _id: false,
    },
  );

const workspaceSchema = new Schema<IWorkspace>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 100,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    members: {
      type: [workspaceMemberSchema],
      default: [],
    },

    settings: {
      allowMemberUpload: {
        type: Boolean,
        default: true,
      },

      allowMemberQuery: {
        type: Boolean,
        default: true,
      },
    },
  },
  {
    timestamps: true,
  },
);

// Isolation + lookup indexes. Every retrieval path must filter
// by workspace membership (`WHERE workspace_id = current_workspace`).
workspaceSchema.index({ "members.userId": 1 });
workspaceSchema.index({ ownerId: 1, updatedAt: -1 });

export const WorkspaceModel = model<IWorkspace>(
  "Workspace",
  workspaceSchema,
);
