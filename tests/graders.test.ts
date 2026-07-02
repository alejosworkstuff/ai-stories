import { describe, it, expect } from "vitest";
import {
  gradeSchemaValid,
  gradeMinParagraphs,
  gradeHasChoices,
  gradeNoPromptLeak,
  gradeGroundedRelevance,
  score,
} from "../evals/graders";
import { EVAL_CASES } from "../evals/dataset";
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

  it("checks grounded relevance when sources are expected", () => {
    const grounded: Story = { ...validStory, groundedOn: ["narrative-structure.md"] };
    expect(
      gradeGroundedRelevance(grounded, {
        id: "x",
        messages: [],
        grounded: true,
        minParagraphs: 2,
        expectSources: ["narrative-structure.md"],
      }).passed
    ).toBe(true);
    expect(
      gradeGroundedRelevance({ ...validStory, groundedOn: [] }, {
        id: "x",
        messages: [],
        grounded: true,
        minParagraphs: 2,
        expectSources: ["narrative-structure.md"],
      }).passed
    ).toBe(false);
  });

  it("skips grounded relevance for non-grounded cases", () => {
    expect(
      gradeGroundedRelevance(validStory, {
        id: "x",
        messages: [],
        minParagraphs: 2,
      }).passed
    ).toBe(true);
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

describe("EVAL_CASES golden set", () => {
  it("has 10 cases covering schema, relevance, and injection", () => {
    expect(EVAL_CASES).toHaveLength(10);
    expect(EVAL_CASES.filter((c) => c.grounded).length).toBe(5);
    expect(EVAL_CASES.filter((c) => c.id.startsWith("injection-")).length).toBe(3);
    expect(new Set(EVAL_CASES.map((c) => c.id)).size).toBe(10);
  });
});
