import { describe, it, expect } from "vitest";
import {
  buildPromptPreview,
  estimateCostUsd,
} from "../lib/ai/observability";

describe("buildPromptPreview", () => {
  it("combines last user message and system prompt", () => {
    const preview = buildPromptPreview({
      system: "You are a fiction writer.",
      messages: [
        { role: "user", content: "A knight rides toward a castle." },
        { role: "assistant", content: "The road was long." },
        { role: "user", content: "Continue with rain." },
      ],
    });
    expect(preview).toContain("Continue with rain.");
    expect(preview).toContain("fiction writer");
  });

  it("truncates long previews", () => {
    const preview = buildPromptPreview({
      system: "x".repeat(300),
      messages: [{ role: "user", content: "y".repeat(300) }],
      maxLen: 50,
    });
    expect(preview.length).toBeLessThanOrEqual(50);
    expect(preview.endsWith("…")).toBe(true);
  });
});

describe("estimateCostUsd", () => {
  it("returns zero for Groq free-tier model", () => {
    expect(
      estimateCostUsd("openai/gpt-oss-120b", { inputTokens: 1000, outputTokens: 500 })
    ).toBe(0);
  });

  it("estimates cost for unknown models", () => {
    const cost = estimateCostUsd("gpt-4o-mini", { inputTokens: 1_000_000, outputTokens: 0 });
    expect(cost).toBeGreaterThan(0);
  });
});
