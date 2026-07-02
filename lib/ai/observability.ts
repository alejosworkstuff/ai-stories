import { randomUUID } from "node:crypto";

export interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface GenerationTelemetry {
  model: string;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCostUsd?: number;
  promptPreview?: string;
  steps?: number;
  toolCalls?: number;
  retrievedPassages?: number;
  finishReason?: string;
  source?: "stream" | "structured";
}

const COST_PER_MILLION: Record<string, { input: number; output: number }> = {
  "llama-3.3-70b-versatile": { input: 0, output: 0 },
  default: { input: 0.15, output: 0.6 },
};

const PROMPT_PREVIEW_MAX = 240;

export function buildPromptPreview(params: {
  system?: string;
  messages: ReadonlyArray<{ role: string; content: string }>;
  maxLen?: number;
}): string {
  const lastUser = [...params.messages].reverse().find((m) => m.role === "user");
  const parts = [
    lastUser ? `user: ${lastUser.content}` : "",
    params.system ? `system: ${params.system}` : "",
  ].filter(Boolean);
  const joined = parts.join(" | ");
  const maxLen = params.maxLen ?? PROMPT_PREVIEW_MAX;
  return joined.length <= maxLen ? joined : `${joined.slice(0, maxLen - 1)}…`;
}

export function estimateCostUsd(model: string, usage?: TokenUsage): number {
  const rates = COST_PER_MILLION[model] ?? COST_PER_MILLION.default!;
  const input = usage?.inputTokens ?? 0;
  const output = usage?.outputTokens ?? 0;
  const cost = (input * rates.input + output * rates.output) / 1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

/** Structured, always-on telemetry (one JSON line per generation) + optional
 * best-effort forwarding to Langfuse when LANGFUSE_* is configured. */
export function logGeneration(telemetry: GenerationTelemetry): void {
  console.log(JSON.stringify({ evt: "generation", ...telemetry }));
  void forwardToLangfuse(telemetry);
}

async function forwardToLangfuse(telemetry: GenerationTelemetry): Promise<void> {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  if (!publicKey || !secretKey) return;

  const baseUrl = process.env.LANGFUSE_BASE_URL ?? "https://cloud.langfuse.com";
  try {
    const auth = Buffer.from(`${publicKey}:${secretKey}`).toString("base64");
    await fetch(`${baseUrl}/api/public/ingestion`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        batch: [
          {
            id: randomUUID(),
            type: "trace-create",
            timestamp: new Date().toISOString(),
            body: {
              id: randomUUID(),
              name: "story-generation",
              metadata: telemetry,
            },
          },
        ],
      }),
    });
  } catch (error) {
    console.error("langfuse_forward_failed", error);
  }
}
