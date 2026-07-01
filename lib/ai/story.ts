import { generateObject, type ModelMessage } from "ai";
import { languageModel } from "./provider";
import { buildSystemPrompt } from "./prompt";
import { storySchema, type Story } from "./schema";
import { wrapUntrusted } from "./guardrails";
import { retrieve as defaultRetrieve, type RetrievedChunk } from "../rag/retrieve";

export interface StoryObjectParams {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  tone?: string;
  length?: string;
  grounded?: boolean;
}

export interface StoryObjectDeps {
  retrieve?: (query: string, k?: number) => Promise<RetrievedChunk[]>;
  model?: ReturnType<typeof languageModel>;
}

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

  const lastUser = [...params.messages].reverse().find((m) => m.role === "user");
  const retrieved =
    params.grounded && lastUser ? await retrieve(lastUser.content, 4) : [];
  const grounding = retrieved.length
    ? "\nReference passages:\n" +
      retrieved.map((passage) => wrapUntrusted(passage.content)).join("\n")
    : "";

  const { object } = await generateObject({
    model,
    schema: storySchema,
    system: buildSystemPrompt(params.tone, params.length) + grounding,
    messages: params.messages as ModelMessage[],
  });

  return { story: object, retrieved };
}
