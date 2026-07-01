import { embedQuery } from "./embeddings.js";
import { similaritySearch, type RetrievedChunk } from "./store.js";

export type { RetrievedChunk };

/** Embed a query and return the top-k grounding passages from pgvector. */
export async function retrieve(query: string, k = 4): Promise<RetrievedChunk[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const embedding = await embedQuery(trimmed);
  return similaritySearch(embedding, k);
}
