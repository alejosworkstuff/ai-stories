import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ResponseSink } from "../lib/ai/agent";

const { streamText, stepCountIs, tool, logGeneration } = vi.hoisted(() => ({
  streamText: vi.fn(),
  stepCountIs: vi.fn(() => () => false),
  tool: vi.fn((def: unknown) => def),
  logGeneration: vi.fn(),
}));

vi.mock("ai", () => ({
  streamText,
  stepCountIs,
  tool,
}));

vi.mock("../lib/ai/observability", () => ({
  logGeneration,
}));

vi.mock("../lib/ai/provider", () => ({
  languageModel: vi.fn(() => "mock-model"),
  CHAT_MODEL_ID: "test-model",
}));

import { createStoryStreamer } from "../lib/ai/agent";

function createMockRes(): ResponseSink & { chunks: string[]; ended: boolean } {
  return {
    statusCode: 0,
    chunks: [],
    ended: false,
    setHeader() {
      return this;
    },
    write(chunk: string) {
      this.chunks.push(chunk);
      return true;
    },
    end() {
      this.ended = true;
      return this;
    },
  };
}

describe("createStoryStreamer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("streams tokens from streamText to the response sink", async () => {
    streamText.mockReturnValue({
      textStream: (async function* () {
        yield "Once ";
        yield "upon a time.";
      })(),
    });

    const stream = createStoryStreamer({ model: "mock-model" as never });
    const res = createMockRes();

    const result = await stream(
      { messages: [{ role: "user", content: "A robot learns to paint." }] },
      res
    );

    expect(result).toEqual({ streamed: true });
    expect(res.statusCode).toBe(200);
    expect(res.chunks.join("")).toBe("Once upon a time.");
    expect(res.ended).toBe(true);
    expect(streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "mock-model",
        messages: [{ role: "user", content: "A robot learns to paint." }],
        tools: expect.objectContaining({ searchCorpus: expect.any(Object) }),
      })
    );
  });

  it("returns 402 when the provider reports insufficient credits before streaming", async () => {
    streamText.mockImplementation(({ onError }) => {
      onError?.({ error: new Error("insufficient credits") });
      return { textStream: (async function* () {})() };
    });

    const stream = createStoryStreamer({ model: "mock-model" as never });
    const res = createMockRes();

    const result = await stream(
      { messages: [{ role: "user", content: "seed" }] },
      res
    );

    expect(result).toEqual({
      streamed: false,
      status: 402,
      errorCode: "provider_no_credits",
    });
    expect(res.chunks).toHaveLength(0);
    expect(res.ended).toBe(false);
  });

  it("returns 500 for other provider failures before the first token", async () => {
    streamText.mockImplementation(({ onError }) => {
      onError?.({ error: new Error("gateway timeout") });
      return { textStream: (async function* () {})() };
    });

    const stream = createStoryStreamer({ model: "mock-model" as never });
    const res = createMockRes();

    const result = await stream(
      { messages: [{ role: "user", content: "seed" }] },
      res
    );

    expect(result).toEqual({
      streamed: false,
      status: 500,
      errorCode: "generation_failed",
    });
  });

  it("passes retrieved passages through the searchCorpus tool", async () => {
    const retrieve = vi.fn(async () => [
      { source: "narrative-structure.md", content: "Three-act structure", score: 0.9 },
    ]);

    let capturedExecute: ((input: { query: string }) => Promise<unknown>) | undefined;
    tool.mockImplementation((def: unknown) => {
      capturedExecute = (def as { execute?: typeof capturedExecute }).execute;
      return def;
    });

    streamText.mockReturnValue({
      textStream: (async function* () {
        yield "Story.";
      })(),
    });

    const stream = createStoryStreamer({
      retrieve,
      model: "mock-model" as never,
    });
    await stream({ messages: [{ role: "user", content: "seed" }] }, createMockRes());

    expect(capturedExecute).toBeDefined();
    const toolResult = await capturedExecute!({ query: "pacing" });
    expect(retrieve).toHaveBeenCalledWith("pacing", 4);
    expect(toolResult).toEqual({
      passages: [
        {
          source: "narrative-structure.md",
          content: expect.stringContaining("Three-act structure"),
        },
      ],
    });
    expect((toolResult as { passages: Array<{ content: string }> }).passages[0]!.content).toContain(
      "BEGIN UNTRUSTED CONTEXT"
    );
  });
});
