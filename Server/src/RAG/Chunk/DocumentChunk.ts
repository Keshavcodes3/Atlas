import type { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

import { DocumentLoader } from "../Loader/documentLoader.js";

// ~1000 chars ≈ 250 tokens. The old 300/50 produced fragments too
// small to answer from (a paragraph split mid-sentence) and tripled
// embedding cost. 1000/200 is the standard starting point; tune it
// with evals (Stage 6), not guesses.
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

export interface ChunkedDocument extends Document {
  metadata: Record<string, unknown> & {
    documentId: string;
    workspaceId: string;
    chunkIndex?: number;
  };
}

export default async function chunkDocument(
  documentId: string,
): Promise<ChunkedDocument[]> {
  const { docs } = await DocumentLoader(documentId);
  if (docs.length === 0) {
    throw new Error("Document loader returned no content to chunk");
  }

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
  });
  const chunks = (await splitter.splitDocuments(docs)) as ChunkedDocument[];

  const usable = chunks.filter((c) => c.pageContent.trim().length > 0);
  if (usable.length === 0) {
    throw new Error("Document produced no non-empty chunks");
  }

  usable.forEach((chunk, index) => {
    chunk.metadata = {
      ...chunk.metadata,
      chunkIndex: index,
    };
  });
  return usable;
}
