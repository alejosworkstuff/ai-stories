import { generateObject, type ModelMessage } from "ai";
import { languageModel } from "./provider.js";
import { buildSystemPrompt } from "./prompt.js";
import type { Story } from "./schema.js";
import { prepareRetrievedContent, validateStoryOutput } from "./guardrails.js";
import { StoryOutputError } from "./errors.js";
import { retrieve as defaultRetrieve, type RetrievedChunk } from "../rag/retrieve.js";
import { storySchema } from "./schema.js";

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

/**
 * Structured (Zod-typed) story generation. Used by the eval harness and any
 * caller that wants validated JSON instead of streamed prose.
 */
export async function generateStoryObject(
  params: StoryObjectParams,
  deps: StoryObjectDeps = {}
): Promise<{ story: Story; retrieved: RetrievedChunk[] }> {
  const retrieve = deps.retrieve ?? defaultRetrieve;
  const model = deps.model ?? languageModel();
  const maxRepairAttempts = deps.maxRepairAttempts ?? 1;

  const lastUser = [...params.messages].reverse().find((m) => m.role === "user");
  const retrieved =
    params.grounded && lastUser ? await retrieve(lastUser.content, 4) : [];
  const grounding = retrieved.length
    ? "\nReference passages (cite as [source-file] when used):\n" +
      retrieved
        .map((passage) => `[${passage.source}] ${prepareRetrievedContent(passage.content)}`)
        .join("\n")
    : "";

  let repairNote = "";
  let lastDetail = "invalid_story";

  for (let attempt = 0; attempt <= maxRepairAttempts; attempt++) {
    const { object } = await generateObject({
      model,
      schema: storySchema,
      system: buildSystemPrompt(params.tone, params.length) + grounding + repairNote,
      messages: params.messages as ModelMessage[],
    });

    const validation = validateStoryOutput(object);
    if (validation.ok) {
      return { story: validation.story, retrieved };
    }

    lastDetail = validation.detail;
    repairNote = REPAIR_SUFFIX;
  }

  throw new StoryOutputError(lastDetail);
}
