import { Types } from "mongoose";

import {
  DocumentModel,
  DocumentSourceType,
  DocumentStatus,
  type IDocument,
} from "./document.schema.js";

export interface CreateDocumentData {
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
  status?: DocumentStatus;
  error?: string;
  metadata?: {
    author?: string;
    description?: string;
    language?: string;
    pageCount?: number;
    wordCount?: number;
  };
}

export interface UpdateDocumentData {
  title?: string;
  content?: string;
  status?: DocumentStatus;
  error?: string;
  chunkCount?: number;
  metadata?: CreateDocumentData["metadata"];
  storage?: CreateDocumentData["storage"];
}

export interface ListDocumentsFilter {
  status?: DocumentStatus;
  sourceType?: DocumentSourceType;
  search?: string;
}


export class DocumentRepositoryClass {
  async create(data: CreateDocumentData): Promise<IDocument> {
    return DocumentModel.create({
      workspaceId: new Types.ObjectId(data.workspaceId),
      uploadedBy: new Types.ObjectId(data.uploadedBy),
      title: data.title,
      sourceType: data.sourceType,
      ...(data.source ? { source: data.source } : {}),
      ...(data.storage ? { storage: data.storage } : {}),
      ...(data.content !== undefined ? { content: data.content } : {}),
      ...(data.status ? { status: data.status } : {}),
      ...(data.error !== undefined ? { error: data.error } : {}),
      ...(data.metadata ? { metadata: data.metadata } : {}),
    });
  }

  async findByIdInWorkspace(
    id: string,
    workspaceId: string,
  ): Promise<IDocument | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    if (!Types.ObjectId.isValid(workspaceId)) return null;
    return DocumentModel.findOne({
      _id: new Types.ObjectId(id),
      workspaceId: new Types.ObjectId(workspaceId),
    }).exec();
  }

  async listInWorkspace(
    workspaceId: string,
    filter: ListDocumentsFilter,
    page: number,
    limit: number,
  ): Promise<{ documents: IDocument[]; total: number }> {
    const query: Record<string, unknown> = {
      workspaceId: new Types.ObjectId(workspaceId),
    };

    if (filter.status) query.status = filter.status;
    if (filter.sourceType) query.sourceType = filter.sourceType;
    if (filter.search) {
      // Escaped regex on title — indexed prefix scan via
      // { workspaceId: 1, title: 1 }. Full-text search arrives
      // with hybrid retrieval (Stage 6).
      query.title = { $regex: escapeRegExp(filter.search), $options: "i" };
    }

    const skip = (page - 1) * limit;
    const [documents, total] = await Promise.all([
      DocumentModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      DocumentModel.countDocuments(query).exec(),
    ]);

    return { documents, total };
  }

  async countInWorkspace(workspaceId: string): Promise<number> {
    if (!Types.ObjectId.isValid(workspaceId)) return 0;
    return DocumentModel.countDocuments({
      workspaceId: new Types.ObjectId(workspaceId),
    }).exec();
  }

  async updateInWorkspace(
    id: string,
    workspaceId: string,
    data: UpdateDocumentData,
  ): Promise<IDocument | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    if (!Types.ObjectId.isValid(workspaceId)) return null;
    return DocumentModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        workspaceId: new Types.ObjectId(workspaceId),
      },
      { $set: data },
      { new: true, runValidators: true },
    ).exec();
  }

  async deleteInWorkspace(
    id: string,
    workspaceId: string,
  ): Promise<IDocument | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    if (!Types.ObjectId.isValid(workspaceId)) return null;
    return DocumentModel.findOneAndDelete({
      _id: new Types.ObjectId(id),
      workspaceId: new Types.ObjectId(workspaceId),
    }).exec();
  }

  async deleteManyInWorkspace(workspaceId: string): Promise<number> {
    if (!Types.ObjectId.isValid(workspaceId)) return 0;
    const result = await DocumentModel.deleteMany({
      workspaceId: new Types.ObjectId(workspaceId),
    }).exec();
    return result.deletedCount ?? 0;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const documentRepository = new DocumentRepositoryClass();
