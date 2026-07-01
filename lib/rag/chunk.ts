export interface Chunk {
  content: string;
  index: number;
}

export interface ChunkOptions {
  /** Soft max characters per chunk. */
  size?: number;
  /** Characters of trailing overlap carried into the next chunk. */
  overlap?: number;
}

/**
 * Paragraph-aware chunking: packs paragraphs up to `size`, carrying `overlap`
 * characters of context across boundaries so retrieval keeps continuity.
 */
export function chunkText(text: string, options: ChunkOptions = {}): Chunk[] {
  const size = options.size ?? 800;
  const overlap = options.overlap ?? 120;

  const clean = text.replace(/\r\n/g, "\n").trim();
  if (!clean) return [];

  const paragraphs = clean.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks: Chunk[] = [];
  let buffer = "";
  let index = 0;

  for (const paragraph of paragraphs) {
    const candidateLength = buffer ? buffer.length + paragraph.length + 2 : paragraph.length;
    if (buffer && candidateLength > size) {
      chunks.push({ content: buffer.trim(), index: index++ });
      const tail = overlap > 0 ? buffer.slice(-overlap) : "";
      buffer = tail ? `${tail}\n\n${paragraph}` : paragraph;
    } else {
      buffer = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
    }
  }

  if (buffer.trim()) {
    chunks.push({ content: buffer.trim(), index: index++ });
  }

  return chunks;
}
