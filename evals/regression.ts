import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface EvalBaseline {
  overall: number;
  cases?: Record<string, number>;
}

export function loadBaseline(path = resolve(process.cwd(), "evals/baseline.json")): EvalBaseline {
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw) as EvalBaseline;
}

export function checkRegression(
  overall: number,
  caseScores: Record<string, number>,
  baseline: EvalBaseline
): { ok: boolean; detail?: string } {
  if (overall < baseline.overall) {
    return {
      ok: false,
      detail: `overall ${(overall * 100).toFixed(1)}% < baseline ${(baseline.overall * 100).toFixed(1)}%`,
    };
  }

  if (baseline.cases) {
    for (const [caseId, minScore] of Object.entries(baseline.cases)) {
      const current = caseScores[caseId];
      if (current === undefined) continue;
      if (current < minScore) {
        return {
          ok: false,
          detail: `case "${caseId}" ${(current * 100).toFixed(0)}% < baseline ${(minScore * 100).toFixed(0)}%`,
        };
      }
    }
  }

  return { ok: true };
}
