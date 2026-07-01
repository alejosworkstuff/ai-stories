import { neon } from "@neondatabase/serverless";
import { activeEmbeddingDim } from "./embeddings";

export interface StoredChunk {
  source: string;
  chunkIndex: number;
  content: string;
  embedding: number[];
}

export interface RetrievedChunk {
  source: string;
  content: string;
  score: number;
}

function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not configured (see .env.example)");
  }
  return neon(url);
}

/** pgvector wants a literal like '[0.1,0.2,...]'. */
function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

function rowsOf(result: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(result)) return result as Array<Record<string, unknown>>;
  const rows = (result as { rows?: unknown }).rows;
  return Array.isArray(rows) ? (rows as Array<Record<string, unknown>>) : [];
}

async function documentsEmbeddingDim(sql: ReturnType<typeof neon>): Promise<number | null> {
  const result = await sql(`
    SELECT format_type(a.atttypid, a.atttypmod) AS coltype
    FROM pg_attribute a
    JOIN pg_class c ON a.attrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE c.relname = 'documents' AND a.attname = 'embedding' AND n.nspname = 'public'
  `);
  const coltype = String(rowsOf(result)[0]?.coltype ?? "");
  const match = coltype.match(/vector\((\d+)\)/);
  return match ? Number.parseInt(match[1]!, 10) : null;
}

export async function ensureSchema(dim: number = activeEmbeddingDim()): Promise<void> {
  const sql = getSql();
  await sql("CREATE EXTENSION IF NOT EXISTS vector");

  const existingDim = await documentsEmbeddingDim(sql);
  if (existingDim !== null && existingDim !== dim) {
    await sql("DROP TABLE documents");
  }

  await sql(
    `CREATE TABLE IF NOT EXISTS documents (
      id BIGSERIAL PRIMARY KEY,
      source TEXT NOT NULL,
      chunk_index INT NOT NULL,
      content TEXT NOT NULL,
      embedding vector(${dim}) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (source, chunk_index)
    )`
  );
  await sql(
    "CREATE INDEX IF NOT EXISTS documents_embedding_idx ON documents USING hnsw (embedding vector_cosine_ops)"
  );
}

export async function upsertChunks(chunks: StoredChunk[]): Promise<number> {
  if (chunks.length === 0) return 0;
  const sql = getSql();
  for (const chunk of chunks) {
    await sql(
      `INSERT INTO documents (source, chunk_index, content, embedding)
       VALUES ($1, $2, $3, $4::vector)
       ON CONFLICT (source, chunk_index)
       DO UPDATE SET content = EXCLUDED.content, embedding = EXCLUDED.embedding`,
      [chunk.source, chunk.chunkIndex, chunk.content, toVectorLiteral(chunk.embedding)]
    );
  }
  return chunks.length;
}

export async function similaritySearch(
  embedding: number[],
  k = 4
): Promise<RetrievedChunk[]> {
  const sql = getSql();
  const literal = toVectorLiteral(embedding);
  const result = await sql(
    `SELECT source, content, 1 - (embedding <=> $1::vector) AS score
     FROM documents
     ORDER BY embedding <=> $1::vector
     LIMIT $2`,
    [literal, k]
  );
  return rowsOf(result).map((row) => ({
    source: String(row.source),
    content: String(row.content),
    score: Number(row.score),
  }));
}
