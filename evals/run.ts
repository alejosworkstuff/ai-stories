import { generateStoryObject } from "../lib/ai/story.js";
import { EVAL_CASES } from "./dataset.js";
import { gradeSchemaValid, gradeStory, score, type GraderResult } from "./graders.js";
import { runLlmJudge } from "./judge.js";
import { checkRegression, loadBaseline } from "./regression.js";

const THRESHOLD = Number.parseFloat(process.env.EVAL_THRESHOLD ?? "0.8");
const USE_JUDGE = process.env.EVAL_JUDGE !== "0";
const CHECK_REGRESSION = process.env.EVAL_SKIP_REGRESSION !== "1";

async function main() {
  let totalScore = 0;
  const caseScores: Record<string, number> = {};

  for (const testCase of EVAL_CASES) {
    let results: GraderResult[] = [];
    try {
      const { story } = await generateStoryObject({
        messages: testCase.messages,
        tone: testCase.tone,
        length: testCase.length,
        grounded: testCase.grounded,
      });
      const schema = gradeSchemaValid(story);
      results = schema.passed ? [schema, ...gradeStory(story, testCase)] : [schema];

      if (USE_JUDGE && schema.passed) {
        try {
          results.push(await runLlmJudge(story, testCase));
        } catch (error) {
          results.push({
            name: "llm_judge",
            passed: false,
            detail: String((error as Error)?.message ?? error),
          });
        }
      }
    } catch (error) {
      results = [
        {
          name: "generation",
          passed: false,
          detail: String((error as Error)?.message ?? error),
        },
      ];
    }

    const caseScore = score(results);
    caseScores[testCase.id] = caseScore;
    totalScore += caseScore;
    const failed = results.filter((r) => !r.passed).map((r) => r.name);
    const verdict = caseScore >= THRESHOLD ? "PASS" : "FAIL";
    console.log(
      `${verdict}  ${testCase.id.padEnd(24)} ${(caseScore * 100).toFixed(0).padStart(3)}%  ${failed.join(", ")}`
    );
  }

  const overall = totalScore / (EVAL_CASES.length || 1);
  console.log(
    `\nOverall: ${(overall * 100).toFixed(1)}%  (threshold ${(THRESHOLD * 100).toFixed(0)}%)`
  );

  let failed = false;
  if (overall < THRESHOLD) {
    console.error(`FAIL: overall below threshold ${(THRESHOLD * 100).toFixed(0)}%`);
    failed = true;
  }

  if (CHECK_REGRESSION) {
    const baseline = loadBaseline();
    const regression = checkRegression(overall, caseScores, baseline, THRESHOLD);
    if (!regression.ok) {
      console.error(`REGRESSION: ${regression.detail}`);
      failed = true;
    } else {
      console.log(
        `Regression check: OK (baseline ${(baseline.overall * 100).toFixed(1)}%)`
      );
    }
  }

  if (failed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
