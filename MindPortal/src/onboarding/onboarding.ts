import { DEFAULT_SETTINGS, DEFAULT_STREAK, DEFAULT_SESSION } from "../shared/defaults";
import { extractDomain } from "../shared/utils";

let currentStep = 0;
let selectedMode: "warn" | "countdown" | "block" = "countdown";

const productiveSites = [...DEFAULT_SETTINGS.productiveSites];
const unproductiveSites = [...DEFAULT_SETTINGS.unproductiveSites];

function goStep(step: number) {
  const current = document.getElementById(`step-${currentStep}`);
  const next = document.getElementById(`step-${step}`);
  if (current) current.classList.remove("active");
  if (next) next.classList.add("active");

  // Update progress dots
  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById(`dot-${i}`);
    if (!dot) continue;
    dot.classList.remove("active", "done");
    if (i < step) dot.classList.add("done");
    else if (i === step) dot.classList.add("active");
  }

  currentStep = step;

  if (step === 3) renderSiteTags();
}

function selectMode(mode: "warn" | "countdown" | "block") {
  selectedMode = mode;
  document.querySelectorAll(".mode-card").forEach((el) => el.classList.remove("selected"));
  document.getElementById(`mode-${mode}`)?.classList.add("selected");
}

function renderSiteTags() {
  renderTagList("productive-tags", productiveSites, "productive");
  renderTagList("unproductive-tags", unproductiveSites, "unproductive");
}

function renderTagList(containerId: string, sites: string[], type: "productive" | "unproductive") {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";
  sites.forEach((site, idx) => {
    const tag = document.createElement("div");
    tag.className = "tag";
    tag.innerHTML = `${site}<span class="remove" data-idx="${idx}" data-type="${type}">×</span>`;
    tag.querySelector(".remove")?.addEventListener("click", () => {
      if (type === "productive") productiveSites.splice(idx, 1);
      else unproductiveSites.splice(idx, 1);
      renderSiteTags();
    });
    container.appendChild(tag);
  });
}

function addSite(type: "productive" | "unproductive") {
  const inputId = type === "productive" ? "productive-input" : "unproductive-input";
  const input = document.getElementById(inputId) as HTMLInputElement | null;
  if (!input) return;
  const raw = input.value.trim();
  if (!raw) return;
  const domain = extractDomain(raw);
  if (!domain) return;

  const list = type === "productive" ? productiveSites : unproductiveSites;
  if (!list.includes(domain)) {
    list.push(domain);
    renderSiteTags();
  }
  input.value = "";
}

async function finish() {
  const nameInput = document.getElementById("input-name") as HTMLInputElement | null;
  const goalInput = document.getElementById("input-goal") as HTMLInputElement | null;
  const capInput = document.getElementById("input-cap") as HTMLInputElement | null;

  const userName = nameInput?.value.trim() ?? "";
  const dailyGoalMinutes = parseInt(goalInput?.value ?? "120", 10) || 120;
  const unproductiveCapMinutes = parseInt(capInput?.value ?? "30", 10) || 30;

  const settings = {
    ...DEFAULT_SETTINGS,
    userName,
    dailyGoalMinutes,
    unproductiveCapMinutes,
    warningMode: selectedMode,
    productiveSites: [...productiveSites],
    unproductiveSites: [...unproductiveSites],
    onboardingComplete: true,
  };

  await chrome.storage.local.set({
    settings,
    streak: DEFAULT_STREAK,
    session: { ...DEFAULT_SESSION, lastBreakTime: Date.now() },
    dailyData: {},
    dismissedToday: [],
    lastDismissedDate: "",
  });

  // Close onboarding tab
  window.close();
}

// Expose to window for inline onclick handlers
Object.assign(window, { goStep, selectMode, addSite, finish });

// Add enter key support on site inputs
document.getElementById("productive-input")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addSite("productive");
});
document.getElementById("unproductive-input")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addSite("unproductive");
});
