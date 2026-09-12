import { Document, Schema, Types, model } from "mongoose";

export enum DocumentSourceType {
  PDF = "pdf",
  TEXT = "text",
  MARKDOWN = "markdown",
  DOCX = "docx",
  CSV = "csv",
  URL = "url",
}

export enum DocumentStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  READY = "ready",
  FAILED = "failed",
}

export interface IDocument extends Document {
  workspaceId: Types.ObjectId;
  uploadedBy: Types.ObjectId;

  title: string;
  sourceType: DocumentSourceType;

  /**
   * Original source information.
   * For files: original filename.
   * For URLs: the URL itself.
   */
  source: {
    name?: string;
    url?: string;
    mimeType?: string;
    size?: number;
  };

  /**
   * ImageKit storage information.
   * Only applicable to uploaded files.
   */
  storage?: {
    fileId: string;
    url: string;
    path: string;
  };

  /**
   * Extracted / normalized text.
   */
  content?: string;


  chunkCount: number;


  status: DocumentStatus;


  error?: string;

  metadata: {
    author?: string;
    description?: string;
    language?: string;
    pageCount?: number;
    wordCount?: number;
  };

  createdAt: Date;
  updatedAt: Date;
}

const documentSchema = new Schema<IDocument>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },

    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },

    sourceType: {
      type: String,
      enum: Object.values(DocumentSourceType),
      required: true,
      index: true,
    },

    source: {
      name: {
        type: String,
        trim: true,
      },

      url: {
        type: String,
        trim: true,
      },

      mimeType: {
        type: String,
        trim: true,
      },

      size: {
        type: Number,
      },
    },

    storage: {
      fileId: {
        type: String,
      },

      url: {
        type: String,
      },

      path: {
        type: String,
      },
    },

    content: {
      type: String,
    },

    chunkCount: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: Object.values(DocumentStatus),
      default: DocumentStatus.PENDING,
      index: true,
    },

    error: {
      type: String,
    },

    metadata: {
      author: {
        type: String,
      },

      description: {
        type: String,
      },

      language: {
        type: String,
      },

      pageCount: {
        type: Number,
      },

      wordCount: {
        type: Number,
      },
    },
  },
  {
    timestamps: true,
  },
);

// Isolation + listing indexes. Every retrieval path must filter by
// `workspaceId` (`WHERE workspace_id = current_workspace`).
// Compound indexes cover the hot paths: paginated listing
// (workspace + recency) and status/source filtering per workspace.
documentSchema.index({ workspaceId: 1, createdAt: -1 });
documentSchema.index({ workspaceId: 1, status: 1 });
documentSchema.index({ workspaceId: 1, sourceType: 1 });
documentSchema.index({ workspaceId: 1, title: 1 });

export const DocumentModel = model<IDocument>(
  "Document",
  documentSchema,
);
