/**
 * Brute-force cosine similarity. Why not $vectorSearch / pgvector yet:
 * local mongod has no vector index (Atlas-only), and adding Postgres
 * for vectors alone doubles your infra before you have scale. Cosine
 * in Node is ~10ms per 1k chunks — correct until ~10k chunks per
 * workspace, at which point swap `retrieve()` internals for an index
 * without changing callers.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export interface Scored<T> {
  item: T;
  score: number;
}

export function topK<T>(
  items: T[],
  getVector: (item: T) => number[],
  query: number[],
  k: number,
): Scored<T>[] {
  return items
    .map((item) => ({ item, score: cosineSimilarity(query, getVector(item)) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, k));
}
