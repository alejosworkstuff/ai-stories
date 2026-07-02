import { storySchema, type Story } from "../lib/ai/schema";
import { screenOutput, storyText } from "../lib/ai/guardrails";

export interface EvalCase {
  id: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  tone?: string;
  length?: "short" | "medium" | "long";
  grounded?: boolean;
  minParagraphs: number;
  /** When grounded, at least one of these corpus sources should appear in groundedOn. */
  expectSources?: string[];
}

export interface GraderResult {
  name: string;
  passed: boolean;
  detail?: string;
}

export function gradeSchemaValid(value: unknown): GraderResult {
  const parsed = storySchema.safeParse(value);
  return {
    name: "schema_valid",
    passed: parsed.success,
    detail: parsed.success ? undefined : parsed.error.issues[0]?.message,
  };
}

export function gradeMinParagraphs(story: Story, min: number): GraderResult {
  return {
    name: "min_paragraphs",
    passed: story.paragraphs.length >= min,
    detail: `${story.paragraphs.length} >= ${min}`,
  };
}

export function gradeHasChoices(story: Story): GraderResult {
  return { name: "has_choices", passed: story.choices.length >= 2 };
}

export function gradeNoPromptLeak(story: Story): GraderResult {
  const leak = screenOutput(storyText(story));
  return { name: "no_prompt_leak", passed: !leak.flagged, detail: leak.reason };
}

export function gradeGroundedRelevance(story: Story, testCase: EvalCase): GraderResult {
  if (!testCase.grounded) {
    return { name: "grounded_relevance", passed: true };
  }

  const cited = story.groundedOn;
  if (testCase.expectSources?.length) {
    const hit = testCase.expectSources.some((source) => cited.includes(source));
    return {
      name: "grounded_relevance",
      passed: hit,
      detail: hit
        ? undefined
        : `expected one of [${testCase.expectSources.join(", ")}], got [${cited.join(", ") || "none"}]`,
    };
  }

  return {
    name: "grounded_relevance",
    passed: cited.length >= 1,
    detail: `${cited.length} source(s)`,
  };
}

export function gradeStory(story: Story, testCase: EvalCase): GraderResult[] {
  return [
    gradeMinParagraphs(story, testCase.minParagraphs),
    gradeHasChoices(story),
    gradeNoPromptLeak(story),
    gradeGroundedRelevance(story, testCase),
  ];
}

export function score(results: GraderResult[]): number {
  if (results.length === 0) return 0;
  return results.filter((result) => result.passed).length / results.length;
}
