import { Types } from "mongoose";

import { AppError } from "../../lib/errors.js";
import { getMistralLLM } from "../../LLM/Mistral.js";
import { getQueryEmbedding } from "../../RAG/Embeddings/documentEmbedding.js";
import { ChunkModel } from "../document/chunk.schema.js";
import { DocumentModel } from "../document/document.schema.js";
import { topK } from "../../services/retrieval/index.js";
import type { QueryBodyInput } from "./query.schema.js";

export interface Citation {
  documentId: string;
  documentTitle: string;
  chunkId: string;
  score: number;
  excerpt: string;
}

export interface QueryResult {
  answer: string;
  citations: Citation[];
  retrievedCount: number;
}

const MAX_CHUNKS_PER_WORKSPACE = 2000; // brute-force guardrail


export class QueryService {
  async ask(
    workspaceId: string,
    input: QueryBodyInput,
  ): Promise<QueryResult> {
    if (!Types.ObjectId.isValid(workspaceId)) {
      throw AppError.notFound("Workspace not found");
    }
    const wsId = new Types.ObjectId(workspaceId);
    const k = input.topK ?? 5;

    const queryVector = await this.embedQuery(input.q);
    const chunks = await ChunkModel.find({ workspaceId: wsId })
      .sort({ createdAt: -1 })
      .limit(MAX_CHUNKS_PER_WORKSPACE)
      .lean()
      .exec();

    if (chunks.length === 0) {
      return {
        answer:
          "No indexed knowledge in this workspace yet. Upload a document and wait for its status to become ready, then ask again.",
        citations: [],
        retrievedCount: 0,
      };
    }

    const ranked = topK(chunks, (c) => c.embedding, queryVector, k);
    // Drop near-zero similarities — answering from them is hallucination.
    const relevant = ranked.filter((r) => r.score > 0.15);
    const picked = (relevant.length > 0 ? relevant : ranked.slice(0, 2)).slice(
      0,
      k,
    );

    const titles = await this.loadTitles(picked.map((p) => p.item.documentId));
    const context = picked
      .map((p, i) => `[${i + 1}] ${p.item.content}`)
      .join("\n\n");

    const answer = await this.generate(input.q, context);
    return {
      answer,
      citations: picked.map((p) => ({
        documentId: String(p.item.documentId),
        documentTitle: titles.get(String(p.item.documentId)) ?? "Untitled",
        chunkId: String(p.item._id),
        score: Number(p.score.toFixed(4)),
        excerpt:
          p.item.content.length > 300
            ? `${p.item.content.slice(0, 300)}…`
            : p.item.content,
      })),
      retrievedCount: picked.length,
    };
  }

  private async embedQuery(q: string): Promise<number[]> {
    try {
      return await getQueryEmbedding(q);
    } catch (error) {
      throw new AppError(
        500,
        `Failed to embed query: ${(error as Error).message}`,
        "EMBEDDING_ERROR",
      );
    }
  }

  private async loadTitles(documentIds: unknown[]): Promise<Map<string, string>> {
    const ids = [...new Set(documentIds.map(String))].filter((id) =>
      Types.ObjectId.isValid(id),
    );
    if (ids.length === 0) return new Map();
    const docs = await DocumentModel.find({
      _id: { $in: ids.map((id) => new Types.ObjectId(id)) },
    })
      .select({ title: 1 })
      .lean()
      .exec();
    return new Map(docs.map((d) => [String(d._id), d.title]));
  }

  private async generate(question: string, context: string): Promise<string> {
    let llm;
    try {
      llm = getMistralLLM();
    } catch (error) {
      throw new AppError(
        500,
        `LLM not configured: ${(error as Error).message}`,
        "LLM_CONFIG_ERROR",
      );
    }
    const prompt = [
      "You answer questions using ONLY the context below.",
      "If the context does not contain the answer, say you don't know.",
      "Cite sources inline like [1], [2] matching the context blocks.",
      "",
      `Context:\n${context}`,
      "",
      `Question: ${question}`,
      "Answer:",
    ].join("\n");

    try {
      const res: unknown = await llm.invoke(prompt);
      // LangChain LLM invoke returns a string; chat models return
      // AIMessage with .content. Handle both so a model swap is safe.
      const text =
        typeof res === "string"
          ? res
          : res !== null &&
              typeof res === "object" &&
              "content" in res &&
              typeof (res as { content: unknown }).content === "string"
            ? ((res as { content: string }).content as string)
            : JSON.stringify(res);
      return text.trim() || "I don't know based on the indexed documents.";
    } catch (error) {
      throw new AppError(
        500,
        `LLM request failed: ${(error as Error).message}`,
        "LLM_ERROR",
      );
    }
  }
}

export const queryService = new QueryService();
