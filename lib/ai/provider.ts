import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export const CHAT_MODEL_ID = process.env.AI_MODEL ?? "llama-4-scout-17b-16e-instruct";
export const EMBEDDING_MODEL_ID = process.env.AI_EMBEDDING_MODEL ?? "text-embedding-3-small";
export const EMBEDDING_DIM = Number.parseInt(process.env.EMBEDDING_DIM ?? "1536", 10);

let cached: ReturnType<typeof createOpenAICompatible> | null = null;

function provider() {
  if (cached) return cached;
  const baseURL = process.env.AI_BASE_URL;
  if (!baseURL) {
    throw new Error("AI_BASE_URL is not configured (see .env.example)");
  }
  const apiKey = process.env.AI_API_KEY ?? process.env.GROQ_API_KEY ?? "";
  cached = createOpenAICompatible({
    name: "ai-stories-gateway",
    baseURL,
    apiKey,
  });
  return cached;
}

export function languageModel(modelId: string = CHAT_MODEL_ID) {
  return provider().chatModel(modelId);
}

export function embeddingModel(modelId: string = EMBEDDING_MODEL_ID) {
  return provider().textEmbeddingModel(modelId);
}
