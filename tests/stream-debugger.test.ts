import { describe, expect, it, vi } from "vitest";
import { SseParser } from "../lib/stream-debugger/parser";
import { streamEventSchema, streamPayloadSchema, validateGeneratedStory } from "../lib/stream-debugger/events";
import { streamStory, validateStreamOutput } from "../public/js/api.js";

describe("SseParser", () => {
  it("parses events split across chunks", () => {
    const parser = new SseParser();

    expect(parser.feed("data: hel")).toEqual([]);
    expect(parser.feed("lo\n\n")).toEqual([{ data: "hello" }]);
  });

  it("joins multiline data and preserves event metadata", () => {
    const parser = new SseParser();

    expect(parser.feed("event: token\nid: 42\ndata: first\ndata: second\n\n")).toEqual([
      { event: "token", id: "42", data: "first\nsecond" },
    ]);
  });

  it("keeps an incomplete event until the next delimiter", () => {
    const parser = new SseParser();

    expect(parser.feed("data: pending\n")).toEqual([]);
    expect(parser.feed("\n")).toEqual([{ data: "pending" }]);
  });

  it("parses retry values and ignores comments", () => {
    const parser = new SseParser();

    expect(parser.feed(": heartbeat\nretry: 1500\n\n")).toEqual([{ retry: 1500 }]);
  });

  it("flushes a final unterminated line", () => {
    const parser = new SseParser();

    parser.feed("data: final");
    expect(parser.flush()).toEqual([{ data: "final" }]);
  });
});

describe("stream event schema", () => {
  it("accepts typed SSE, metadata, and metric events", () => {
    expect(
      streamEventSchema.parse({
        kind: "sse",
        data: "token",
        receivedAt: 100,
        deltaMs: 12,
      })
    ).toMatchObject({ kind: "sse", data: "token" });
    expect(streamEventSchema.parse({ kind: "meta", phase: "open" })).toEqual({ kind: "meta", phase: "open" });
    expect(streamEventSchema.parse({ kind: "metric", name: "ttfb", value: 120 })).toEqual({
      kind: "metric",
      name: "ttfb",
      value: 120,
    });
  });
});

describe("stream output validation", () => {
  it("accepts normal generated text", () => {
    expect(validateStreamOutput("A quiet beginning.\nA clear ending.")).toEqual({
      valid: true,
      reason: null,
    });
  });

  it("rejects empty or corrupted output", () => {
    expect(validateStreamOutput("  \n")).toEqual({ valid: false, reason: "empty" });
    expect(validateStreamOutput("partial\u0000text")).toEqual({
      valid: false,
      reason: "control_chars",
    });
  });

  it("validates structured stream payloads", () => {
    expect(streamPayloadSchema.parse({ type: "token", text: "hello" })).toEqual({
      type: "token",
      text: "hello",
    });
    expect(streamPayloadSchema.safeParse({ type: "token", text: "" }).success).toBe(false);
    expect(validateGeneratedStory("A complete story.").success).toBe(true);
    expect(validateGeneratedStory("\u0000").success).toBe(false);
  });
});

describe("production SSE streaming", () => {
  it("parses events split across chunks and flushes the final event", async () => {
    const chunks = [
      `event: token\r\ndata: {"type":"token","text":"Once "}\r\n\r`,
      `\nevent: token\r\ndata: {"type":"token","text":"upon a time."}`,
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: { get: (name: string) => (name === "content-type" ? "text/event-stream" : "") },
        body: new ReadableStream({
          start(controller) {
            for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
            controller.close();
          },
        }),
      }))
    );

    const onToken = vi.fn();
    const result = await streamStory({ prompt: "story" }, { onToken });

    expect(result.text).toBe("Once upon a time.");
    expect(onToken).toHaveBeenNthCalledWith(1, "Once ");
    expect(onToken).toHaveBeenNthCalledWith(2, "upon a time.");
    expect(result.validation).toEqual({ valid: true, reason: null });
    vi.unstubAllGlobals();
  });
});
