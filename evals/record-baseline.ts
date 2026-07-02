import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { EVAL_CASES } from "./dataset.js";
import { generateStoryObject } from "../lib/ai/story.js";
import { gradeSchemaValid, gradeStory, score } from "./graders.js";
import { runLlmJudge } from "./judge.js";

const useJudge = process.env.EVAL_JUDGE !== "0";

async function main() {
  const caseScores: Record<string, number> = {};
  let totalScore = 0;

  for (const testCase of EVAL_CASES) {
    const { story } = await generateStoryObject({
      messages: testCase.messages,
      tone: testCase.tone,
      length: testCase.length,
      grounded: testCase.grounded,
    });

    const schema = gradeSchemaValid(story);
    let results = schema.passed ? [schema, ...gradeStory(story, testCase)] : [schema];

    if (useJudge && schema.passed) {
      results.push(await runLlmJudge(story, testCase));
    }

    const caseScore = score(results);
    caseScores[testCase.id] = caseScore;
    totalScore += caseScore;
    console.log(`${testCase.id}: ${(caseScore * 100).toFixed(0)}%`);
  }

  const overall = totalScore / (EVAL_CASES.length || 1);
  const baseline = { overall, cases: caseScores };
  const path = resolve(process.cwd(), "evals/baseline.json");
  writeFileSync(path, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");
  console.log(`\nWrote baseline overall ${(overall * 100).toFixed(1)}% → ${path}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
