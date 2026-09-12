import { Types } from "mongoose";

import { uploadToImageKit, deleteFromImageKit } from "../../config/upload.js";
import { AppError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import {
  deleteChunksForDocument,
  triggerIngest,
} from "../../RAG/Ingestions/ingestDocument.js";
import { WorkspaceModel } from "../workspace/workspace.schema.js";
import { normalizeRole } from "../workspace/workspace.repo.js";
import {
  DocumentSourceType,
  DocumentStatus,
  type IDocument,
} from "./document.schema.js";
import {
  DocumentRepositoryClass,
  documentRepository,
} from "./document.repo.js";
import type {
  CreateDocumentInput,
  ListDocumentsQuery,
  UpdateDocumentInput,
  UploadDocumentBodyInput,
} from "./document.validation.js";

export interface SerializedDocument {
  id: string;
  workspaceId: string;
  uploadedBy: string;
  title: string;
  sourceType: DocumentSourceType;
  source?: {
    name?: string;
    url?: string;
    mimeType?: string;
    size?: number;
  };
  storage?: {
    fileId: string;
    url: string;
    path: string;
  };
  content?: string;
  chunkCount: number;
  status: DocumentStatus;
  error?: string;
  metadata?: {
    author?: string;
    description?: string;
    language?: string;
    pageCount?: number;
    wordCount?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedDocuments {
  documents: SerializedDocument[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class DocumentService {
  constructor(
    private readonly repo: DocumentRepositoryClass = documentRepository,
  ) {}

  async createDocument(
    workspaceId: string,
    userId: string,
    input: CreateDocumentInput,
  ): Promise<SerializedDocument> {
    await this.requireMembership(workspaceId, userId);

    const metadata =
      input.content !== undefined
        ? withWordCount(input.metadata, countWords(input.content))
        : input.metadata;

    const doc = await this.repo.create({
      workspaceId,
      uploadedBy: userId,
      title: input.title,
      sourceType: input.sourceType as DocumentSourceType,
      ...(input.source ? { source: input.source } : {}),
      ...(input.content !== undefined ? { content: input.content } : {}),
      status: DocumentStatus.PENDING,
      ...(metadata ? { metadata } : {}),
    });

    // Async RAG: return 201 immediately, ingest in background.
    // triggerIngest never rejects (failures land on doc.status=FAILED).
    triggerIngest(String(doc._id));

    return this.serialize(doc);
  }

  async createDocumentFromFile(
    workspaceId: string,
    userId: string,
    file: Express.Multer.File,
    body: UploadDocumentBodyInput,
  ): Promise<SerializedDocument> {
    await this.requireMembership(workspaceId, userId);

    const sourceType = this.resolveSourceType(file, body.sourceType);
    const title =
      body.title?.trim() || file.originalname.trim() || "Untitled document";

    const content = extractInlineText(file, sourceType);

    const storage = await this.storeFile(workspaceId, file);

    const doc = await this.repo.create({
      workspaceId,
      uploadedBy: userId,
      title,
      sourceType,
      source: {
        name: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
      },
      ...(storage ? { storage } : {}),
      ...(content !== undefined ? { content } : {}),
      status: DocumentStatus.PENDING,
      metadata: {
        ...(body.author ? { author: body.author } : {}),
        ...(body.description ? { description: body.description } : {}),
        ...(body.language ? { language: body.language } : {}),
        ...(content !== undefined
          ? { wordCount: countWords(content) }
          : {}),
      },
    });

    triggerIngest(String(doc._id));

    return this.serialize(doc);
  }

  async listDocuments(
    workspaceId: string,
    userId: string,
    query: ListDocumentsQuery,
  ): Promise<PaginatedDocuments> {
    await this.requireMembership(workspaceId, userId);

    const { documents, total } = await this.repo.listInWorkspace(
      workspaceId,
      {
        ...(query.status ? { status: query.status as DocumentStatus } : {}),
        ...(query.sourceType
          ? { sourceType: query.sourceType as DocumentSourceType }
          : {}),
        ...(query.search ? { search: query.search } : {}),
      },
      query.page,
      query.limit,
    );

    return {
      documents: documents.map((d) => this.serialize(d)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async getDocument(
    workspaceId: string,
    userId: string,
    documentId: string,
  ): Promise<SerializedDocument> {
    await this.requireMembership(workspaceId, userId);
    const doc = await this.requireDocument(workspaceId, documentId);
    return this.serialize(doc);
  }

  async updateDocument(
    workspaceId: string,
    userId: string,
    documentId: string,
    input: UpdateDocumentInput,
  ): Promise<SerializedDocument> {
    await this.requireMembership(workspaceId, userId);
    const existing = await this.requireDocument(workspaceId, documentId);

    if (input.status !== undefined) {
      this.assertValidTransition(
        existing.status,
        input.status as DocumentStatus,
      );
    }

    const patch: Parameters<DocumentRepositoryClass["updateInWorkspace"]>[2] = {};
    if (input.title !== undefined) patch.title = input.title;
    if (input.content !== undefined) {
      patch.content = input.content;
      patch.metadata = withWordCount(
        input.metadata ?? existing.metadata,
        countWords(input.content),
      );
    } else if (input.metadata !== undefined) {
      patch.metadata = input.metadata;
    }
    if (input.status !== undefined) {
      const next = input.status as DocumentStatus;
      patch.status = next;
      if (next !== DocumentStatus.FAILED && input.error !== undefined) {
        // Explicit error without FAILED is a client bug, not state.
        throw AppError.badRequest("error can only be set when status is 'failed'");
      }
      // FAILED carries an error; every other state clears it so
      // stale errors never linger on READY documents. Mongoose
      // skips `undefined` in $set, so the stale error is removed
      // with an explicit $unset after the update below.
      if (next === DocumentStatus.FAILED) {
        patch.error =
          input.error ?? existing.error ?? "Processing failed";
      }
    } else if (input.error !== undefined) {
      throw AppError.badRequest("error can only be set when status is 'failed'");
    }

    const updated = await this.repo.updateInWorkspace(
      documentId,
      workspaceId,
      patch,
    );
    if (!updated) {
      throw AppError.notFound("Document not found");
    }

    // Mongoose skips `undefined` in $set, so clearing a stale error
    // needs an explicit $unset when leaving FAILED.
    if (
      input.status !== undefined &&
      (input.status as DocumentStatus) !== DocumentStatus.FAILED &&
      existing.error
    ) {
      await updated.updateOne({ $unset: { error: 1 } }).exec();
      updated.error = undefined;
    }

    return this.serialize(updated);
  }

  async deleteDocument(
    workspaceId: string,
    userId: string,
    documentId: string,
  ): Promise<void> {
    await this.requireMembership(workspaceId, userId);
    const doc = await this.requireDocument(workspaceId, documentId);

    const deleted = await this.repo.deleteInWorkspace(
      documentId,
      workspaceId,
    );
    if (!deleted) {
      throw AppError.notFound("Document not found");
    }

    // Best-effort remote cleanup. The DB record is the source of
    // truth — a storage-orphan is recoverable, a deleted-record
    // with live storage is not worth failing the request over.
    // Vectors are deleted synchronously: unlike remote files, stale
    // chunks are a correctness bug (ghost citations after delete).
    await deleteChunksForDocument(documentId);
    if (doc.storage?.fileId) {
      try {
        await deleteFromImageKit(doc.storage.fileId);
      } catch (error) {
        logger.warn(
          `Failed to delete remote file ${doc.storage.fileId} for document ${documentId}`,
          error,
        );
      }
    }
  }

  // -- worker hook (Stage 4) ---------------------------------------
  // Background jobs call this without a user session; isolation
  // still holds because the worker must know the workspaceId.
  async setStatus(
    workspaceId: string,
    documentId: string,
    status: DocumentStatus,
    error?: string,
  ): Promise<SerializedDocument> {
    const existing = await this.requireDocument(workspaceId, documentId);
    this.assertValidTransition(existing.status, status);

    const updated = await this.repo.updateInWorkspace(
      documentId,
      workspaceId,
      {
        status,
        ...(status === DocumentStatus.FAILED
          ? { error: error ?? "Processing failed" }
          : {}),
      },
    );
    if (!updated) {
      throw AppError.notFound("Document not found");
    }
    if (status !== DocumentStatus.FAILED && existing.error) {
      await updated.updateOne({ $unset: { error: 1 } }).exec();
      updated.error = undefined;
    }
    return this.serialize(updated);
  }

  // -- helpers -----------------------------------------------------

  private async requireMembership(
    workspaceId: string,
    userId: string,
  ): Promise<void> {
    if (!Types.ObjectId.isValid(workspaceId)) {
      throw AppError.notFound("Workspace not found");
    }
    const workspace = await WorkspaceModel.findById(workspaceId)
      .select({ ownerId: 1, members: 1 })
      .exec();
    if (!workspace) {
      throw AppError.notFound("Workspace not found");
    }

    if (String(workspace.ownerId) === String(userId)) return;
    const member = workspace.members.find(
      (m) => String(m.userId) === String(userId),
    );
    if (!member) {
      throw AppError.forbidden("You are not a member of this workspace");
    }
    void normalizeRole(member.role);
  }

  private async requireDocument(
    workspaceId: string,
    documentId: string,
  ): Promise<IDocument> {
    if (!Types.ObjectId.isValid(documentId)) {
      throw AppError.notFound("Document not found");
    }
    const doc = await this.repo.findByIdInWorkspace(
      documentId,
      workspaceId,
    );
    if (!doc) {
      // Scoped lookup: missing OR other-workspace both read as 404
      // so workspace document IDs are not enumerable.
      throw AppError.notFound("Document not found");
    }
    return doc;
  }

  private assertValidTransition(
    from: DocumentStatus,
    to: DocumentStatus,
  ): void {
    if (from === to) return;
    const allowed: Record<DocumentStatus, DocumentStatus[]> = {
      [DocumentStatus.PENDING]: [
        DocumentStatus.PROCESSING,
        DocumentStatus.FAILED,
      ],
      [DocumentStatus.PROCESSING]: [
        DocumentStatus.READY,
        DocumentStatus.FAILED,
      ],
      [DocumentStatus.READY]: [DocumentStatus.PROCESSING],
      [DocumentStatus.FAILED]: [
        DocumentStatus.PENDING,
        DocumentStatus.PROCESSING,
      ],
    };
    if (!allowed[from].includes(to)) {
      throw AppError.badRequest(
        `Invalid status transition: ${from} → ${to}`,
      );
    }
  }

  private resolveSourceType(
    file: Express.Multer.File,
    explicit?: string,
  ): DocumentSourceType {
    if (explicit) return explicit as DocumentSourceType;
    const mime = file.mimetype.toLowerCase();
    if (mime === "application/pdf") return DocumentSourceType.PDF;
    if (mime === "text/markdown" || file.originalname.endsWith(".md")) {
      return DocumentSourceType.MARKDOWN;
    }
    if (mime === "text/csv" || file.originalname.endsWith(".csv")) {
      return DocumentSourceType.CSV;
    }
    if (
      mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      return DocumentSourceType.DOCX;
    }
    if (mime.startsWith("text/")) return DocumentSourceType.TEXT;
    throw AppError.badRequest(
      `Unsupported file type: ${file.mimetype}. Allowed: pdf, txt, md, csv, docx`,
    );
  }

  private async storeFile(
    workspaceId: string,
    file: Express.Multer.File,
  ): Promise<{ fileId: string; url: string; path: string } | undefined> {
    try {
      const uploaded = await uploadToImageKit(file, {
        folder: `/workspaces/${workspaceId}/documents`,
      });
      return {
        fileId: uploaded.fileId,
        url: uploaded.url,
        path: uploaded.filePath,
      };
    } catch (error) {
      // Local dev without ImageKit keys should still support
      // document CRUD — storage is an optimization, the DB record
      // (plus inline text) is the source of truth.
      if (
        error instanceof Error &&
        /IMAGEKIT_.*is not defined/.test(error.message)
      ) {
        logger.warn("ImageKit not configured — storing document without remote file");
        return undefined;
      }
      throw error;
    }
  }

  private serialize(doc: IDocument): SerializedDocument {
    return {
      id: String(doc._id),
      workspaceId: String(doc.workspaceId),
      uploadedBy: String(doc.uploadedBy),
      title: doc.title,
      sourceType: doc.sourceType,
      ...(doc.source ? { source: { ...doc.source } } : {}),
      ...(doc.storage ? { storage: { ...doc.storage } } : {}),
      ...(doc.content !== undefined ? { content: doc.content } : {}),
      chunkCount: doc.chunkCount ?? 0,
      status: doc.status,
      ...(doc.error ? { error: doc.error } : {}),
      ...(doc.metadata ? { metadata: { ...doc.metadata } } : {}),
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}

function countWords(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean);
  return content.trim() ? words.length : 0;
}

function withWordCount(
  metadata:
    | {
        author?: string;
        description?: string;
        language?: string;
        pageCount?: number;
        wordCount?: number;
      }
    | undefined,
  wordCount: number,
): {
  author?: string;
  description?: string;
  language?: string;
  pageCount?: number;
  wordCount?: number;
} {
  return { ...(metadata ?? {}), wordCount };
}

function extractInlineText(
  file: Express.Multer.File,
  sourceType: DocumentSourceType,
): string | undefined {
  if (
    sourceType === DocumentSourceType.TEXT ||
    sourceType === DocumentSourceType.MARKDOWN ||
    sourceType === DocumentSourceType.CSV
  ) {
    const text = file.buffer.toString("utf-8");
    if (text.length > 5_000_000) {
      throw AppError.badRequest("File content is too large");
    }
    return text;
  }
  return undefined;
}

export const documentService = new DocumentService();
