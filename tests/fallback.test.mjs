import { describe, it } from "node:test";
import assert from "node:assert";
import { generateLocalStory } from "../public/js/localGenerator.js";

describe("Local story generator (fallback)", () => {
  const seed = "A detective in Paris";

  it("returns a non-empty string", () => {
    const story = generateLocalStory(seed, "", "short");
    assert.strictEqual(typeof story, "string");
    assert.ok(story.length > 0);
  });

  it("includes the seed in the output", () => {
    const story = generateLocalStory(seed, "", "short");
    assert.ok(
      story.includes(seed),
      `Expected story to include "${seed}" but got: ${story.slice(0, 100)}...`
    );
  });

  it("short length has fewer paragraphs than long", () => {
    const shortStory = generateLocalStory(seed, "", "short");
    const longStory = generateLocalStory(seed, "", "long");

    const shortParagraphs = shortStory.split(/\n\n+/).length;
    const longParagraphs = longStory.split(/\n\n+/).length;

    assert.ok(longParagraphs > shortParagraphs, "Long story should have more paragraphs");
  });

  it("medium length has more paragraphs than short", () => {
    const shortStory = generateLocalStory(seed, "", "short");
    const mediumStory = generateLocalStory(seed, "", "medium");

    const shortParagraphs = shortStory.split(/\n\n+/).length;
    const mediumParagraphs = mediumStory.split(/\n\n+/).length;

    assert.ok(mediumParagraphs >= shortParagraphs, "Medium story should have at least as many paragraphs as short");
  });

  it("dark tone adds extra paragraph", () => {
    const neutralStory = generateLocalStory(seed, "", "short");
    const darkStory = generateLocalStory(seed, "dark", "short");

    assert.ok(
      darkStory.includes("dread"),
      `Expected dark story to include "dread" but got: ${darkStory}`
    );
  });

  it("funny tone adds extra paragraph", () => {
    const funnyStory = generateLocalStory(seed, "funny", "short");

    assert.ok(
      funnyStory.includes("ridiculous"),
      `Expected funny story to include "ridiculous" but got: ${funnyStory}`
    );
  });

  it("epic tone adds extra paragraph", () => {
    const epicStory = generateLocalStory(seed, "epic", "short");

    assert.ok(
      epicStory.includes("Songs"),
      `Expected epic story to include "Songs" but got: ${epicStory}`
    );
  });

  it("starts with one of the intro templates", () => {
    const intros = [
      "It began with",
      "Everything started when",
      "No one expected that",
      "The story truly begins when",
    ];
    const story = generateLocalStory(seed, "", "short");
    const firstLine = story.split("\n\n")[0];

    const hasIntro = intros.some((intro) => firstLine.startsWith(intro));
    assert.ok(hasIntro, `Expected story to start with an intro. First line: ${firstLine}`);
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
    const lastParagraph = paragraphs[paragraphs.length - 1];

    const hasEnding = endings.some((ending) => lastParagraph.includes(ending) || lastParagraph === ending);
    assert.ok(hasEnding, `Expected story to end with a known ending. Last: ${lastParagraph}`);
  });

  it("handles empty tone", () => {
    const story = generateLocalStory(seed, "", "short");
    assert.ok(story.length > 0);
    assert.ok(story.includes(seed));
  });

  it("handles unknown length gracefully (defaults to short-like)", () => {
    const story = generateLocalStory(seed, "", "unknown");
    assert.ok(story.length > 0);
    assert.ok(story.includes(seed));
  });
});
