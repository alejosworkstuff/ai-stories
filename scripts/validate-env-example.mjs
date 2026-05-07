import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env.example");
const requiredKeys = ["REPLICATE_API_TOKEN"];

function fail(message) {
  console.error(`Env example validation failed: ${message}`);
  process.exit(1);
}

async function main() {
  const source = await readFile(envPath, "utf8");
  const lines = source.split(/\r?\n/).map((line) => line.trim());

  const keys = lines
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => line.split("=")[0].trim());

  for (const key of requiredKeys) {
    if (!keys.includes(key)) {
      fail(`Missing required key "${key}" in .env.example`);
    }
  }

  console.log("Env example validation passed.");
}

main().catch((error) => fail(error.message));
