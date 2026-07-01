import { storySchema, type Story } from "../lib/ai/schema";

export interface EvalCase {
  id: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  tone?: string;
  length?: "short" | "medium" | "long";
  grounded?: boolean;
  minParagraphs: number;
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

const LEAK_PATTERNS: RegExp[] = [
  /system prompt/i,
  /these instructions/i,
  /as an ai language model/i,
  /searchCorpus/i,
  /untrusted context/i,
];

export function gradeNoPromptLeak(story: Story): GraderResult {
  const text = [story.title, ...story.paragraphs, ...story.choices].join("\n");
  const leak = LEAK_PATTERNS.find((pattern) => pattern.test(text));
  return { name: "no_prompt_leak", passed: !leak, detail: leak?.source };
}

export function gradeStory(story: Story, testCase: EvalCase): GraderResult[] {
  return [
    gradeMinParagraphs(story, testCase.minParagraphs),
    gradeHasChoices(story),
    gradeNoPromptLeak(story),
  ];
}

export function score(results: GraderResult[]): number {
  if (results.length === 0) return 0;
  return results.filter((result) => result.passed).length / results.length;
}
