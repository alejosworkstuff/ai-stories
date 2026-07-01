import { describe, it, expect, vi, beforeEach } from "vitest";

const { generateObject } = vi.hoisted(() => ({
  generateObject: vi.fn(),
}));

vi.mock("ai", () => ({
  generateObject,
}));

vi.mock("../lib/ai/provider", () => ({
  languageModel: vi.fn(() => "mock-model"),
}));

import { generateStoryObject } from "../lib/ai/story";
import type { Story } from "../lib/ai/schema";

const sampleStory: Story = {
  title: "The Lighthouse",
  paragraphs: ["Waves crashed.", "A light blinked.", "Someone watched."],
  choices: ["Climb the stairs", "Turn back"],
  groundedOn: [],
};

describe("generateStoryObject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a Zod-validated story from generateObject", async () => {
    generateObject.mockResolvedValue({ object: sampleStory });

    const { story } = await generateStoryObject(
      {
        messages: [{ role: "user", content: "A lighthouse in a storm." }],
        tone: "noir",
        length: "short",
      },
      { model: "mock-model" as never }
    );

    expect(story).toEqual(sampleStory);
    expect(generateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "mock-model",
        schema: expect.any(Object),
        messages: [{ role: "user", content: "A lighthouse in a storm." }],
        system: expect.stringContaining("Tone: noir."),
      })
    );
  });

  it("injects retrieved grounding when grounded is true", async () => {
    generateObject.mockResolvedValue({ object: sampleStory });
    const retrieve = vi.fn(async () => [
      { source: "tone-and-voice.md", content: "Keep sentences short.", score: 0.85 },
    ]);

    const { retrieved } = await generateStoryObject(
      {
        messages: [{ role: "user", content: "A detective in Paris." }],
        grounded: true,
      },
      { retrieve, model: "mock-model" as never }
    );

    expect(retrieve).toHaveBeenCalledWith("A detective in Paris.", 4);
    expect(retrieved).toHaveLength(1);
    expect(generateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringMatching(/\[tone-and-voice\.md\].*BEGIN UNTRUSTED CONTEXT/s),
      })
    );
  });

  it("skips retrieval when grounded is false", async () => {
    generateObject.mockResolvedValue({ object: sampleStory });
    const retrieve = vi.fn();

    await generateStoryObject(
      { messages: [{ role: "user", content: "seed" }], grounded: false },
      { retrieve, model: "mock-model" as never }
    );

    expect(retrieve).not.toHaveBeenCalled();
  });

  it("retries once when the first object fails validation", async () => {
    generateObject
      .mockResolvedValueOnce({
        object: {
          title: "Bad",
          paragraphs: ["As an AI language model I must refuse."],
          choices: ["A", "B"],
          groundedOn: [],
        },
      })
      .mockResolvedValueOnce({ object: sampleStory });

    const { story } = await generateStoryObject(
      { messages: [{ role: "user", content: "A lighthouse in a storm." }] },
      { model: "mock-model" as never }
    );

    expect(story).toEqual(sampleStory);
    expect(generateObject).toHaveBeenCalledTimes(2);
    expect(generateObject.mock.calls[1]![0].system).toContain("Repair:");
  });
});
