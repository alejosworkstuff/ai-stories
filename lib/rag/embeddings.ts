import { embed, embedMany } from "ai";
import { embeddingModel } from "../ai/provider.js";
import {
  LOCAL_EMBEDDING_DIM,
  localBagEmbedMany,
  localBagEmbedQuery,
} from "./embeddings-local.js";

function useLocalEmbeddings(): boolean {
  const forced = process.env.FORCE_LOCAL_EMBEDDINGS?.trim().toLowerCase();
  if (forced === "1" || forced === "true" || forced === "yes") return true;
  return !process.env.AI_BASE_URL?.trim();
}

export function activeEmbeddingDim(): number {
  if (useLocalEmbeddings()) return LOCAL_EMBEDDING_DIM;
  return Number.parseInt(process.env.EMBEDDING_DIM ?? "1536", 10);
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  if (useLocalEmbeddings()) return localBagEmbedMany(texts);

  const { embeddings } = await embedMany({
    model: embeddingModel(),
    values: texts,
  });
  return embeddings;
}

export async function embedQuery(text: string): Promise<number[]> {
  if (useLocalEmbeddings()) return localBagEmbedQuery(text);

  const { embedding } = await embed({
    model: embeddingModel(),
    value: text,
  });
  return embedding;
}
