import { describe, it, expect, afterEach } from "vitest";
import {
  LOCAL_EMBEDDING_DIM,
  localBagEmbed,
  localBagEmbedMany,
} from "../lib/rag/embeddings-local";
import { activeEmbeddingDim, embedQuery, embedTexts } from "../lib/rag/embeddings";

describe("localBagEmbed", () => {
  it("returns a normalized vector of the expected dimension", () => {
    const vec = localBagEmbed("pacing and conflict in act two");
    expect(vec).toHaveLength(LOCAL_EMBEDDING_DIM);
    const norm = Math.sqrt(vec.reduce((sum, value) => sum + value * value, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  it("scores related craft text higher than unrelated text", () => {
    const query = localBagEmbed("three act structure and climax");
    const related = localBagEmbed("third act delivers the climax and resolution");
    const unrelated = localBagEmbed("database connection pooling on neon");
    const dot = (a: number[], b: number[]) => a.reduce((sum, value, i) => sum + value * b[i]!, 0);
    expect(dot(query, related)).toBeGreaterThan(dot(query, unrelated));
  });
});

describe("embeddings routing", () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
  });

  it("uses local embeddings when AI_BASE_URL is unset", async () => {
    delete process.env.AI_BASE_URL;
    delete process.env.FORCE_LOCAL_EMBEDDINGS;
    expect(activeEmbeddingDim()).toBe(LOCAL_EMBEDDING_DIM);
    const vectors = await embedTexts(["scene and sequel pacing"]);
    expect(vectors[0]).toHaveLength(LOCAL_EMBEDDING_DIM);
    const query = await embedQuery("archetypes");
    expect(query).toHaveLength(LOCAL_EMBEDDING_DIM);
  });

  it("keeps local embeddings when FORCE_LOCAL_EMBEDDINGS is set", async () => {
    process.env.AI_BASE_URL = "https://example.com/v1";
    process.env.FORCE_LOCAL_EMBEDDINGS = "1";
    expect(activeEmbeddingDim()).toBe(LOCAL_EMBEDDING_DIM);
    const query = await embedQuery("archetypes");
    expect(query).toHaveLength(LOCAL_EMBEDDING_DIM);
  });

  it("embedMany returns one vector per input", async () => {
    delete process.env.AI_BASE_URL;
    const vectors = localBagEmbedMany(["one", "two"]);
    expect(vectors).toHaveLength(2);
  });
});
