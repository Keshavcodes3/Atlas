import { Schema, model } from "mongoose";
// Canonical workspace roles. Must stay in sync with `Role`
// in middleware/rbac.ts (OWNER > EDITOR > VIEWER) and the
// RBAC permission table in the README.
export const WorkspaceRole = {
    OWNER: "OWNER",
    EDITOR: "EDITOR",
    VIEWER: "VIEWER",
};
export const WORKSPACE_ROLES = [
    WorkspaceRole.OWNER,
    WorkspaceRole.EDITOR,
    WorkspaceRole.VIEWER,
];
const workspaceMemberSchema = new Schema({
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
}, {
    _id: false,
});
const workspaceSchema = new Schema({
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
}, {
    timestamps: true,
});
// Isolation + lookup indexes. Every retrieval path must filter
// by workspace membership (`WHERE workspace_id = current_workspace`).
workspaceSchema.index({ "members.userId": 1 });
workspaceSchema.index({ ownerId: 1, updatedAt: -1 });
export const WorkspaceModel = model("Workspace", workspaceSchema);
