import { Types } from "mongoose";

import {
  DocumentModel,
  DocumentStatus,
} from "../../modules/document/document.schema.js";
import { ChunkModel } from "../../modules/document/chunk.schema.js";
import chunkDocument from "../Chunk/DocumentChunk.js";
import getEmbeddings from "../Embeddings/documentEmbedding.js";
import { logger } from "../../lib/logger.js";

export interface IngestResult {
  documentId: string;
  chunkCount: number;
}

export async function ingestDocument(documentId: string): Promise<IngestResult> {
  if (!Types.ObjectId.isValid(documentId)) {
    throw new Error("Invalid document ID");
  }
  const document = await DocumentModel.findById(documentId).exec();
  if (!document) {
    throw new Error("Document not found");
  }

  await DocumentModel.updateOne(
    { _id: document._id },
    { $set: { status: DocumentStatus.PROCESSING }, $unset: { error: 1 } },
  ).exec();

  try {
    const chunks = await chunkDocument(documentId);
    const vectors = await getEmbeddings(chunks.map((c) => c.pageContent));

    if (chunks.length !== vectors.length) {
      throw new Error(
        `Chunk/embedding mismatch: ${chunks.length} chunks, ${vectors.length} embeddings`,
      );
    }
    await ChunkModel.deleteMany({ documentId: document._id }).exec();
    await ChunkModel.insertMany(
      chunks.map((chunk, i) => ({
        workspaceId: document.workspaceId,
        documentId: document._id,
        content: chunk.pageContent,
        embedding: vectors[i],
        chunkIndex: i,
        tokenEstimate: Math.ceil(chunk.pageContent.length / 4),
      })),
    );

    await DocumentModel.updateOne(
      { _id: document._id },
      {
        $set: { status: DocumentStatus.READY, chunkCount: chunks.length },
        $unset: { error: 1 },
      },
    ).exec();

    logger.info(`Ingested document ${documentId}: ${chunks.length} chunks`);
    return { documentId, chunkCount: chunks.length };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Ingestion failed";
    await DocumentModel.updateOne(
      { _id: document._id },
      {
        $set: {
          status: DocumentStatus.FAILED,
          error: message.slice(0, 2000),
        },
      },
    ).exec();
    logger.error(`Ingest failed for ${documentId}: ${message}`);
    throw error;
  }
}

export function triggerIngest(documentId: string): void {
  setImmediate(() => {
    ingestDocument(documentId).catch(() => {
    });
  });
}

export async function deleteChunksForDocument(
  documentId: string,
): Promise<number> {
  if (!Types.ObjectId.isValid(documentId)) return 0;
  const res = await ChunkModel.deleteMany({
    documentId: new Types.ObjectId(documentId),
  }).exec();
  return res.deletedCount ?? 0;
}
