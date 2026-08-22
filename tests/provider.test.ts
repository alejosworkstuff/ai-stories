import { describe, it, expect, afterEach, vi } from "vitest";

describe("provider", () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
    vi.resetModules();
  });

  it("throws when AI_BASE_URL is not configured", async () => {
    delete process.env.AI_BASE_URL;
    const { languageModel } = await import("../lib/ai/provider");
    expect(() => languageModel()).toThrow(/AI_BASE_URL/);
  });

  it("returns a chat model when AI_BASE_URL is set", async () => {
    process.env.AI_BASE_URL = "https://example.com/v1";
    process.env.AI_API_KEY = "test-key";
    const { languageModel } = await import("../lib/ai/provider");
    const model = languageModel("openai/gpt-oss-120b");
    expect(model).toBeDefined();
    expect(model).toHaveProperty("modelId", "openai/gpt-oss-120b");
  });
});
