import { randomUUID } from "node:crypto";

export interface GenerationTelemetry {
  model: string;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  steps?: number;
  toolCalls?: number;
  retrievedPassages?: number;
  finishReason?: string;
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
