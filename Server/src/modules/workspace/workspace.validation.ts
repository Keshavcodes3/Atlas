import { z } from "zod";

import { WORKSPACE_ROLES } from "./workspace.schema.js";

export const workspaceIdParamSchema = z.object({
  workspaceId: z.string().min(1, "workspaceId is required"),
});

export const memberUserIdParamSchema = z.object({
  workspaceId: z.string().min(1, "workspaceId is required"),
  memberUserId: z.string().min(1, "memberUserId is required"),
});

export const createWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Workspace name is required")
    .max(100, "Workspace name must be ≤ 100 characters"),
  description: z
    .string()
    .trim()
    .max(500, "Description must be ≤ 500 characters")
    .optional(),
});

export const updateWorkspaceSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Workspace name cannot be empty")
      .max(100, "Workspace name must be ≤ 100 characters")
      .optional(),
    description: z
      .string()
      .trim()
      .max(500, "Description must be ≤ 500 characters")
      .optional(),
  })
  .refine((data) => data.name !== undefined || data.description !== undefined, {
    message: "Provide at least one field to update",
  });

export const addMemberSchema = z
  .object({
    userId: z.string().min(1).optional(),
    email: z.string().trim().toLowerCase().email().optional(),
    role: z.enum(WORKSPACE_ROLES as [string, ...string[]]),
  })
  .refine((data) => data.userId || data.email, {
    message: "Provide userId or email of the member to add",
    path: ["userId"],
  });

export const updateMemberRoleSchema = z.object({
  role: z.enum(WORKSPACE_ROLES as [string, ...string[]]),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
