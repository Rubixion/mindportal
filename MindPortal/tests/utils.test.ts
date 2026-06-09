import { describe, it, expect } from "vitest";
import {
  extractDomain,
  domainMatchesList,
  formatDuration,
  formatCountdown,
  computeScore,
  scoreColor,
  areConsecutiveDays,
  toDateString,
} from "../src/shared/utils";

describe("extractDomain", () => {
  it("extracts domain from full URL", () => {
    expect(extractDomain("https://www.youtube.com/watch?v=abc")).toBe("youtube.com");
  });

  it("strips www prefix", () => {
    expect(extractDomain("https://www.github.com")).toBe("github.com");
  });

  it("handles bare domain string", () => {
    expect(extractDomain("reddit.com")).toBe("reddit.com");
  });

  it("handles subdomain preservation", () => {
    expect(extractDomain("https://docs.google.com/document")).toBe("docs.google.com");
  });
});

describe("domainMatchesList", () => {
  const list = ["youtube.com", "reddit.com", "github.com"];

  it("matches exact domain", () => {
    expect(domainMatchesList("youtube.com", list)).toBe(true);
  });

  it("matches subdomain", () => {
    expect(domainMatchesList("m.reddit.com", list)).toBe(true);
  });

  it("does not match unrelated domain", () => {
    expect(domainMatchesList("google.com", list)).toBe(false);
  });

  it("strips www before matching", () => {
    expect(domainMatchesList("www.youtube.com", list)).toBe(true);
  });
});

describe("formatDuration", () => {
  it("formats seconds only", () => {
    expect(formatDuration(45)).toBe("45s");
  });

  it("formats minutes", () => {
    expect(formatDuration(90)).toBe("1m");
  });

  it("formats hours and minutes", () => {
    expect(formatDuration(3661)).toBe("1h 1m");
  });

  it("handles zero", () => {
    expect(formatDuration(0)).toBe("0s");
  });

  it("clamps negative to zero", () => {
    expect(formatDuration(-10)).toBe("0s");
  });
});

describe("formatCountdown", () => {
  it("formats MM:SS", () => {
    expect(formatCountdown(90)).toBe("01:30");
    expect(formatCountdown(61)).toBe("01:01");
    expect(formatCountdown(0)).toBe("00:00");
    expect(formatCountdown(1500)).toBe("25:00");
  });
});

describe("computeScore", () => {
  it("returns 100 when goal met and no unproductive time", () => {
    expect(computeScore(7200, 0, 120, 30)).toBe(100);
  });

  it("returns 70 when only productive goal is met, full unproductive cap used", () => {
    expect(computeScore(7200, 1800, 120, 30)).toBe(70);
  });

  it("returns 30 when no productive time and no unproductive time", () => {
    expect(computeScore(0, 0, 120, 30)).toBe(30);
  });

  it("clamps to 0 for very bad performance", () => {
    expect(computeScore(0, 99999, 120, 30)).toBe(0);
  });

  it("clamps to 100 for over-performing", () => {
    expect(computeScore(99999, 0, 120, 30)).toBe(100);
  });
});

describe("scoreColor", () => {
  it("returns green for high scores", () => {
    expect(scoreColor(80)).toBe("#4ade80");
    expect(scoreColor(70)).toBe("#4ade80");
  });

  it("returns orange for mid scores", () => {
    expect(scoreColor(55)).toBe("#fb923c");
    expect(scoreColor(40)).toBe("#fb923c");
  });

  it("returns red for low scores", () => {
    expect(scoreColor(39)).toBe("#f87171");
    expect(scoreColor(0)).toBe("#f87171");
  });
});

describe("areConsecutiveDays", () => {
  it("identifies consecutive days", () => {
    expect(areConsecutiveDays("2024-01-01", "2024-01-02")).toBe(true);
  });

  it("rejects same day", () => {
    expect(areConsecutiveDays("2024-01-01", "2024-01-01")).toBe(false);
  });

  it("rejects non-consecutive days", () => {
    expect(areConsecutiveDays("2024-01-01", "2024-01-03")).toBe(false);
  });

  it("handles empty strings", () => {
    expect(areConsecutiveDays("", "2024-01-01")).toBe(false);
  });
});

describe("toDateString", () => {
  it("returns YYYY-MM-DD format", () => {
    const result = toDateString(new Date("2024-06-15T12:00:00Z"));
    expect(result).toBe("2024-06-15");
  });
});
