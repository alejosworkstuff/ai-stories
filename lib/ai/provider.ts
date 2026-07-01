import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * The flagship talks to the LLM through the Vercel AI SDK's OpenAI-compatible
 * provider. `@ai-sdk/replicate` only exposes image models, so to "use Replicate"
 * for text we front it with an OpenAI-compatible gateway and reuse the Replicate
 * token. Everything downstream is provider-agnostic: swap to OpenAI / Anthropic /
 * Groq by changing AI_BASE_URL + AI_API_KEY + the model ids.
 */

export const CHAT_MODEL_ID = process.env.AI_MODEL ?? "meta/meta-llama-3-8b-instruct";
export const EMBEDDING_MODEL_ID = process.env.AI_EMBEDDING_MODEL ?? "text-embedding-3-small";
export const EMBEDDING_DIM = Number.parseInt(process.env.EMBEDDING_DIM ?? "1536", 10);

let cached: ReturnType<typeof createOpenAICompatible> | null = null;

function provider() {
  if (cached) return cached;
  const baseURL = process.env.AI_BASE_URL;
  if (!baseURL) {
    throw new Error("AI_BASE_URL is not configured (see .env.example)");
  }
  const apiKey = process.env.AI_API_KEY ?? process.env.REPLICATE_API_TOKEN ?? "";
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
