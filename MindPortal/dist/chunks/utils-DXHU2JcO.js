function toDateString(date = /* @__PURE__ */ new Date()) {
  return date.toISOString().slice(0, 10);
}
function extractDomain(input) {
  try {
    const url = input.startsWith("http") ? new URL(input) : new URL("https://" + input);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return input.replace(/^www\./, "").split("/")[0] ?? input;
  }
}
function domainMatchesList(domain, list) {
  const clean = domain.replace(/^www\./, "");
  return list.some((entry) => {
    const cleanEntry = entry.replace(/^www\./, "");
    return clean === cleanEntry || clean.endsWith("." + cleanEntry);
  });
}
function categorizeDomain(domain, settings) {
  if (domainMatchesList(domain, settings.productiveSites)) return "productive";
  if (domainMatchesList(domain, settings.unproductiveSites)) return "unproductive";
  return "neutral";
}
function formatDuration(totalSeconds) {
  if (totalSeconds < 0) totalSeconds = 0;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor(totalSeconds % 3600 / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}
function formatCountdown(totalSeconds) {
  if (totalSeconds < 0) totalSeconds = 0;
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
function computeScore(productiveSeconds, unproductiveSeconds, goalMinutes, capMinutes) {
  const goalSeconds = goalMinutes * 60;
  const capSeconds = capMinutes * 60;
  const productiveRatio = goalSeconds > 0 ? Math.min(productiveSeconds / goalSeconds, 1) : 1;
  const unproductiveRatio = capSeconds > 0 ? Math.min(unproductiveSeconds / capSeconds, 1) : 0;
  const score = productiveRatio * 70 + (1 - unproductiveRatio) * 30;
  return Math.round(Math.max(0, Math.min(100, score)));
}
function scoreColor(score) {
  if (score >= 70) return "#4ade80";
  if (score >= 40) return "#fb923c";
  return "#f87171";
}
function areConsecutiveDays(earlier, later) {
  if (!earlier || !later) return false;
  const a = new Date(earlier);
  const b = new Date(later);
  const diff = b.getTime() - a.getTime();
  return diff === 864e5;
}
export {
  areConsecutiveDays as a,
  computeScore as b,
  categorizeDomain as c,
  domainMatchesList as d,
  extractDomain as e,
  formatDuration as f,
  formatCountdown as g,
  scoreColor as s,
  toDateString as t
};
