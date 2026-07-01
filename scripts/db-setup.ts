import { ensureSchema } from "../lib/rag/store";

async function main() {
  await ensureSchema();
  console.log("Database ready: 'vector' extension enabled, 'documents' table + HNSW index created.");
}

main().catch((error) => {
  console.error("db:setup failed:", error);
  process.exit(1);
});
