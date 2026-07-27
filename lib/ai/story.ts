import { generateObject, generateText, type ModelMessage } from "ai";
import { languageModel, CHAT_MODEL_ID } from "./provider.js";
import { buildSystemPrompt } from "./prompt.js";
import type { Story } from "./schema.js";
import { prepareRetrievedContent, validateStoryOutput } from "./guardrails.js";
import { StoryOutputError } from "./errors.js";
import { retrieve as defaultRetrieve, type RetrievedChunk } from "../rag/retrieve.js";
import { storySchema } from "./schema.js";
import { buildPromptPreview, estimateCostUsd, logGeneration } from "./observability.js";

export interface StoryObjectParams {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  tone?: string;
  length?: string;
  grounded?: boolean;
}

export interface StoryObjectDeps {
  retrieve?: (query: string, k?: number) => Promise<RetrievedChunk[]>;
  model?: ReturnType<typeof languageModel>;
  maxRepairAttempts?: number;
}

const REPAIR_SUFFIX =
  "\nRepair: your previous answer failed validation. Return schema-valid story JSON only — no meta commentary, tool names, or instruction leakage.";

/** Groq requires the word "json" in messages when using response_format json_object. */
const JSON_OUTPUT_SUFFIX =
  " Respond with a single JSON object (title, paragraphs, choices, groundedOn).";

function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? text).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("no_json_object");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

/**
 * Structured (Zod-typed) story generation. Used by the eval harness and any
 * caller that wants validated JSON instead of streamed prose.
 *
 * Tries `generateObject` first; on providers that lack structured outputs
 * (e.g. Groq via OpenAI-compatible), falls back to `generateText` + JSON parse.
 */
export async function generateStoryObject(
  params: StoryObjectParams,
  deps: StoryObjectDeps = {}
): Promise<{ story: Story; retrieved: RetrievedChunk[] }> {
  const retrieve = deps.retrieve ?? defaultRetrieve;
  const model = deps.model ?? languageModel();
  const maxRepairAttempts = deps.maxRepairAttempts ?? 3;
  const startedAt = Date.now();

  const lastUser = [...params.messages].reverse().find((m) => m.role === "user");
  const retrieved =
    params.grounded && lastUser ? await retrieve(lastUser.content, 4) : [];
  const grounding = retrieved.length
    ? "\nReference passages (list used source filenames only in groundedOn; never insert them into paragraphs):\n" +
      retrieved
        .map((passage) => `[${passage.source}] ${prepareRetrievedContent(passage.content)}`)
        .join("\n")
    : "";

  let repairNote = "";
  let lastDetail = "invalid_story";
  const systemBase = buildSystemPrompt(params.tone, params.length);

  for (let attempt = 0; attempt <= maxRepairAttempts; attempt++) {
    const system = systemBase + grounding + repairNote + JSON_OUTPUT_SUFFIX;
    let object: unknown;
    let usage: { inputTokens?: number; outputTokens?: number; totalTokens?: number } | undefined;

    try {
      const result = await generateObject({
        model,
        schema: storySchema,
        schemaName: "Story",
        schemaDescription: "Collaborative fiction continuation with title, paragraphs, choices, groundedOn",
        system,
        messages: params.messages as ModelMessage[],
      });
      object = result.object;
      usage = result.usage;
    } catch (objectError) {
      try {
        const textResult = await generateText({
          model,
          system,
          messages: params.messages as ModelMessage[],
        });
        object = extractJsonObject(textResult.text);
        usage = textResult.usage;
      } catch (textError) {
        lastDetail = String(
          (textError as Error)?.message ?? (objectError as Error)?.message ?? objectError
        );
        repairNote = REPAIR_SUFFIX;
        continue;
      }
    }

    const validation = validateStoryOutput(object);
    if (validation.ok) {
      logGeneration({
        model: CHAT_MODEL_ID,
        latencyMs: Date.now() - startedAt,
        inputTokens: usage?.inputTokens,
        outputTokens: usage?.outputTokens,
        totalTokens: usage?.totalTokens,
        estimatedCostUsd: estimateCostUsd(CHAT_MODEL_ID, usage),
        promptPreview: buildPromptPreview({ system, messages: params.messages }),
        retrievedPassages: retrieved.length,
        source: "structured",
      });
      return { story: validation.story, retrieved };
    }

    lastDetail = validation.detail;
    repairNote = REPAIR_SUFFIX;
  }

  throw new StoryOutputError(lastDetail);
}
