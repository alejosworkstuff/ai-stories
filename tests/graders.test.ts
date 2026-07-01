import { describe, it, expect } from "vitest";
import {
  gradeSchemaValid,
  gradeMinParagraphs,
  gradeHasChoices,
  gradeNoPromptLeak,
  score,
} from "../evals/graders";
import type { Story } from "../lib/ai/schema";

const validStory: Story = {
  title: "The Bottle",
  paragraphs: ["The keeper found a bottle.", "Inside was a map.", "He set sail."],
  choices: ["Follow the map", "Burn it"],
  groundedOn: ["narrative-structure.md"],
};

describe("gradeSchemaValid", () => {
  it("passes a well-formed story", () => {
    expect(gradeSchemaValid(validStory).passed).toBe(true);
  });

  it("fails malformed objects", () => {
    expect(gradeSchemaValid({ title: "x" }).passed).toBe(false);
    expect(gradeSchemaValid({ ...validStory, choices: ["only one"] }).passed).toBe(false);
  });
});

describe("story graders", () => {
  it("checks minimum paragraphs", () => {
    expect(gradeMinParagraphs(validStory, 3).passed).toBe(true);
    expect(gradeMinParagraphs(validStory, 5).passed).toBe(false);
  });

  it("checks choices presence", () => {
    expect(gradeHasChoices(validStory).passed).toBe(true);
  });

  it("flags prompt leakage", () => {
    const leaky: Story = {
      ...validStory,
      paragraphs: ["As an AI language model, I cannot..."],
    };
    expect(gradeNoPromptLeak(leaky).passed).toBe(false);
    expect(gradeNoPromptLeak(validStory).passed).toBe(true);
  });
});

describe("score", () => {
  it("computes the pass ratio", () => {
    expect(
      score([
        { name: "a", passed: true },
        { name: "b", passed: false },
      ])
    ).toBe(0.5);
    expect(score([])).toBe(0);
  });
});
