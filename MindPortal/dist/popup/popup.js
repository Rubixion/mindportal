import "../chunks/modulepreload-polyfill-DaKOjhqt.js";
import { _ as __vitePreload } from "../chunks/preload-helper-BkSzTOHT.js";
import { t as toDateString, b as computeScore, f as formatDuration, s as scoreColor, g as formatCountdown, e as extractDomain } from "../chunks/utils-DXHU2JcO.js";
import { c as DEFAULT_SETTINGS } from "../chunks/defaults-CSo6VrWZ.js";
let ChartLib = null;
let storage = null;
let notes = "";
let timerInterval = null;
let focusInterval = null;
let selectedGoal = 120;
let editableProductiveSites = [];
let editableUnproductiveSites = [];
const boundTabs = /* @__PURE__ */ new Set();
let dailyChart = null;
async function init() {
  storage = await chrome.runtime.sendMessage({ type: "GET_STORAGE" });
  const rawNotes = await chrome.storage.local.get("notes");
  notes = rawNotes["notes"] ?? "";
  applySize(storage.settings.popupSize ?? "normal");
  const dateEl = document.getElementById("score-date");
  if (dateEl) {
    dateEl.textContent = (/* @__PURE__ */ new Date()).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric"
    });
  }
  if (!storage.settings.onboardingComplete) {
    showOnboarding();
  } else {
    showAppShell();
    startPolling();
  }
}
function applySize(size) {
  document.body.classList.remove("size-mini", "size-normal", "size-large");
  document.body.classList.add(`size-${size}`);
  document.querySelectorAll(".sz-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.size === size);
  });
}
async function saveSize(size) {
  const raw = await chrome.storage.local.get("settings");
  const settings = { ...DEFAULT_SETTINGS, ...raw["settings"] ?? {} };
  settings.popupSize = size;
  await chrome.storage.local.set({ settings });
}
document.querySelectorAll(".sz-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const size = btn.dataset.size;
    applySize(size);
    saveSize(size);
  });
});
function showOnboarding() {
  document.getElementById("onboarding").classList.remove("hidden");
  document.getElementById("app-shell").classList.add("hidden");
  const wrap = document.getElementById("ob-ollie-wrap");
  if (wrap) wrap.innerHTML = cloneOllieSVG(60);
  const wrap1 = document.getElementById("ob-ollie-wrap-1");
  if (wrap1) wrap1.innerHTML = cloneOllieSVG(52);
  applyOllieMood(wrap?.querySelector("svg") ?? null, "happy");
  applyOllieMood(wrap1?.querySelector("svg") ?? null, "hungry");
  document.getElementById("ob-next-0")?.addEventListener("click", () => goStep(1));
  document.getElementById("ob-next-1")?.addEventListener("click", () => {
    const name = document.getElementById("ob-name")?.value.trim();
    if (!name) {
      document.getElementById("ob-name")?.focus();
      return;
    }
    goStep(2);
  });
  document.getElementById("ob-name")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("ob-next-1")?.click();
  });
  document.querySelectorAll(".goal-opt").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".goal-opt").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      selectedGoal = Number(btn.dataset.val);
    });
  });
  document.getElementById("ob-finish")?.addEventListener("click", finishOnboarding);
}
function goStep(step) {
  document.querySelectorAll(".ob-step").forEach((el) => el.classList.add("hidden"));
  document.getElementById(`ob-${step}`)?.classList.remove("hidden");
}
async function finishOnboarding() {
  const nameInput = document.getElementById("ob-name");
  const name = nameInput?.value.trim() || "there";
  const raw = await chrome.storage.local.get("settings");
  const settings = { ...DEFAULT_SETTINGS, ...raw["settings"] ?? {} };
  settings.userName = name;
  settings.dailyGoalMinutes = selectedGoal;
  settings.onboardingComplete = true;
  await chrome.storage.local.set({ settings });
  storage = await chrome.runtime.sendMessage({ type: "GET_STORAGE" });
  showAppShell();
  startPolling();
}
function showAppShell() {
  document.getElementById("onboarding").classList.add("hidden");
  document.getElementById("app-shell").classList.remove("hidden");
  editableProductiveSites = [...storage?.settings.productiveSites ?? DEFAULT_SETTINGS.productiveSites];
  editableUnproductiveSites = [...storage?.settings.unproductiveSites ?? DEFAULT_SETTINGS.unproductiveSites];
  setupTabs();
  setupOpenInPage();
  setupExport();
  switchTab("home");
}
function setupTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      if (tab) switchTab(tab);
    });
  });
}
function switchTab(tab) {
  document.querySelectorAll(".tab-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === tab);
  });
  document.querySelectorAll(".tab-panel").forEach((p) => {
    p.classList.toggle("active", p.id === `panel-${tab}`);
  });
  if (!boundTabs.has(tab)) {
    bindTabEvents(tab);
    boundTabs.add(tab);
  }
  renderTab(tab);
}
function bindTabEvents(tab) {
  switch (tab) {
    case "home":
      bindHomeEvents();
      break;
    case "sites":
      bindSitesEvents();
      break;
    case "goals":
      bindGoalsEvents();
      break;
    case "notes":
      bindNotesEvents();
      break;
    case "profile":
      bindProfileEvents();
      break;
  }
}
function renderTab(tab) {
  switch (tab) {
    case "home":
      renderHome();
      break;
    case "analytics":
      requestAnimationFrame(() => {
        renderAnalytics();
      });
      break;
    case "sites":
      renderSites();
      break;
    case "goals":
      renderGoalsForm();
      break;
    case "notes":
      renderNotes();
      break;
    case "profile":
      renderProfile();
      break;
  }
}
function renderHome() {
  if (!storage) return;
  renderPet();
  renderScore();
  renderProgress();
  renderPomodoro();
  renderFocusMode();
}
function bindHomeEvents() {
  document.getElementById("feed-btn")?.addEventListener("click", async () => {
    const result = await chrome.runtime.sendMessage({ type: "FEED_PET" });
    if (result.ok) {
      const wrap = document.getElementById("ollie-wrap");
      if (wrap) {
        wrap.className = "ollie-fed";
        setTimeout(() => {
          wrap.className = "ollie-happy";
        }, 700);
      }
      const feedBtn = document.getElementById("feed-btn");
      if (feedBtn) {
        feedBtn.textContent = "Fed!";
        feedBtn.classList.add("fed");
        feedBtn.disabled = true;
      }
      storage = await chrome.runtime.sendMessage({ type: "GET_STORAGE" });
      renderPet();
    } else if (result.reason === "not_enough_work") {
      const detail = document.getElementById("pet-mood-detail");
      if (detail) detail.textContent = `Need ${result.needed ?? "some"} more minutes of focus first`;
    }
  });
  document.getElementById("pom-start")?.addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ type: "START_POMODORO" });
    storage = await chrome.runtime.sendMessage({ type: "GET_STORAGE" });
    renderPomodoro();
  });
  document.getElementById("pom-pause")?.addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ type: "PAUSE_POMODORO" });
    storage = await chrome.runtime.sendMessage({ type: "GET_STORAGE" });
    renderPomodoro();
  });
  document.getElementById("pom-resume")?.addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ type: "START_POMODORO" });
    storage = await chrome.runtime.sendMessage({ type: "GET_STORAGE" });
    renderPomodoro();
  });
  document.getElementById("pom-skip")?.addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ type: "SKIP_POMODORO" });
    storage = await chrome.runtime.sendMessage({ type: "GET_STORAGE" });
    renderPomodoro();
  });
  document.getElementById("pom-stop")?.addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ type: "STOP_POMODORO" });
    storage = await chrome.runtime.sendMessage({ type: "GET_STORAGE" });
    renderPomodoro();
  });
  document.getElementById("btn-focus-activate")?.addEventListener("click", async () => {
    const sel = document.getElementById("focus-duration");
    const minutes = Number(sel?.value ?? 30);
    await chrome.runtime.sendMessage({ type: "ACTIVATE_FOCUS_MODE", minutes });
    storage = await chrome.runtime.sendMessage({ type: "GET_STORAGE" });
    renderFocusMode();
  });
  document.getElementById("btn-focus-cancel")?.addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ type: "DEACTIVATE_FOCUS_MODE" });
    storage = await chrome.runtime.sendMessage({ type: "GET_STORAGE" });
    renderFocusMode();
  });
}
function cloneOllieSVG(size) {
  const svg = document.getElementById("ollie-svg");
  if (!svg) return "";
  const clone = svg.cloneNode(true);
  clone.setAttribute("width", String(size));
  clone.setAttribute("height", String(Math.round(size * 78 / 64)));
  clone.removeAttribute("id");
  return clone.outerHTML;
}
function getOllieMood(pet) {
  if (!pet.lastFedDate) return "hungry";
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  if (pet.lastFedDate === today) return "happy";
  const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  if (pet.lastFedDate === yesterday) return "hungry";
  return "sad";
}
function getPetLevel(streak) {
  if (streak >= 60) return 5;
  if (streak >= 30) return 4;
  if (streak >= 14) return 3;
  if (streak >= 7) return 2;
  return 1;
}
function applyOllieMood(svg, mood) {
  if (!svg) return;
  const irisL = svg.querySelector("#ollie-iris-l, [id='ollie-iris-l']");
  const irisR = svg.querySelector("#ollie-iris-r, [id='ollie-iris-r']");
  const cheekL = svg.querySelector("#ollie-cheek-l, [id='ollie-cheek-l']");
  const cheekR = svg.querySelector("#ollie-cheek-r, [id='ollie-cheek-r']");
  const tear = svg.querySelector("#ollie-tear, [id='ollie-tear']");
  const pupilL = svg.querySelector("#ollie-pupil-l, [id='ollie-pupil-l']");
  const pupilR = svg.querySelector("#ollie-pupil-r, [id='ollie-pupil-r']");
  if (mood === "happy") {
    irisL?.setAttribute("r", "7");
    irisR?.setAttribute("r", "7");
    irisL?.setAttribute("cy", "30");
    irisR?.setAttribute("cy", "30");
    pupilL?.setAttribute("r", "4");
    pupilR?.setAttribute("r", "4");
    cheekL?.setAttribute("opacity", "0.22");
    cheekR?.setAttribute("opacity", "0.22");
    tear?.setAttribute("opacity", "0");
    irisL?.setAttribute("fill", "rgb(100,130,210)");
    irisR?.setAttribute("fill", "rgb(100,130,210)");
  } else if (mood === "hungry") {
    irisL?.setAttribute("r", "6");
    irisR?.setAttribute("r", "6");
    irisL?.setAttribute("cy", "30");
    irisR?.setAttribute("cy", "30");
    pupilL?.setAttribute("r", "3.5");
    pupilR?.setAttribute("r", "3.5");
    cheekL?.setAttribute("opacity", "0");
    cheekR?.setAttribute("opacity", "0");
    tear?.setAttribute("opacity", "0");
    irisL?.setAttribute("fill", "rgb(100,130,210)");
    irisR?.setAttribute("fill", "rgb(100,130,210)");
  } else {
    irisL?.setAttribute("r", "5");
    irisR?.setAttribute("r", "5");
    irisL?.setAttribute("cy", "32");
    irisR?.setAttribute("cy", "32");
    pupilL?.setAttribute("r", "3");
    pupilR?.setAttribute("r", "3");
    pupilL?.setAttribute("cy", "32");
    pupilR?.setAttribute("cy", "32");
    cheekL?.setAttribute("opacity", "0");
    cheekR?.setAttribute("opacity", "0");
    tear?.setAttribute("opacity", "0.6");
    irisL?.setAttribute("fill", "rgba(100,130,210,0.5)");
    irisR?.setAttribute("fill", "rgba(100,130,210,0.5)");
  }
}
function renderPet() {
  if (!storage) return;
  const { pet, streak, settings } = storage;
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const mood = getOllieMood(pet);
  const level = getPetLevel(streak.current);
  const wrap = document.getElementById("ollie-wrap");
  if (wrap) {
    wrap.className = `ollie-${mood}`;
    const svg = document.getElementById("ollie-svg");
    applyOllieMood(svg, mood);
  }
  const greetEl = document.getElementById("pet-greeting");
  const hour = (/* @__PURE__ */ new Date()).getHours();
  const period = hour < 12 ? "Morning" : hour < 17 ? "Hey" : "Evening";
  const name = settings.userName || "";
  if (greetEl) greetEl.textContent = name ? `${period}, ${name}!` : `${period}!`;
  const moodEl = document.getElementById("pet-mood-text");
  const moodTexts = {
    happy: "Ollie is happy — well fed!",
    hungry: "Ollie needs feeding today",
    sad: "Ollie is sad — missed a day"
  };
  if (moodEl) moodEl.textContent = moodTexts[mood] ?? "";
  const detailEl = document.getElementById("pet-mood-detail");
  if (detailEl) {
    if (mood === "hungry") {
      const prodSec = storage.dailyData[today]?.productiveSeconds ?? 0;
      const needed = Math.max(0, 20 - Math.floor(prodSec / 60));
      detailEl.textContent = needed > 0 ? `${needed}m more focus time to unlock feed` : "Ready to be fed!";
    } else if (mood === "happy") {
      detailEl.textContent = `Level ${level} companion · ${pet.totalFeedCount} total feeds`;
    } else {
      detailEl.textContent = "Hit today's goal to start the streak again";
    }
  }
  const numEl = document.getElementById("streak-num");
  if (numEl) numEl.textContent = String(streak.current);
  const feedBtn = document.getElementById("feed-btn");
  if (feedBtn) {
    const alreadyFed = pet.lastFedDate === today;
    const prodSec = storage.dailyData[today]?.productiveSeconds ?? 0;
    const canFeed = !alreadyFed && prodSec >= 20 * 60;
    feedBtn.disabled = !canFeed;
    if (alreadyFed) {
      feedBtn.textContent = "Fed!";
      feedBtn.classList.add("fed");
    } else {
      feedBtn.textContent = "Feed Ollie";
      feedBtn.classList.remove("fed");
    }
  }
}
function renderScore() {
  if (!storage) return;
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const record = storage.dailyData[today];
  const { settings } = storage;
  const score = record ? computeScore(record.productiveSeconds, record.unproductiveSeconds, settings.dailyGoalMinutes, settings.unproductiveCapMinutes) : 0;
  const numEl = document.getElementById("score-num");
  const arcEl = document.getElementById("score-arc");
  const gradeEl = document.getElementById("score-grade");
  const subEl = document.getElementById("score-sub");
  if (numEl) {
    numEl.textContent = String(score);
    numEl.style.color = score > 0 ? scoreColor(score) : "rgba(255,255,255,0.3)";
  }
  if (arcEl) {
    const circ = 175.9;
    arcEl.style.strokeDashoffset = String(circ - score / 100 * circ);
    arcEl.style.stroke = scoreColor(score);
  }
  const grade = score >= 90 ? "Excellent" : score >= 70 ? "Good" : score >= 50 ? "Fair" : score > 0 ? "Keep going" : "Not started";
  if (gradeEl) gradeEl.textContent = grade;
  const prodMin = record ? Math.floor(record.productiveSeconds / 60) : 0;
  if (subEl) subEl.textContent = prodMin > 0 ? `${prodMin}m productive today` : "Start a productive session";
}
function renderProgress() {
  if (!storage) return;
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const record = storage.dailyData[today];
  const { settings } = storage;
  const prodSec = record?.productiveSeconds ?? 0;
  const unprodSec = record?.unproductiveSeconds ?? 0;
  const goalSec = settings.dailyGoalMinutes * 60;
  const capSec = settings.unproductiveCapMinutes * 60;
  const prodPct = Math.min(prodSec / goalSec * 100, 100);
  const unprodPct = Math.min(unprodSec / capSec * 100, 100);
  const prodBar = document.getElementById("prod-bar");
  const unprodBar = document.getElementById("unprod-bar");
  if (prodBar) prodBar.style.width = `${prodPct}%`;
  if (unprodBar) {
    unprodBar.style.width = `${unprodPct}%`;
    unprodBar.className = `prog-fill ${unprodPct >= 100 ? "over" : "dim"}`;
  }
  const prodValEl = document.getElementById("prod-val");
  const unprodValEl = document.getElementById("unprod-val");
  if (prodValEl) prodValEl.textContent = `${formatDuration(prodSec)} / ${formatDuration(goalSec)}`;
  if (unprodValEl) unprodValEl.textContent = `${formatDuration(unprodSec)} / ${formatDuration(capSec)}`;
  const topEl = document.getElementById("top-sites");
  if (topEl && record) {
    const sorted = Object.entries(record.siteBreakdown).sort((a, b) => b[1] - a[1]).slice(0, 3);
    topEl.innerHTML = sorted.length ? sorted.map(
      ([domain, secs]) => `<div class="top-site-row"><span class="top-site-name">${domain}</span><span class="top-site-time">${formatDuration(secs)}</span></div>`
    ).join("") : "";
  }
}
function renderPomodoro() {
  if (!storage) return;
  const { session, settings } = storage;
  const timeEl = document.getElementById("timer-time");
  const modeEl = document.getElementById("timer-mode-text");
  const sessionEl = document.getElementById("session-count");
  const startBtn = document.getElementById("pom-start");
  const pauseBtn = document.getElementById("pom-pause");
  const resumeBtn = document.getElementById("pom-resume");
  const skipBtn = document.getElementById("pom-skip");
  const stopBtn = document.getElementById("pom-stop");
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  if (session.pomodoroActive && session.pomodoroEndTime) {
    startBtn?.classList.add("hidden");
    pauseBtn?.classList.remove("hidden");
    resumeBtn?.classList.add("hidden");
    skipBtn?.classList.remove("hidden");
    stopBtn?.classList.remove("hidden");
    const sessionNum = session.pomodoroSessionCount % 4 + (session.pomodoroIsBreak ? 0 : 1);
    const type = session.pomodoroIsBreak ? session.pomodoroSessionCount % 4 === 0 ? "Long Break" : "Short Break" : "Work";
    if (sessionEl) sessionEl.textContent = `Session ${sessionNum}/4`;
    if (modeEl) {
      modeEl.textContent = type;
      modeEl.classList.remove("hidden");
    }
    const endTime = session.pomodoroEndTime;
    const updateTimer = () => {
      const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1e3));
      if (timeEl) timeEl.textContent = formatCountdown(remaining);
    };
    updateTimer();
    timerInterval = setInterval(updateTimer, 500);
  } else if (!session.pomodoroActive && session.pomodoroEndTime === null && session.pomodoroSessionCount > 0) {
    startBtn?.classList.add("hidden");
    pauseBtn?.classList.add("hidden");
    resumeBtn?.classList.remove("hidden");
    skipBtn?.classList.remove("hidden");
    stopBtn?.classList.remove("hidden");
    if (timeEl) timeEl.textContent = formatCountdown(settings.pomodoroWorkMinutes * 60);
    if (modeEl) modeEl.classList.add("hidden");
    if (sessionEl) sessionEl.textContent = "Paused";
  } else {
    startBtn?.classList.remove("hidden");
    pauseBtn?.classList.add("hidden");
    resumeBtn?.classList.add("hidden");
    skipBtn?.classList.add("hidden");
    stopBtn?.classList.add("hidden");
    if (timeEl) timeEl.textContent = formatCountdown(settings.pomodoroWorkMinutes * 60);
    if (modeEl) modeEl.classList.add("hidden");
    if (sessionEl) sessionEl.textContent = "";
  }
}
function renderFocusMode() {
  if (!storage) return;
  const { session } = storage;
  const idleEl = document.getElementById("focus-idle");
  const activeEl = document.getElementById("focus-active");
  const activateBtn = document.getElementById("btn-focus-activate");
  const cancelBtn = document.getElementById("btn-focus-cancel");
  const durationSel = document.getElementById("focus-duration");
  const remainEl = document.getElementById("focus-remaining");
  if (focusInterval) {
    clearInterval(focusInterval);
    focusInterval = null;
  }
  if (session.focusModeActive && session.focusModeEndTime) {
    idleEl?.classList.add("hidden");
    activeEl?.classList.remove("hidden");
    activateBtn?.classList.add("hidden");
    durationSel?.classList.add("hidden");
    cancelBtn?.classList.remove("hidden");
    const endTime = session.focusModeEndTime;
    const updateRemaining = () => {
      const secs = Math.max(0, Math.ceil((endTime - Date.now()) / 1e3));
      if (remainEl) remainEl.textContent = `${formatCountdown(secs)} remaining`;
    };
    updateRemaining();
    focusInterval = setInterval(updateRemaining, 1e3);
  } else {
    idleEl?.classList.remove("hidden");
    activeEl?.classList.add("hidden");
    activateBtn?.classList.remove("hidden");
    durationSel?.classList.remove("hidden");
    cancelBtn?.classList.add("hidden");
  }
}
async function renderAnalytics() {
  if (!storage) return;
  if (!ChartLib) {
    ChartLib = await __vitePreload(() => import("../chunks/auto-CrGn616D.js"), true ? [] : void 0);
  }
  const Chart = ChartLib.default;
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
  const dayLabels = days.map((d) => (/* @__PURE__ */ new Date(d + "T12:00:00")).toLocaleDateString("en-US", { weekday: "short" }));
  const canvas = document.getElementById("chart-daily");
  if (canvas) {
    if (dailyChart) {
      dailyChart.destroy();
      dailyChart = null;
    }
    dailyChart = new Chart(canvas, {
      type: "bar",
      data: {
        labels: dayLabels,
        datasets: [
          {
            label: "Productive",
            data: prodData,
            backgroundColor: "rgba(100,130,210,0.75)",
            borderColor: "rgb(100,130,210)",
            borderWidth: 1,
            borderRadius: 4
          },
          {
            label: "Unproductive",
            data: unprodData,
            backgroundColor: "rgba(248,113,113,0.55)",
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
          x: { ticks: { color: "rgba(255,255,255,0.35)", font: { size: 10 } }, grid: { color: "rgba(255,255,255,0.04)" } },
          y: { ticks: { color: "rgba(255,255,255,0.35)", font: { size: 10 } }, grid: { color: "rgba(255,255,255,0.04)" } }
        }
      }
    });
  }
  renderStreakCalendar(dailyData, settings);
  const breakdown = todayRecord?.siteBreakdown ?? {};
  const breakdownEl = document.getElementById("sites-breakdown");
  if (breakdownEl) {
    const sorted = Object.entries(breakdown).sort((a, b) => b[1] - a[1]).slice(0, 6);
    if (sorted.length === 0) {
      breakdownEl.innerHTML = `<div class="no-data">No browsing data recorded today</div>`;
    } else {
      const max = sorted[0]?.[1] ?? 1;
      breakdownEl.innerHTML = sorted.map(([domain, secs]) => {
        const pct = Math.round(secs / max * 100);
        const cat = settings.productiveSites.some((s) => domain.endsWith(s) || domain === s) ? "prod" : settings.unproductiveSites.some((s) => domain.endsWith(s) || domain === s) ? "unprod" : "neutral";
        return `
          <div class="breakdown-row">
            <div class="breakdown-label">
              <span class="breakdown-domain">${domain}</span>
              <span class="breakdown-time">${formatDuration(secs)}</span>
            </div>
            <div class="breakdown-track">
              <div class="breakdown-fill ${cat}" style="width:${pct}%"></div>
            </div>
          </div>
        `;
      }).join("");
    }
  }
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
      const s = computeScore(record.productiveSeconds, record.unproductiveSeconds, settings.dailyGoalMinutes, settings.unproductiveCapMinutes);
      cell.classList.add("productive");
      if (s >= 80) cell.classList.add("high");
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
    tag.className = `mp-tag ${type}`;
    tag.innerHTML = `<span>${site}</span><button class="mp-tag-remove" data-idx="${idx}" data-type="${type}" aria-label="Remove">×</button>`;
    tag.querySelector(".mp-tag-remove")?.addEventListener("click", () => {
      if (type === "productive") editableProductiveSites.splice(idx, 1);
      else editableUnproductiveSites.splice(idx, 1);
      renderTagList(containerId, type === "productive" ? editableProductiveSites : editableUnproductiveSites, type);
    });
    container.appendChild(tag);
  });
}
function bindSitesEvents() {
  setupSiteAdder("productive-input", "btn-add-productive", "productive");
  setupSiteAdder("unproductive-input", "btn-add-unproductive", "unproductive");
  document.getElementById("btn-save-sites")?.addEventListener("click", saveSites);
}
function setupSiteAdder(inputId, btnId, type) {
  const input = document.getElementById(inputId);
  const btn = document.getElementById(btnId);
  const containerId = type === "productive" ? "productive-tags" : "unproductive-tags";
  const doAdd = () => {
    if (!input) return;
    const raw = input.value.trim();
    if (!raw) return;
    const domain = extractDomain(raw);
    if (!domain) return;
    const list = type === "productive" ? editableProductiveSites : editableUnproductiveSites;
    if (!list.includes(domain)) {
      list.push(domain);
      renderTagList(containerId, list, type);
    }
    input.value = "";
  };
  btn?.addEventListener("click", doAdd);
  input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doAdd();
  });
}
async function saveSites() {
  if (!storage) return;
  const newSettings = {
    ...storage.settings,
    productiveSites: [...editableProductiveSites],
    unproductiveSites: [...editableUnproductiveSites]
  };
  await chrome.storage.local.set({ settings: newSettings });
  storage.settings = newSettings;
  flashStatus("save-sites-status", "Saved!");
}
function renderGoalsForm() {
  if (!storage) return;
  const s = storage.settings;
  setInputVal("g-goal", s.dailyGoalMinutes);
  setInputVal("g-cap", s.unproductiveCapMinutes);
  setInputVal("g-work", s.pomodoroWorkMinutes);
  setInputVal("g-short-break", s.pomodoroShortBreakMinutes);
  setInputVal("g-long-break", s.pomodoroLongBreakMinutes);
  setInputVal("g-focus-default", s.focusModeDefaultMinutes);
  const warningRadio = document.querySelector(`input[name="warning-mode"][value="${s.warningMode}"]`);
  if (warningRadio) warningRadio.checked = true;
  const autoFocus = document.getElementById("g-auto-focus");
  if (autoFocus) autoFocus.checked = s.pomodoroAutoFocusMode;
  const gracePeriod = document.getElementById("g-grace-period");
  if (gracePeriod) gracePeriod.checked = s.gracePeriodEnabled;
}
function bindGoalsEvents() {
  document.getElementById("btn-save-goals")?.addEventListener("click", saveGoals);
}
async function saveGoals() {
  if (!storage) return;
  const warningMode = document.querySelector('input[name="warning-mode"]:checked')?.value;
  const newSettings = {
    ...storage.settings,
    dailyGoalMinutes: numVal("g-goal") || storage.settings.dailyGoalMinutes,
    unproductiveCapMinutes: numVal("g-cap") ?? storage.settings.unproductiveCapMinutes,
    warningMode: warningMode ?? storage.settings.warningMode,
    pomodoroWorkMinutes: numVal("g-work") || storage.settings.pomodoroWorkMinutes,
    pomodoroShortBreakMinutes: numVal("g-short-break") || storage.settings.pomodoroShortBreakMinutes,
    pomodoroLongBreakMinutes: numVal("g-long-break") || storage.settings.pomodoroLongBreakMinutes,
    pomodoroAutoFocusMode: document.getElementById("g-auto-focus")?.checked ?? false,
    focusModeDefaultMinutes: numVal("g-focus-default") || storage.settings.focusModeDefaultMinutes,
    gracePeriodEnabled: document.getElementById("g-grace-period")?.checked ?? false
  };
  await chrome.storage.local.set({ settings: newSettings });
  storage.settings = newSettings;
  flashStatus("save-goals-status", "Saved!");
}
function renderNotes() {
  const textarea = document.getElementById("notes-textarea");
  if (textarea && textarea.value === "") textarea.value = notes;
  updateNotesCount();
}
function bindNotesEvents() {
  const textarea = document.getElementById("notes-textarea");
  textarea?.addEventListener("input", updateNotesCount);
  document.getElementById("btn-save-notes")?.addEventListener("click", async () => {
    const ta = document.getElementById("notes-textarea");
    if (!ta) return;
    notes = ta.value;
    await chrome.storage.local.set({ notes });
    flashStatus("save-notes-status", "Saved!");
  });
}
function updateNotesCount() {
  const textarea = document.getElementById("notes-textarea");
  const count = document.getElementById("notes-count");
  if (count && textarea) count.textContent = `${textarea.value.length} chars`;
}
function renderProfile() {
  if (!storage) return;
  const nameInput = document.getElementById("p-name");
  if (nameInput) nameInput.value = storage.settings.userName;
}
function bindProfileEvents() {
  document.getElementById("btn-save-profile")?.addEventListener("click", async () => {
    if (!storage) return;
    const name = document.getElementById("p-name")?.value.trim() ?? "";
    const newSettings = { ...storage.settings, userName: name };
    await chrome.storage.local.set({ settings: newSettings });
    storage.settings = newSettings;
    flashStatus("save-profile-status", "Saved!");
  });
  document.getElementById("btn-reset-all")?.addEventListener("click", async () => {
    if (!confirm("This will permanently delete all your data, streaks, and settings. Continue?")) return;
    await chrome.storage.local.clear();
    location.reload();
  });
}
function setupOpenInPage() {
  document.getElementById("btn-open-page")?.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("src/options/index.html") });
  });
}
function setupExport() {
  document.getElementById("btn-export")?.addEventListener("click", () => {
    if (!storage) return;
    const blob = new Blob([JSON.stringify(storage, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mindportal-export-${toDateString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
}
function startPolling() {
  setInterval(async () => {
    storage = await chrome.runtime.sendMessage({ type: "GET_STORAGE" });
    const activeTab = document.querySelector(".tab-btn.active")?.dataset.tab;
    if (activeTab) renderTab(activeTab);
  }, 5e3);
}
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}
function setInputVal(id, value) {
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
function getLast(n) {
  const result = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = /* @__PURE__ */ new Date();
    d.setDate(d.getDate() - i);
    result.push(toDateString(d));
  }
  return result;
}
document.addEventListener("DOMContentLoaded", init);
