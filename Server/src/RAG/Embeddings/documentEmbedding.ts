import { Mistral } from "@mistralai/mistralai";

// Lazy singleton: importing this module must never crash boot or
// read env at import time. The old code did
// `new Mistral({ apiKey: process.env... })` at module top-level,
// which meant (a) a missing key threw on `import`, killing the
// whole server, and (b) dotenv load order could give `undefined`.
// Same pattern as getImageKit()/getMistralLLM().
let cached: Mistral | null = null;

function getClient(): Mistral {
  if (cached) return cached;
  const apiKey = process.env.MISTRAL_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "MISTRAL_API_KEY is not defined — set it in .env to use embeddings",
    );
  }
  cached = new Mistral({ apiKey });
  return cached;
}

const EMBED_MODEL = "mistral-embed"; // 1024 dims
const EMBED_BATCH_SIZE = 50; // Mistral rejects huge inputs[] arrays

export default async function getEmbeddings(
  inputs: string[],
): Promise<number[][]> {
  const texts = inputs.map((t) => t.trim()).filter(Boolean);
  if (texts.length === 0) return [];

  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBED_BATCH_SIZE);
    let response;
    try {
      response = await getClient().embeddings.create({
        model: EMBED_MODEL,
        inputs: batch,
      });
    } catch (error) {
      throw new Error(
        `Embedding failed for batch starting at index ${i}: ${(error as Error).message}`,
      );
    }
    for (const item of response.data) {
      out.push(item.embedding!);
    }
  }

  if (out.length !== texts.length) {
    throw new Error(
      `Embedding count mismatch: sent ${texts.length}, got ${out.length}`,
    );
  }
  return out;
}

export async function getQueryEmbedding(query: string): Promise<number[]> {
  const [vec] = await getEmbeddings([query]);
  if (!vec) throw new Error("Failed to embed query");
  return vec;
}
