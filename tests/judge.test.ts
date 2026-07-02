import { describe, it, expect, vi } from "vitest";
import {
  buildJudgePrompt,
  judgeVerdictToGrader,
  JUDGE_PASS_SCORE,
  runLlmJudge,
} from "../evals/judge";
import type { Story } from "../lib/ai/schema";

const story: Story = {
  title: "The Vault",
  paragraphs: ["Mara picked the lock.", "Alarms stayed silent.", "Inside: an empty box."],
  choices: ["Run", "Hide"],
  groundedOn: ["narrative-structure.md"],
};

describe("buildJudgePrompt", () => {
  it("includes the user seed and story text", () => {
    const prompt = buildJudgePrompt(
      {
        id: "test",
        messages: [{ role: "user", content: "A thief opens a vault." }],
        tone: "tense",
        grounded: true,
        minParagraphs: 2,
      },
      story
    );
    expect(prompt).toContain("A thief opens a vault.");
    expect(prompt).toContain("The Vault");
    expect(prompt).toContain("Grounded mode");
  });
});

describe("judgeVerdictToGrader", () => {
  it("passes when pass=true and score meets threshold", () => {
    const result = judgeVerdictToGrader({
      pass: true,
      score: JUDGE_PASS_SCORE,
      reason: "Relevant heist opening.",
    });
    expect(result.passed).toBe(true);
    expect(result.name).toBe("llm_judge");
  });

  it("fails low scores even when pass=true", () => {
    const result = judgeVerdictToGrader({
      pass: true,
      score: JUDGE_PASS_SCORE - 1,
      reason: "Weak relevance.",
    });
    expect(result.passed).toBe(false);
  });
});

describe("runLlmJudge", () => {
  it("maps generateObject output to a grader result", async () => {
    const generateObjectFn = vi.fn().mockResolvedValue({
      object: { pass: true, score: 4, reason: "Coherent fiction." },
    });

    const result = await runLlmJudge(
      story,
      {
        id: "test",
        messages: [{ role: "user", content: "A thief opens a vault." }],
        minParagraphs: 2,
      },
      { model: "mock-model" as never, generateObjectFn }
    );

    expect(result.passed).toBe(true);
    expect(generateObjectFn).toHaveBeenCalledOnce();
  });
});
