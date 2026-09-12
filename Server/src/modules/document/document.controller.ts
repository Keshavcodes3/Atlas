import type { NextFunction, Request, Response } from "express";

import { AppError } from "../../lib/errors.js";
import {
  DocumentService,
  documentService,
} from "./document.service.js";
import {
  createDocumentSchema,
  documentIdParamSchema,
  listDocumentsQuerySchema,
  updateDocumentSchema,
  uploadDocumentBodySchema,
} from "./document.validation.js";

function requireUserId(req: Request): string {
  if (!req.user) {
    throw AppError.unauthorized("Authentication required");
  }
  return req.user.userId;
}

function requireWorkspaceId(req: Request): string {
  const fromMembership = req.membership?.workspaceId;
  if (fromMembership) return fromMembership;

  const param = (req.params as Record<string, unknown>)["workspaceId"];
  if (typeof param === "string" && param.trim()) return param.trim();

  throw AppError.badRequest("workspaceId is required");
}

export class DocumentController {
  constructor(
    private readonly service: DocumentService = documentService,
  ) {}

  create = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const input = createDocumentSchema.parse(req.body);
      const result = await this.service.createDocument(
        requireWorkspaceId(req),
        requireUserId(req),
        input,
      );
      res.status(201).json({ document: result });
    } catch (error) {
      next(error);
    }
  };

  upload = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.file) {
        throw AppError.badRequest("No file uploaded. Send multipart field 'file'");
      }
      const body = uploadDocumentBodySchema.parse(req.body ?? {});
      const result = await this.service.createDocumentFromFile(
        requireWorkspaceId(req),
        requireUserId(req),
        req.file,
        body,
      );
      res.status(201).json({ document: result });
    } catch (error) {
      next(error);
    }
  };

  list = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const query = listDocumentsQuerySchema.parse(req.query);
      const result = await this.service.listDocuments(
        requireWorkspaceId(req),
        requireUserId(req),
        query,
      );
      res.json(result);
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
      const { documentId } = documentIdParamSchema.parse(req.params);
      const result = await this.service.getDocument(
        requireWorkspaceId(req),
        requireUserId(req),
        documentId,
      );
      res.json({ document: result });
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
      const { documentId } = documentIdParamSchema.parse(req.params);
      const input = updateDocumentSchema.parse(req.body);
      const result = await this.service.updateDocument(
        requireWorkspaceId(req),
        requireUserId(req),
        documentId,
        input,
      );
      res.json({ document: result });
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
      const { documentId } = documentIdParamSchema.parse(req.params);
      await this.service.deleteDocument(
        requireWorkspaceId(req),
        requireUserId(req),
        documentId,
      );
      res.json({ message: "Document deleted" });
    } catch (error) {
      next(error);
    }
  };
}

export const documentController = new DocumentController();
