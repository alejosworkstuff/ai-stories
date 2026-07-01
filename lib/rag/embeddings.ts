import { embed, embedMany } from "ai";
import { embeddingModel } from "../ai/provider";

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const { embeddings } = await embedMany({
    model: embeddingModel(),
    values: texts,
  });
  return embeddings;
}

export async function embedQuery(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: embeddingModel(),
    value: text,
  });
  return embedding;
}
