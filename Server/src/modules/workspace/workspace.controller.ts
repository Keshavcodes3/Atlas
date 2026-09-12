import type { NextFunction, Request, Response } from "express";

import { AppError } from "../../lib/errors.js";
import type { Role } from "../../middleware/rbac.js";
import {
  addMemberSchema,
  createWorkspaceSchema,
  memberUserIdParamSchema,
  updateMemberRoleSchema,
  updateWorkspaceSchema,
  workspaceIdParamSchema,
} from "./workspace.validation.js";
import {
  WorkspaceService,
  workspaceService,
} from "./workspace.service.js";

function requireUserId(req: Request): string {
  if (!req.user) {
    throw AppError.unauthorized("Authentication required");
  }
  return req.user.userId;
}

export class WorkspaceController {
  constructor(
    private readonly service: WorkspaceService = workspaceService,
  ) {}

  create = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const input = createWorkspaceSchema.parse(req.body);
      const result = await this.service.createWorkspace(
        requireUserId(req),
        input,
      );
      res.status(201).json({ workspace: result });
    } catch (error) {
      next(error);
    }
  };

  listMine = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.service.listMyWorkspaces(
        requireUserId(req),
      );
      res.json({ workspaces: result });
    } catch (error) {
      next(error);
    }
  };

  getOne = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { workspaceId } = workspaceIdParamSchema.parse(
        req.params,
      );
      const result = await this.service.getWorkspace(
        workspaceId,
        requireUserId(req),
      );
      res.json({ workspace: result });
    } catch (error) {
      next(error);
    }
  };

  update = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { workspaceId } = workspaceIdParamSchema.parse(
        req.params,
      );
      const input = updateWorkspaceSchema.parse(req.body);
      const result = await this.service.updateWorkspace(
        workspaceId,
        requireUserId(req),
        input,
      );
      res.json({ workspace: result });
    } catch (error) {
      next(error);
    }
  };

  remove = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { workspaceId } = workspaceIdParamSchema.parse(
        req.params,
      );
      await this.service.deleteWorkspace(
        workspaceId,
        requireUserId(req),
      );
      res.json({ message: "Workspace deleted" });
    } catch (error) {
      next(error);
    }
  };

  listMembers = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { workspaceId } = workspaceIdParamSchema.parse(
        req.params,
      );
      const members = await this.service.listMembers(
        workspaceId,
        requireUserId(req),
      );
      res.json({ members });
    } catch (error) {
      next(error);
    }
  };

  addMember = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { workspaceId } = workspaceIdParamSchema.parse(
        req.params,
      );
      const input = addMemberSchema.parse(req.body);
      const result = await this.service.addMember(
        workspaceId,
        requireUserId(req),
        {
          ...(input.userId ? { userId: input.userId } : {}),
          ...(input.email ? { email: input.email } : {}),
          role: input.role as Role,
        },
      );
      res.status(201).json({ workspace: result });
    } catch (error) {
      next(error);
    }
  };

  updateMemberRole = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { workspaceId, memberUserId } =
        memberUserIdParamSchema.parse(req.params);
      const input = updateMemberRoleSchema.parse(req.body);
      const result = await this.service.updateMemberRole(
        workspaceId,
        requireUserId(req),
        memberUserId,
        input.role as Role,
      );
      res.json({ workspace: result });
    } catch (error) {
      next(error);
    }
  };

  removeMember = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { workspaceId, memberUserId } =
        memberUserIdParamSchema.parse(req.params);
      const result = await this.service.removeMember(
        workspaceId,
        requireUserId(req),
        memberUserId,
      );
      res.json({ workspace: result });
    } catch (error) {
      next(error);
    }
  };
}

export const workspaceController = new WorkspaceController();
