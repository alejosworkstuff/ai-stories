import { generateObject } from "ai";
import { z } from "zod";
import { languageModel } from "../lib/ai/provider.js";
import { storyText } from "../lib/ai/guardrails.js";
import type { Story } from "../lib/ai/schema.js";
import type { EvalCase, GraderResult } from "./graders.js";

export const judgeVerdictSchema = z.object({
  pass: z.boolean(),
  score: z.number().min(1).max(5),
  reason: z.string().max(300),
});

export type JudgeVerdict = z.infer<typeof judgeVerdictSchema>;

export const JUDGE_PASS_SCORE = 3;

export function buildJudgePrompt(testCase: EvalCase, story: Story): string {
  const lastUser = [...testCase.messages].reverse().find((m) => m.role === "user");
  const userSeed = lastUser?.content ?? "(no user message)";

  return [
    "You are an eval judge for a collaborative fiction generator.",
    "Score the story for relevance to the user's creative prompt and basic fiction quality.",
    "Fail (pass=false) if the story ignores the prompt, is incoherent, or leaks system/tool instructions.",
    "",
    `User prompt: ${userSeed}`,
    testCase.tone ? `Requested tone: ${testCase.tone}` : "",
    testCase.grounded ? "Grounded mode: corpus citations are expected when craft guidance applies." : "",
    "",
    "Story output:",
    storyText(story),
    "",
    "Return pass=true only when relevance and quality are acceptable (score >= 3).",
    "Respond with JSON containing pass (boolean), score (1-5), and reason (string).",
  ]
    .filter(Boolean)
    .join("\n");
}

export function judgeVerdictToGrader(verdict: JudgeVerdict): GraderResult {
  const passed = verdict.pass && verdict.score >= JUDGE_PASS_SCORE;
  return {
    name: "llm_judge",
    passed,
    detail: `${verdict.score}/5 — ${verdict.reason}`,
  };
}

export interface LlmJudgeDeps {
  model?: ReturnType<typeof languageModel>;
  generateObjectFn?: typeof generateObject;
}

export async function runLlmJudge(
  story: Story,
  testCase: EvalCase,
  deps: LlmJudgeDeps = {}
): Promise<GraderResult> {
  const generateObjectFn = deps.generateObjectFn ?? generateObject;
  const model = deps.model ?? languageModel();

  const { object } = await generateObjectFn({
    model,
    schema: judgeVerdictSchema,
    schemaName: "JudgeVerdict",
    prompt: buildJudgePrompt(testCase, story),
  }).catch((error: unknown) => {
    return {
      object: {
        pass: false,
        score: 1,
        reason: String((error as Error)?.message ?? error),
      },
    };
  });

  return judgeVerdictToGrader(object as JudgeVerdict);
}
