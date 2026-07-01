import { describe, it, expect } from "vitest";
import { buildSystemPrompt, lengthDirective } from "../lib/ai/prompt";

describe("buildSystemPrompt", () => {
  it("includes the tone when provided", () => {
    expect(buildSystemPrompt("epic", "short")).toContain("Tone: epic.");
  });

  it("omits tone when not provided", () => {
    expect(buildSystemPrompt(undefined, "short")).not.toContain("Tone:");
  });

  it("includes citation and prompt-injection guidance", () => {
    const prompt = buildSystemPrompt("noir", "long");
    expect(prompt).toContain("untrusted");
    expect(prompt).toContain("searchCorpus");
    expect(prompt).toContain("[narrative-structure.md]");
  });
});

describe("lengthDirective", () => {
  it("defaults unknown lengths to short", () => {
    expect(lengthDirective("xl")).toBe(lengthDirective("short"));
  });

  it("distinguishes long from short", () => {
    expect(lengthDirective("long")).not.toBe(lengthDirective("short"));
  });
});
