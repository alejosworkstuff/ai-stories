import { describe, expect, it } from "vitest";
import { compactStoryMessages, compactStoryText, MAX_COMPACTED_STORY_CHARS } from "../lib/ai/context";

describe("story context compaction", () => {
  it("preserves short stories without changing them", () => {
    expect(compactStoryText("A short story.")).toBe("A short story.");
  });

  it("keeps the beginning and latest scene within the context budget", () => {
    const story = `BEGIN${"x".repeat(MAX_COMPACTED_STORY_CHARS)}END`;
    const compacted = compactStoryText(story);

    expect(compacted.length).toBeLessThanOrEqual(MAX_COMPACTED_STORY_CHARS);
    expect(compacted.startsWith("BEGIN")).toBe(true);
    expect(compacted.endsWith("END")).toBe(true);
  });

  it("reduces a long conversation to seed, story, and latest direction", () => {
    const messages = compactStoryMessages([
      { role: "user", content: "A seed" },
      { role: "assistant", content: "The first scene." },
      { role: "user", content: "Add a storm." },
      { role: "assistant", content: "The second scene." },
      { role: "user", content: "Continue underground." },
    ]);

    expect(messages).toEqual([
      { role: "user", content: "A seed" },
      { role: "assistant", content: "The first scene.\n\nThe second scene." },
      { role: "user", content: "Continue underground." },
    ]);
  });
});
