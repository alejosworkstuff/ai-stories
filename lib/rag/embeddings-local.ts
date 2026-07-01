/** Dimension for the offline bag-of-words embedder (no API key required). */
export const LOCAL_EMBEDDING_DIM = 384;

let warned = false;

function warnOnce(): void {
  if (warned) return;
  warned = true;
  console.warn(
    "embeddings: using local bag-of-words vectors (AI_BASE_URL unset). " +
      "Set AI_BASE_URL + AI_EMBEDDING_MODEL for production semantic search."
  );
}

/** Deterministic, normalized bag-of-words vectors for offline ingest + retrieval. */
export function localBagEmbed(text: string, dim: number = LOCAL_EMBEDDING_DIM): number[] {
  const vec = new Array<number>(dim).fill(0);
  const tokens = text.toLowerCase().match(/[a-z0-9']+/g) ?? [];
  for (const token of tokens) {
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      hash = (hash * 31 + token.charCodeAt(i)) >>> 0;
    }
    vec[hash % dim] += 1;
  }
  const norm = Math.sqrt(vec.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vec.map((value) => value / norm);
}

export function localBagEmbedMany(texts: string[], dim?: number): number[][] {
  warnOnce();
  return texts.map((text) => localBagEmbed(text, dim));
}

export function localBagEmbedQuery(text: string, dim?: number): number[] {
  warnOnce();
  return localBagEmbed(text, dim);
}
