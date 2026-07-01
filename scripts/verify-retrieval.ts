import { retrieve } from "../lib/rag/retrieve";

async function main() {
  const query = process.argv[2] ?? "three act structure and climax";
  const results = await retrieve(query, 3);
  for (const hit of results) {
    console.log(`[${hit.source}] score=${hit.score.toFixed(3)}`);
    console.log(`  ${hit.content.slice(0, 100).replace(/\s+/g, " ")}...`);
  }
  if (results.length === 0) {
    console.log("No results (empty corpus or query).");
  }
}

main().catch((error) => {
  console.error("verify-retrieval failed:", error);
  process.exit(1);
});
