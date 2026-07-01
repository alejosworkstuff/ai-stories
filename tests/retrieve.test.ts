import { describe, it, expect, vi, afterEach } from "vitest";
import { retrieve } from "../lib/rag/retrieve";

vi.mock("../lib/rag/embeddings", () => ({
  embedQuery: vi.fn(async () => [0.1, 0.2, 0.3]),
}));

vi.mock("../lib/rag/store", () => ({
  similaritySearch: vi.fn(async () => [
    { source: "narrative-structure.md", content: "Three-act structure", score: 0.91 },
    { source: "tone-and-voice.md", content: "Keep sentences short.", score: 0.82 },
  ]),
}));

describe("retrieve", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns no results for blank queries", async () => {
    expect(await retrieve("   ")).toEqual([]);
  });

  it("embeds the query and returns top-k passages with scores", async () => {
    const { embedQuery } = await import("../lib/rag/embeddings");
    const { similaritySearch } = await import("../lib/rag/store");

    const results = await retrieve("pacing in act two", 2);

    expect(embedQuery).toHaveBeenCalledWith("pacing in act two");
    expect(similaritySearch).toHaveBeenCalledWith([0.1, 0.2, 0.3], 2);
    expect(results).toHaveLength(2);
    expect(results[0]!.source).toBe("narrative-structure.md");
    expect(results[0]!.score).toBeCloseTo(0.91);
  });
});
