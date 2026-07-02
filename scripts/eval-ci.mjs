import { spawnSync } from "node:child_process";

const required = ["AI_API_KEY", "AI_BASE_URL", "DATABASE_URL"];
const missing = required.filter((key) => !process.env[key]?.trim());

if (missing.length > 0) {
  console.log(
    `::warning::Eval regression gate skipped — missing secrets: ${missing.join(", ")}`
  );
  process.exit(0);
}

const result = spawnSync(
  "node",
  ["./node_modules/tsx/dist/cli.mjs", "evals/run.ts"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      EVAL_JUDGE: process.env.EVAL_JUDGE ?? "1",
      FORCE_LOCAL_EMBEDDINGS: process.env.FORCE_LOCAL_EMBEDDINGS ?? "1",
    },
  }
);

process.exit(result.status ?? 1);
