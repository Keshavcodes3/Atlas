import type { NextFunction, Request, Response } from "express";

import { AppError } from "../../lib/errors.js";
import { queryBodySchema } from "./query.schema.js";
import { queryService } from "./query.service.js";

function requireUserId(req: Request): string {
  if (!req.user) throw AppError.unauthorized("Authentication required");
  return req.user.userId;
}

function requireWorkspaceId(req: Request): string {
  const fromMembership = req.membership?.workspaceId;
  if (fromMembership) return fromMembership;
  const param = (req.params as Record<string, unknown>)["workspaceId"];
  if (typeof param === "string" && param.trim()) return param.trim();
  throw AppError.badRequest("workspaceId is required");
}

export class QueryController {
  ask = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const input = queryBodySchema.parse(req.body);
      const result = await queryService.ask(
        requireWorkspaceId(req),
        input,
      );
      void requireUserId(req); // auth already enforced; keeps audit trail explicit
      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}

export const queryController = new QueryController();
