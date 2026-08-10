import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { chunkText } from "./chunk.js";
import { embedTexts } from "./embeddings.js";
import { ensureSchema, upsertChunks } from "./store.js";

const SUPPORTED_EXTENSIONS = new Set([".md", ".txt"]);

export interface IngestResult {
  files: number;
  chunks: number;
}

export async function ingestCorpus(dir: string): Promise<IngestResult> {
  await ensureSchema();

  const entries = (await readdir(dir)).filter((file) =>
    SUPPORTED_EXTENSIONS.has(extname(file).toLowerCase())
  );

  let totalChunks = 0;
  for (const file of entries) {
    const text = await readFile(join(dir, file), "utf8");
    const chunks = chunkText(text);
    if (chunks.length === 0) continue;

    const embeddings = await embedTexts(chunks.map((c) => c.content));
    await upsertChunks(
      chunks.map((chunk, i) => ({
        source: file,
        chunkIndex: chunk.index,
        content: chunk.content,
        embedding: embeddings[i]!,
      }))
    );
    totalChunks += chunks.length;
  }

  return { files: entries.length, chunks: totalChunks };
}
