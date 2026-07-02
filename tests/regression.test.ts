import { describe, it, expect } from "vitest";
import { checkRegression } from "../evals/regression";

describe("checkRegression", () => {
  const baseline = { overall: 0.8, cases: { "basic-short": 1.0, "grounded-tone": 0.75 } };

  it("passes when scores meet or exceed baseline", () => {
    expect(
      checkRegression(0.85, { "basic-short": 1.0, "grounded-tone": 0.8 }, baseline).ok
    ).toBe(true);
  });

  it("fails on overall regression", () => {
    const result = checkRegression(0.7, { "basic-short": 1.0 }, baseline);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain("overall");
  });

  it("fails on per-case regression", () => {
    const result = checkRegression(
      0.85,
      { "basic-short": 1.0, "grounded-tone": 0.5 },
      baseline
    );
    expect(result.ok).toBe(false);
    expect(result.detail).toContain("grounded-tone");
  });
});
