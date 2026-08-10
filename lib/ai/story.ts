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
const JSON_OUTPUT_SUFFIX = [
  " Respond with a single JSON object only (no markdown fences).",
  ' Exact keys: "title" (string), "paragraphs" (string[]), "choices" (string[], at least 2), "groundedOn" (string[] of corpus filenames or empty).',
].join("");

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

async function generateViaTextJson(args: {
  model: ReturnType<typeof languageModel>;
  system: string;
  messages: ModelMessage[];
}): Promise<{
  object: unknown;
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
}> {
  const textResult = await generateText({
    model: args.model,
    system: args.system,
    messages: args.messages,
  });
  return {
    object: extractJsonObject(textResult.text),
    usage: textResult.usage,
  };
}

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
  const messages = params.messages as ModelMessage[];

  for (let attempt = 0; attempt <= maxRepairAttempts; attempt++) {
    const system = systemBase + grounding + repairNote + JSON_OUTPUT_SUFFIX;
    let object: unknown | undefined;
    let usage: { inputTokens?: number; outputTokens?: number; totalTokens?: number } | undefined;
    const tryObjectFirst = Boolean(params.grounded) || attempt > 0;

    if (tryObjectFirst) {
      try {
        const result = await generateObject({
          model,
          schema: storySchema,
          schemaName: "Story",
          schemaDescription: "Collaborative fiction continuation with title, paragraphs, choices, groundedOn",
          system,
          messages,
        });
        object = result.object;
        usage = result.usage;
      } catch (objectError) {
        lastDetail = String((objectError as Error)?.message ?? objectError);
      }

      const objectValidation = object !== undefined ? validateStoryOutput(object) : null;
      if (objectValidation?.ok) {
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
        return { story: objectValidation.story, retrieved };
      }
      if (objectValidation && !objectValidation.ok) {
        lastDetail = objectValidation.detail;
      }
    }

    try {
      const textPath = await generateViaTextJson({ model, system, messages });
      object = textPath.object;
      usage = textPath.usage;
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
    } catch (textError) {
      lastDetail = String((textError as Error)?.message ?? textError);
    }

    repairNote = REPAIR_SUFFIX;
  }

  throw new StoryOutputError(lastDetail);
}
