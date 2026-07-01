import { generateStoryObject } from "../lib/ai/story";
import { EVAL_CASES } from "./dataset";
import { gradeSchemaValid, gradeStory, score, type GraderResult } from "./graders";

const THRESHOLD = Number.parseFloat(process.env.EVAL_THRESHOLD ?? "0.8");

async function main() {
  let totalScore = 0;

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
  if (overall < THRESHOLD) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
