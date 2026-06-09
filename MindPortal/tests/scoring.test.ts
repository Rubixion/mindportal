import { describe, it, expect } from "vitest";
import { computeScore } from "../src/shared/utils";

describe("computeScore edge cases", () => {
  it("handles zero goals gracefully (no division by zero panic)", () => {
    // goalMinutes = 0 would cause NaN without clamping — the formula uses Math.min(..., 1)
    // In practice the UI enforces min=10, but defensive test
    const result = computeScore(0, 0, 0, 0);
    expect(typeof result).toBe("number");
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(100);
  });

  it("partial productive progress gives partial score", () => {
    // 60 min productive of 120 goal = 50% productive, 0 unproductive
    const score = computeScore(3600, 0, 120, 30);
    // productive contribution = 0.5 * 70 = 35
    // unproductive contribution = 1 * 30 = 30
    // total = 65
    expect(score).toBe(65);
  });

  it("equal productive and unproductive gives low score", () => {
    // 1h productive / 2h goal = 0.5, 1h unproductive / 0.5h cap = clamped to 1
    const score = computeScore(3600, 3600, 120, 30);
    // 0.5 * 70 + (1-1) * 30 = 35
    expect(score).toBe(35);
  });
});
