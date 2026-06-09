import "../chunks/modulepreload-polyfill-DaKOjhqt.js";
import { t as toDateString, b as computeScore, f as formatDuration, e as extractDomain } from "../chunks/utils-DXHU2JcO.js";
import { b as DEFAULT_SETTINGS } from "../chunks/defaults-CCjS-AZq.js";
let storage = null;
let editableProductiveSites = [];
let editableUnproductiveSites = [];
async function init() {
  storage = await chrome.runtime.sendMessage({ type: "GET_STORAGE" });
  editableProductiveSites = [...storage.settings.productiveSites ?? DEFAULT_SETTINGS.productiveSites];
  editableUnproductiveSites = [...storage.settings.unproductiveSites ?? DEFAULT_SETTINGS.unproductiveSites];
  renderAnalytics();
  renderSites();
  renderGoals();
  renderProfile();
  setupNav();
  setupActions();
  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab") ?? "analytics";
  switchTab(tab);
}
function setupNav() {
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset["tab"];
      if (tab) switchTab(tab);
    });
  });
}
function switchTab(tab) {
  document.querySelectorAll(".nav-item").forEach((b) => b.classList.remove("active"));
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
  document.querySelector(`[data-tab="${tab}"]`)?.classList.add("active");
  document.getElementById(`panel-${tab}`)?.classList.add("active");
}
function renderAnalytics() {
  if (!storage) return;
  const { streak, dailyData, settings } = storage;
  const today = toDateString();
  const todayRecord = dailyData[today];
  setText("stat-streak", String(streak.current));
  setText("stat-longest", String(streak.longest));
  setText("stat-sessions", String(todayRecord?.pomodoroSessionsCompleted ?? 0));
  const score = todayRecord ? computeScore(todayRecord.productiveSeconds, todayRecord.unproductiveSeconds, settings.dailyGoalMinutes, settings.unproductiveCapMinutes) : 0;
  setText("stat-score", todayRecord ? String(score) : "—");
  const days = getLast(7);
  const prodData = days.map((d) => Math.round((dailyData[d]?.productiveSeconds ?? 0) / 60));
  const unprodData = days.map((d) => Math.round((dailyData[d]?.unproductiveSeconds ?? 0) / 60));
  const dayLabels = days.map((d) => {
    const dt = new Date(d);
    return dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  });
  renderBarChart("chart-daily", dayLabels, prodData, unprodData);
  const breakdown = todayRecord?.siteBreakdown ?? {};
  const entries = Object.entries(breakdown).sort((a, b) => b[1] - a[1]).slice(0, 5);
  renderPieChart("chart-sites", entries);
  const scoreDays = getLast(14);
  const scoreData = scoreDays.map((d) => {
    const r = dailyData[d];
    if (!r) return null;
    return computeScore(r.productiveSeconds, r.unproductiveSeconds, settings.dailyGoalMinutes, settings.unproductiveCapMinutes);
  });
  const scoreLabels = scoreDays.map((d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }));
  renderLineChart("chart-score", scoreLabels, scoreData);
  renderStreakCalendar(dailyData, settings);
}
function getLast(n) {
  const result = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = /* @__PURE__ */ new Date();
    d.setDate(d.getDate() - i);
    result.push(toDateString(d));
  }
  return result;
}
function renderBarChart(canvasId, labels, prodData, unprodData) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const existing = Chart.getChart(canvas);
  if (existing) existing.destroy();
  new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Productive (min)",
          data: prodData,
          backgroundColor: "rgba(74,222,128,0.7)",
          borderColor: "#4ade80",
          borderWidth: 1,
          borderRadius: 4
        },
        {
          label: "Unproductive (min)",
          data: unprodData,
          backgroundColor: "rgba(248,113,113,0.7)",
          borderColor: "#f87171",
          borderWidth: 1,
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "#555", font: { size: 11 } }, grid: { color: "#1a1a1a" } },
        y: { ticks: { color: "#555", font: { size: 11 } }, grid: { color: "#1a1a1a" } }
      }
    }
  });
}
function renderPieChart(canvasId, entries) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const existing = Chart.getChart(canvas);
  if (existing) existing.destroy();
  if (entries.length === 0) {
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#333";
      ctx.font = "13px Inter";
      ctx.textAlign = "center";
      ctx.fillText("No data yet today", canvas.width / 2, canvas.height / 2);
    }
    return;
  }
  const colors = ["#6c63ff", "#4ade80", "#fb923c", "#f87171", "#a78bfa"];
  new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: entries.map(([domain, sec]) => `${domain} (${formatDuration(sec)})`),
      datasets: [
        {
          data: entries.map(([, sec]) => sec),
          backgroundColor: colors,
          borderWidth: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: "#666", font: { size: 11 }, boxWidth: 12, padding: 8 }
        }
      }
    }
  });
}
function renderLineChart(canvasId, labels, data) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const existing = Chart.getChart(canvas);
  if (existing) existing.destroy();
  new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Score",
          data,
          borderColor: "#6c63ff",
          backgroundColor: "rgba(108,99,255,0.1)",
          borderWidth: 2,
          pointBackgroundColor: "#6c63ff",
          pointRadius: 3,
          tension: 0.3,
          fill: true,
          spanGaps: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "#555", font: { size: 10 } }, grid: { color: "#1a1a1a" } },
        y: {
          min: 0,
          max: 100,
          ticks: { color: "#555", font: { size: 11 }, stepSize: 25 },
          grid: { color: "#1a1a1a" }
        }
      }
    }
  });
}
function renderStreakCalendar(dailyData, settings) {
  const container = document.getElementById("streak-calendar");
  if (!container) return;
  container.innerHTML = "";
  const today = toDateString();
  for (let i = 89; i >= 0; i--) {
    const d = /* @__PURE__ */ new Date();
    d.setDate(d.getDate() - i);
    const dateStr = toDateString(d);
    const record = dailyData[dateStr];
    const cell = document.createElement("div");
    cell.className = "cal-day";
    if (record && record.goalMet) {
      const score = computeScore(record.productiveSeconds, record.unproductiveSeconds, settings.dailyGoalMinutes, settings.unproductiveCapMinutes);
      cell.classList.add("productive");
      if (score >= 80) cell.classList.add("high");
    }
    if (dateStr === today) cell.classList.add("today");
    cell.title = dateStr;
    container.appendChild(cell);
  }
}
function renderSites() {
  renderTagList("productive-tags", editableProductiveSites, "productive");
  renderTagList("unproductive-tags", editableUnproductiveSites, "unproductive");
}
function renderTagList(containerId, sites, type) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";
  sites.forEach((site, idx) => {
    const tag = document.createElement("div");
    tag.className = "tag";
    tag.innerHTML = `${site}<span class="remove" data-idx="${idx}" data-type="${type}">×</span>`;
    tag.querySelector(".remove")?.addEventListener("click", () => {
      if (type === "productive") editableProductiveSites.splice(idx, 1);
      else editableUnproductiveSites.splice(idx, 1);
      renderSites();
    });
    container.appendChild(tag);
  });
}
function setupSiteAdder(inputId, type) {
  const input = document.getElementById(inputId);
  const addBtn = document.getElementById(`btn-add-${type}`);
  const doAdd = () => {
    if (!input) return;
    const raw = input.value.trim();
    if (!raw) return;
    const domain = extractDomain(raw);
    if (!domain) return;
    const list = type === "productive" ? editableProductiveSites : editableUnproductiveSites;
    if (!list.includes(domain)) {
      list.push(domain);
      renderSites();
    }
    input.value = "";
  };
  addBtn?.addEventListener("click", doAdd);
  input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doAdd();
  });
}
function renderGoals() {
  if (!storage) return;
  const s = storage.settings;
  setVal("g-goal", s.dailyGoalMinutes);
  setVal("g-cap", s.unproductiveCapMinutes);
  setVal("g-countdown", s.countdownSeconds);
  setVal("g-work", s.pomodoroWorkMinutes);
  setVal("g-short-break", s.pomodoroShortBreakMinutes);
  setVal("g-long-break", s.pomodoroLongBreakMinutes);
  setVal("g-break-reminder", s.breakReminderMinutes);
  setVal("g-focus-default", s.focusModeDefaultMinutes);
  document.querySelector(`input[name="warning-mode"][value="${s.warningMode}"]`)?.click();
  document.getElementById("g-auto-focus") && (document.getElementById("g-auto-focus").checked = s.pomodoroAutoFocusMode);
  document.getElementById("g-grace-period") && (document.getElementById("g-grace-period").checked = s.gracePeriodEnabled);
  const updateCountdownRow = () => {
    const mode = document.querySelector('input[name="warning-mode"]:checked')?.value;
    const row = document.getElementById("countdown-seconds-row");
    if (row) row.style.display = mode === "countdown" ? "flex" : "none";
  };
  document.querySelectorAll('input[name="warning-mode"]').forEach((r) => r.addEventListener("change", updateCountdownRow));
  updateCountdownRow();
}
function renderProfile() {
  if (!storage) return;
  document.getElementById("p-name") && (document.getElementById("p-name").value = storage.settings.userName);
}
function setupActions() {
  setupSiteAdder("productive-input", "productive");
  setupSiteAdder("unproductive-input", "unproductive");
  document.getElementById("btn-save-sites")?.addEventListener("click", async () => {
    if (!storage) return;
    const newSettings = {
      ...storage.settings,
      productiveSites: [...editableProductiveSites],
      unproductiveSites: [...editableUnproductiveSites]
    };
    await chrome.storage.local.set({ settings: newSettings });
    storage.settings = newSettings;
    flashStatus("save-sites-status", "Saved!");
  });
  document.getElementById("btn-save-goals")?.addEventListener("click", async () => {
    if (!storage) return;
    const mode = document.querySelector('input[name="warning-mode"]:checked')?.value;
    const newSettings = {
      ...storage.settings,
      dailyGoalMinutes: numVal("g-goal") || storage.settings.dailyGoalMinutes,
      unproductiveCapMinutes: numVal("g-cap") ?? storage.settings.unproductiveCapMinutes,
      warningMode: mode ?? storage.settings.warningMode,
      countdownSeconds: numVal("g-countdown") || storage.settings.countdownSeconds,
      pomodoroWorkMinutes: numVal("g-work") || storage.settings.pomodoroWorkMinutes,
      pomodoroShortBreakMinutes: numVal("g-short-break") || storage.settings.pomodoroShortBreakMinutes,
      pomodoroLongBreakMinutes: numVal("g-long-break") || storage.settings.pomodoroLongBreakMinutes,
      pomodoroAutoFocusMode: document.getElementById("g-auto-focus")?.checked ?? false,
      breakReminderMinutes: numVal("g-break-reminder") ?? storage.settings.breakReminderMinutes,
      focusModeDefaultMinutes: numVal("g-focus-default") || storage.settings.focusModeDefaultMinutes,
      gracePeriodEnabled: document.getElementById("g-grace-period")?.checked ?? false
    };
    await chrome.storage.local.set({ settings: newSettings });
    storage.settings = newSettings;
    flashStatus("save-goals-status", "Saved!");
  });
  document.getElementById("btn-save-profile")?.addEventListener("click", async () => {
    if (!storage) return;
    const name = document.getElementById("p-name")?.value.trim() ?? "";
    const newSettings = { ...storage.settings, userName: name };
    await chrome.storage.local.set({ settings: newSettings });
    storage.settings = newSettings;
    flashStatus("save-profile-status", "Saved!");
  });
  document.getElementById("btn-export")?.addEventListener("click", () => {
    if (!storage) return;
    const blob = new Blob([JSON.stringify(storage, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `focusforge-export-${toDateString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
  document.getElementById("btn-reset-all")?.addEventListener("click", async () => {
    const confirmed = confirm(
      "This will permanently delete all your data, streaks, and settings. This cannot be undone. Continue?"
    );
    if (!confirmed) return;
    await chrome.storage.local.clear();
    chrome.tabs.create({ url: chrome.runtime.getURL("onboarding/index.html") });
    window.close();
  });
}
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}
function setVal(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = String(value);
}
function numVal(id) {
  return parseInt(document.getElementById(id)?.value ?? "0", 10);
}
function flashStatus(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.add("visible");
  setTimeout(() => el.classList.remove("visible"), 2500);
}
init();
