#!/usr/bin/env node
/**
 * Push required production env vars from .env to the linked Vercel project.
 * Usage: node scripts/sync-vercel-env.mjs
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env");

const DEFAULT_BASE_URL = "https://api.groq.com/openai/v1";
const DEFAULT_MODEL = "openai/gpt-oss-120b";

function parseEnvFile(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    out[line.slice(0, i)] = line.slice(i + 1);
  }
  return out;
}

function addEnv(name, value, { force = false } = {}) {
  if (!value?.trim()) {
    console.log(`skip ${name} (empty)`);
    return;
  }
  const args = [
    "vercel",
    "env",
    "add",
    name,
    "production",
    "--value",
    value,
    "--yes",
    "--sensitive",
  ];
  if (force) args.push("--force");
  console.log(`set ${name} (production)`);
  execFileSync("npx", args, { cwd: root, stdio: "inherit", shell: true });
}

const local = parseEnvFile(envPath);
const aiApiKey = (local.AI_API_KEY ?? local.GROQ_API_KEY)?.trim();
const aiBaseUrl = (local.AI_BASE_URL?.trim() || DEFAULT_BASE_URL);
const aiModel = (local.AI_MODEL?.trim() || DEFAULT_MODEL);

addEnv("DATABASE_URL", local.DATABASE_URL, { force: true });
addEnv("AI_BASE_URL", aiBaseUrl, { force: true });
addEnv("AI_API_KEY", aiApiKey, { force: true });
addEnv("AI_MODEL", aiModel, { force: true });
addEnv("FORCE_LOCAL_EMBEDDINGS", local.FORCE_LOCAL_EMBEDDINGS?.trim() || "1", {
  force: true,
});

console.log("done — redeploy production to pick up new vars");
