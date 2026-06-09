import type { Settings, SiteCategory } from "./types";

/** Returns YYYY-MM-DD for a given Date (or today). */
export function toDateString(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/** Extracts the root domain from a URL or hostname string. */
export function extractDomain(input: string): string {
  try {
    const url = input.startsWith("http") ? new URL(input) : new URL("https://" + input);
    // Strip www. prefix
    return url.hostname.replace(/^www\./, "");
  } catch {
    return input.replace(/^www\./, "").split("/")[0] ?? input;
  }
}

/** Checks if a given domain matches any entry in a list (handles subdomains). */
export function domainMatchesList(domain: string, list: string[]): boolean {
  const clean = domain.replace(/^www\./, "");
  return list.some((entry) => {
    const cleanEntry = entry.replace(/^www\./, "");
    return clean === cleanEntry || clean.endsWith("." + cleanEntry);
  });
}

/** Categorizes a domain based on settings. */
export function categorizeDomain(domain: string, settings: Settings): SiteCategory {
  if (domainMatchesList(domain, settings.productiveSites)) return "productive";
  if (domainMatchesList(domain, settings.unproductiveSites)) return "unproductive";
  return "neutral";
}

/** Formats seconds as h:mm or m:ss depending on magnitude. */
export function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 0) totalSeconds = 0;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

/** Formats a countdown in MM:SS. */
export function formatCountdown(totalSeconds: number): string {
  if (totalSeconds < 0) totalSeconds = 0;
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Computes a productivity score 0–100.
 * 70% weight on productive time vs goal, 30% on unproductive time vs cap.
 */
export function computeScore(
  productiveSeconds: number,
  unproductiveSeconds: number,
  goalMinutes: number,
  capMinutes: number
): number {
  const goalSeconds = goalMinutes * 60;
  const capSeconds = capMinutes * 60;

  const productiveRatio = goalSeconds > 0 ? Math.min(productiveSeconds / goalSeconds, 1) : 1;
  const unproductiveRatio = capSeconds > 0 ? Math.min(unproductiveSeconds / capSeconds, 1) : 0;

  const score = productiveRatio * 70 + (1 - unproductiveRatio) * 30;
  return Math.round(Math.max(0, Math.min(100, score)));
}

/** Returns the hex color for a score (0–100). */
export function scoreColor(score: number): string {
  if (score >= 70) return "#4ade80"; // green
  if (score >= 40) return "#fb923c"; // orange
  return "#f87171"; // red
}

/** Checks whether two YYYY-MM-DD date strings are consecutive calendar days. */
export function areConsecutiveDays(earlier: string, later: string): boolean {
  if (!earlier || !later) return false;
  const a = new Date(earlier);
  const b = new Date(later);
  const diff = b.getTime() - a.getTime();
  return diff === 86_400_000; // exactly one day in ms
}
