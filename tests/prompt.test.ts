import { describe, it, expect } from "vitest";
import { buildSystemPrompt, lengthDirective } from "../lib/ai/prompt";

describe("buildSystemPrompt", () => {
  it("includes the tone when provided", () => {
    expect(buildSystemPrompt("epic", "short")).toContain("Tone: epic.");
  });

  it("omits tone when not provided", () => {
    expect(buildSystemPrompt(undefined, "short")).not.toContain("Tone:");
  });

  it("includes a prompt-injection defense and tool guidance", () => {
    const prompt = buildSystemPrompt("noir", "long");
    expect(prompt).toContain("untrusted");
    expect(prompt).toContain("searchCorpus");
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
