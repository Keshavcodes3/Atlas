import { Document, Schema, Types, model } from "mongoose";

/**
 * One retrievable unit. Separate collection (not embedded in Document)
 * because: (a) a document can produce hundreds of 4KB vectors — embedding
 * them would blow past Mongo's 16MB doc limit; (b) retrieval needs
 * `find({ workspaceId })` with its own index, impossible inside a parent
 * array; (c) delete/cascade and re-ingest are atomic per-document.
 *
 * `embedding` is mistral-embed (1024 dims). No special vector index yet:
 * local mongod has no $vectorSearch (Atlas-only), so retrieval is
 * brute-force cosine in Node — fine to ~10k chunks. When you outgrow it,
 * add an Atlas Vector Search index on `embedding` without changing this
 * schema.
 */
export interface IChunk extends Document {
  workspaceId: Types.ObjectId;
  documentId: Types.ObjectId;
  content: string;
  embedding: number[];
  chunkIndex: number;
  tokenEstimate: number;
  createdAt: Date;
  updatedAt: Date;
}

const chunkSchema = new Schema<IChunk>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },
    documentId: {
      type: Schema.Types.ObjectId,
      ref: "Document",
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
    },
    embedding: {
      type: [Number],
      required: true,
      // Skip per-element validation for 1024-float arrays (slow + noisy).
      validate: {
        validator: (v: number[]) => Array.isArray(v) && v.length > 0,
        message: "Embedding must be a non-empty vector",
      },
    },
    chunkIndex: {
      type: Number,
      required: true,
      min: 0,
    },
    tokenEstimate: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

// Hot paths: re-ingest/delete per document, retrieval per workspace.
chunkSchema.index({ documentId: 1, chunkIndex: 1 }, { unique: true });
chunkSchema.index({ workspaceId: 1, createdAt: -1 });

export const ChunkModel = model<IChunk>("Chunk", chunkSchema);
