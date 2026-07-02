import { streamText, stepCountIs, tool, type ModelMessage } from "ai";
import { z } from "zod";
import { languageModel, CHAT_MODEL_ID } from "./provider.js";
import { buildSystemPrompt } from "./prompt.js";
import { prepareRetrievedContent, screenOutput } from "./guardrails.js";
import { isCreditsError } from "./errors.js";
import { logGeneration, buildPromptPreview, estimateCostUsd } from "./observability.js";
import { retrieve as defaultRetrieve, type RetrievedChunk } from "../rag/retrieve.js";

export interface GenerateParams {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  tone?: string;
  length?: string;
  sessionId?: string;
  signal?: AbortSignal;
}

export interface GenerationResult {
  streamed: boolean;
  status?: number;
  errorCode?: string;
}

/** Minimal Node response surface used for streaming (keeps the handler testable). */
export interface ResponseSink {
  statusCode?: number;
  setHeader(name: string, value: string): unknown;
  write(chunk: string): unknown;
  end(): unknown;
}

export interface StoryStreamerDeps {
  retrieve?: (query: string, k?: number) => Promise<RetrievedChunk[]>;
  model?: ReturnType<typeof languageModel>;
  maxSteps?: number;
}

/**
 * Agentic, RAG-grounded, streaming story generation:
 * - `streamText` runs a tool-calling loop (bounded by `stopWhen`)
 * - the `searchCorpus` tool retrieves grounding passages from pgvector
 * - retrieved content is fenced as untrusted (prompt-injection defense)
 * - tokens stream to the response; telemetry is logged on finish
 * - provider/credit errors before the first token return a JSON status so the
 *   client can fall back to the local generator.
 */
export function createStoryStreamer(deps: StoryStreamerDeps = {}) {
  const retrieve = deps.retrieve ?? defaultRetrieve;
  const maxSteps = deps.maxSteps ?? 4;

  return async function streamStoryToResponse(
    params: GenerateParams,
    res: ResponseSink
  ): Promise<GenerationResult> {
    const model = deps.model ?? languageModel();
    const startedAt = Date.now();
    let retrievedCount = 0;

    const searchCorpus = tool({
      description:
        "Search the storytelling-craft corpus (narrative structure, tone, archetypes) for grounding passages. Call it when a craft decision would benefit from reference material.",
      inputSchema: z.object({
        query: z.string().describe("What craft guidance to look up"),
      }),
      execute: async ({ query }) => {
        const passages = await retrieve(query, 4);
        retrievedCount += passages.length;
        return {
          passages: passages.map((passage) => ({
            source: passage.source,
            content: prepareRetrievedContent(passage.content),
          })),
        };
      },
    });

    const messages = params.messages.map((message) => ({
      role: message.role,
      content: message.content,
    })) as ModelMessage[];

    let streamError: unknown = null;
    let firstChunkSent = false;
    let accumulated = "";

    const systemPrompt = buildSystemPrompt(params.tone, params.length);

    const result = streamText({
      model,
      system: systemPrompt,
      messages,
      tools: { searchCorpus },
      stopWhen: stepCountIs(maxSteps),
      abortSignal: params.signal,
      onError: ({ error }) => {
        streamError = error;
        console.error("stream_error", error);
      },
      onFinish: ({ usage, steps, finishReason }) => {
        const toolCalls = steps.reduce(
          (total, step) => total + (step.toolCalls?.length ?? 0),
          0
        );
        logGeneration({
          model: CHAT_MODEL_ID,
          latencyMs: Date.now() - startedAt,
          inputTokens: usage?.inputTokens,
          outputTokens: usage?.outputTokens,
          totalTokens: usage?.totalTokens,
          estimatedCostUsd: estimateCostUsd(CHAT_MODEL_ID, usage),
          promptPreview: buildPromptPreview({ system: systemPrompt, messages: params.messages }),
          steps: steps.length,
          toolCalls,
          retrievedPassages: retrievedCount,
          finishReason,
          source: "stream",
        });
      },
    });

    try {
      for await (const chunk of result.textStream) {
        accumulated += chunk;
        const leak = screenOutput(accumulated);
        if (leak.flagged) {
          streamError = new Error("output_guardrail");
          if (!firstChunkSent) {
            return {
              streamed: false,
              status: 422,
              errorCode: "unsafe_output",
            };
          }
          break;
        }

        if (!firstChunkSent) {
          res.statusCode = 200;
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          res.setHeader("Cache-Control", "no-store");
          firstChunkSent = true;
        }
        res.write(chunk);
      }
    } catch (error) {
      if (!streamError) streamError = error;
    }

    if (!firstChunkSent) {
      const credits = isCreditsError(streamError);
      return {
        streamed: false,
        status: credits ? 402 : 500,
        errorCode: credits ? "provider_no_credits" : "generation_failed",
      };
    }

    res.end();
    return { streamed: true };
  };
}
