import { describe, it, expect } from "vitest";
import { storySchema, generateRequestSchema } from "../lib/ai/schema";

describe("storySchema", () => {
  it("accepts a valid story turn", () => {
    const parsed = storySchema.safeParse({
      title: "The Crossing",
      paragraphs: ["The ferry left at dawn."],
      choices: ["Stay aboard", "Jump overboard"],
      groundedOn: ["narrative-structure.md"],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects stories without enough choices", () => {
    const parsed = storySchema.safeParse({
      title: "The Crossing",
      paragraphs: ["The ferry left at dawn."],
      choices: ["Only one"],
    });
    expect(parsed.success).toBe(false);
  });

  it("defaults groundedOn to an empty array", () => {
    const parsed = storySchema.parse({
      title: "The Crossing",
      paragraphs: ["The ferry left at dawn."],
      choices: ["A", "B"],
    });
    expect(parsed.groundedOn).toEqual([]);
  });
});

describe("generateRequestSchema", () => {
  it("accepts a minimal valid request", () => {
    const parsed = generateRequestSchema.safeParse({
      messages: [{ role: "user", content: "A knight rides east." }],
      tone: "epic",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects missing tone", () => {
    const parsed = generateRequestSchema.safeParse({
      messages: [{ role: "user", content: "A knight rides east." }],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects unknown length values", () => {
    const parsed = generateRequestSchema.safeParse({
      messages: [{ role: "user", content: "seed" }],
      tone: "noir",
      length: "xl",
    });
    expect(parsed.success).toBe(false);
  });
});
