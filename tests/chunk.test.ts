import { describe, it, expect } from "vitest";
import { chunkText } from "../lib/rag/chunk";

describe("chunkText", () => {
  it("returns no chunks for empty input", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   \n\n  ")).toEqual([]);
  });

  it("keeps a small document as a single chunk", () => {
    const chunks = chunkText("One paragraph.\n\nTwo paragraph.", { size: 800 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.index).toBe(0);
    expect(chunks[0]!.content).toContain("One paragraph.");
    expect(chunks[0]!.content).toContain("Two paragraph.");
  });

  it("splits long documents into multiple ordered chunks", () => {
    const paragraph = "word ".repeat(60).trim();
    const doc = Array.from({ length: 6 }, () => paragraph).join("\n\n");
    const chunks = chunkText(doc, { size: 400, overlap: 40 });
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk, i) => expect(chunk.index).toBe(i));
  });
});
