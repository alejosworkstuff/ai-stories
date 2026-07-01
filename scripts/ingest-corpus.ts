import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ingestCorpus } from "../lib/rag/ingest";

async function main() {
  const corpusDir = join(dirname(fileURLToPath(import.meta.url)), "..", "corpus");
  console.log(`Ingesting corpus from ${corpusDir} ...`);
  const result = await ingestCorpus(corpusDir);
  console.log(`Done: embedded + upserted ${result.chunks} chunks from ${result.files} files.`);
}

main().catch((error) => {
  console.error("db:ingest failed:", error);
  process.exit(1);
});
