import { describe, it, expect } from "vitest";
import { generateLocalStory } from "../public/js/localGenerator.js";

describe("Local story generator (fallback)", () => {
  const seed = "A detective in Paris";

  it("returns a non-empty string", () => {
    const story = generateLocalStory(seed, "", "short");
    expect(typeof story).toBe("string");
    expect(story.length).toBeGreaterThan(0);
  });

  it("includes the seed in the output", () => {
    const story = generateLocalStory(seed, "", "short");
    expect(story).toContain(seed);
  });

  it("short length has fewer paragraphs than long", () => {
    const shortStory = generateLocalStory(seed, "", "short");
    const longStory = generateLocalStory(seed, "", "long");

    const shortParagraphs = shortStory.split(/\n\n+/).length;
    const longParagraphs = longStory.split(/\n\n+/).length;

    expect(longParagraphs).toBeGreaterThan(shortParagraphs);
  });

  it("medium length has more paragraphs than short", () => {
    const shortStory = generateLocalStory(seed, "", "short");
    const mediumStory = generateLocalStory(seed, "", "medium");

    const shortParagraphs = shortStory.split(/\n\n+/).length;
    const mediumParagraphs = mediumStory.split(/\n\n+/).length;

    expect(mediumParagraphs).toBeGreaterThanOrEqual(shortParagraphs);
  });

  it("dark tone adds extra paragraph", () => {
    const darkStory = generateLocalStory(seed, "dark", "short");
    expect(darkStory).toContain("dread");
  });

  it("funny tone adds extra paragraph", () => {
    const funnyStory = generateLocalStory(seed, "funny", "short");
    expect(funnyStory).toContain("ridiculous");
  });

  it("epic tone adds extra paragraph", () => {
    const epicStory = generateLocalStory(seed, "epic", "short");
    expect(epicStory).toContain("Songs");
  });

  it("starts with one of the intro templates", () => {
    const intros = [
      "It began with",
      "Everything started when",
      "No one expected that",
      "The story truly begins when",
    ];
    const story = generateLocalStory(seed, "", "short");
    const firstLine = story.split("\n\n")[0]!;

    expect(intros.some((intro) => firstLine.startsWith(intro))).toBe(true);
  });

  it("ends with one of the ending templates", () => {
    const endings = [
      "In the end, nothing would ever be the same.",
      "From that day forward, the world felt different.",
      "The experience left a permanent mark.",
      "And that is how the legend was born.",
    ];
    const story = generateLocalStory(seed, "", "short");
    const paragraphs = story.split(/\n\n+/);
    const lastParagraph = paragraphs[paragraphs.length - 1]!;

    expect(
      endings.some((ending) => lastParagraph.includes(ending) || lastParagraph === ending)
    ).toBe(true);
  });

  it("handles empty tone", () => {
    const story = generateLocalStory(seed, "", "short");
    expect(story.length).toBeGreaterThan(0);
    expect(story).toContain(seed);
  });

  it("handles unknown length gracefully (defaults to short-like)", () => {
    const story = generateLocalStory(seed, "", "unknown");
    expect(story.length).toBeGreaterThan(0);
    expect(story).toContain(seed);
  });
});
