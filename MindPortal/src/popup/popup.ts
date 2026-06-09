import type { AppStorage } from "../shared/types";
import { formatDuration, formatCountdown, scoreColor, computeScore } from "../shared/utils";
import { getRandomQuote } from "../shared/quotes";

let storage: AppStorage | null = null;
let timerInterval: ReturnType<typeof setInterval> | null = null;
let focusInterval: ReturnType<typeof setInterval> | null = null;

async function init() {
  storage = (await chrome.runtime.sendMessage({ type: "GET_STORAGE" })) as AppStorage;

  if (!storage.settings.onboardingComplete) {
    chrome.tabs.create({ url: chrome.runtime.getURL("src/onboarding/index.html") });
    window.close();
    return;
  }

  renderAll();
  startPolling();
}

function renderAll() {
  if (!storage) return;
  renderHeader();
  renderScore();
  renderTimeBars();
  renderPomodoro();
  renderFocusMode();
  renderQuote();
}

function renderHeader() {
  if (!storage) return;
  const { streak, settings } = storage;
  const el = document.getElementById("streak-count");
  if (el) el.textContent = String(streak.current);

  const greetingEl = document.getElementById("greeting");
  const hour = new Date().getHours();
  const period = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const name = settings.userName ? `, ${settings.userName}` : "";
  if (greetingEl) greetingEl.textContent = `Good ${period}${name}`;

  const dateEl = document.getElementById("today-date");
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }
}

function renderScore() {
  if (!storage) return;
  const today = new Date().toISOString().slice(0, 10);
  const record = storage.dailyData[today];

  const numEl = document.getElementById("score-num");
  const ringEl = document.getElementById("ring-fill") as SVGCircleElement | null;
  const sessionsEl = document.getElementById("sessions-label");

  if (!record) {
    if (numEl) numEl.textContent = "0";
    if (ringEl) { ringEl.style.strokeDashoffset = "213.6"; ringEl.style.stroke = "#6c63ff"; }
    if (sessionsEl) sessionsEl.textContent = "";
    return;
  }

  const score = computeScore(
    record.productiveSeconds,
    record.unproductiveSeconds,
    storage.settings.dailyGoalMinutes,
    storage.settings.unproductiveCapMinutes
  );

  if (numEl) {
    numEl.textContent = String(score);
    numEl.style.color = scoreColor(score);
  }

  if (ringEl) {
    const circumference = 213.6;
    const offset = circumference - (score / 100) * circumference;
    ringEl.style.strokeDashoffset = String(offset);
    ringEl.style.stroke = scoreColor(score);
  }

  if (sessionsEl && record.pomodoroSessionsCompleted > 0) {
    sessionsEl.textContent = `🍅 ${record.pomodoroSessionsCompleted} session${record.pomodoroSessionsCompleted !== 1 ? "s" : ""} completed`;
  }
}

function renderTimeBars() {
  if (!storage) return;
  const today = new Date().toISOString().slice(0, 10);
  const record = storage.dailyData[today];
  const { settings } = storage;

  const prodSec = record?.productiveSeconds ?? 0;
  const unprodSec = record?.unproductiveSeconds ?? 0;
  const goalSec = settings.dailyGoalMinutes * 60;
  const capSec = settings.unproductiveCapMinutes * 60;

  const prodPct = Math.min((prodSec / goalSec) * 100, 100);
  const unprodPct = Math.min((unprodSec / capSec) * 100, 100);

  const prodBar = document.getElementById("productive-bar");
  const unprodBar = document.getElementById("unproductive-bar");
  const prodTime = document.getElementById("productive-time");
  const unprodTime = document.getElementById("unproductive-time");
  const prodGoal = document.getElementById("productive-goal");
  const unprodGoal = document.getElementById("unproductive-goal");

  if (prodBar) prodBar.style.width = `${prodPct}%`;
  if (unprodBar) unprodBar.style.width = `${unprodPct}%`;
  if (prodTime) prodTime.textContent = formatDuration(prodSec);
  if (unprodTime) unprodTime.textContent = formatDuration(unprodSec);
  if (prodGoal) prodGoal.textContent = `/ ${formatDuration(goalSec)}`;
  if (unprodGoal) unprodGoal.textContent = `/ ${formatDuration(capSec)}`;
}

function renderPomodoro() {
  if (!storage) return;
  const { session, settings } = storage;

  const displayEl = document.getElementById("timer-display");
  const idleControls = document.getElementById("timer-controls-idle");
  const activeControls = document.getElementById("timer-controls-active");
  const sessionInfoEl = document.getElementById("session-info");

  if (timerInterval) clearInterval(timerInterval);

  if (session.pomodoroActive && session.pomodoroEndTime) {
    idleControls?.classList.add("hidden");
    activeControls?.classList.remove("hidden");

    const updateDisplay = () => {
      const remaining = Math.max(0, Math.ceil((session.pomodoroEndTime! - Date.now()) / 1000));
      if (displayEl) displayEl.textContent = formatCountdown(remaining);
    };
    updateDisplay();
    timerInterval = setInterval(updateDisplay, 500);

    if (sessionInfoEl) {
      const sessionNum = (session.pomodoroSessionCount % 4) + (session.pomodoroIsBreak ? 0 : 1);
      const type = session.pomodoroIsBreak
        ? session.pomodoroSessionCount % 4 === 0 ? "Long Break" : "Short Break"
        : "Work";
      sessionInfoEl.textContent = `Session ${sessionNum}/4 · ${type}`;
    }

    // Color code
    if (displayEl) displayEl.style.color = session.pomodoroIsBreak ? "#4ade80" : "#e8e8e8";
  } else {
    idleControls?.classList.remove("hidden");
    activeControls?.classList.add("hidden");
    if (displayEl) {
      displayEl.textContent = formatCountdown(settings.pomodoroWorkMinutes * 60);
      displayEl.style.color = "#e8e8e8";
    }
    if (sessionInfoEl) sessionInfoEl.textContent = `Session 1/4 · Work`;
  }
}

function renderFocusMode() {
  if (!storage) return;
  const { session } = storage;

  const idleRow = document.getElementById("focus-idle-row");
  const activeRow = document.getElementById("focus-active-row");
  const remainingEl = document.getElementById("focus-remaining");

  if (focusInterval) clearInterval(focusInterval);

  if (session.focusModeActive && session.focusModeEndTime) {
    idleRow?.classList.add("hidden");
    activeRow?.classList.remove("hidden");

    const updateFocus = () => {
      const remaining = Math.max(0, Math.ceil((session.focusModeEndTime! - Date.now()) / 1000));
      if (remainingEl) remainingEl.textContent = `${formatCountdown(remaining)} remaining`;
    };
    updateFocus();
    focusInterval = setInterval(updateFocus, 1000);
  } else {
    idleRow?.classList.remove("hidden");
    activeRow?.classList.add("hidden");
  }
}

function renderQuote() {
  const q = getRandomQuote();
  const textEl = document.getElementById("quote-text");
  const authorEl = document.getElementById("quote-author");
  if (textEl) textEl.textContent = `"${q.text}"`;
  if (authorEl) authorEl.textContent = `— ${q.author}`;
}

// ── Controls ────────────────────────────────────────────────────────────────

document.getElementById("btn-start")?.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "START_POMODORO" });
  await refresh();
});

document.getElementById("btn-pause")?.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "PAUSE_POMODORO" });
  await refresh();
});

document.getElementById("btn-skip")?.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "SKIP_POMODORO" });
  await refresh();
});

document.getElementById("btn-stop")?.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "STOP_POMODORO" });
  await refresh();
});

document.getElementById("btn-focus-activate")?.addEventListener("click", async () => {
  const select = document.getElementById("focus-duration") as HTMLSelectElement | null;
  const minutes = parseInt(select?.value ?? "30", 10);
  await chrome.runtime.sendMessage({ type: "ACTIVATE_FOCUS_MODE", minutes });
  await refresh();
});

document.getElementById("btn-focus-cancel")?.addEventListener("click", async () => {
  const confirmed = confirm(
    "Are you sure you want to end Focus Mode? Distracting sites will be unblocked."
  );
  if (!confirmed) return;
  await chrome.runtime.sendMessage({ type: "DEACTIVATE_FOCUS_MODE" });
  await refresh();
});

document.getElementById("btn-options")?.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

document.getElementById("btn-analytics")?.addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("src/options/index.html") + "?tab=analytics" });
});

// ── Polling ─────────────────────────────────────────────────────────────────

function startPolling() {
  // Refresh storage every 5 seconds to keep time bars live
  setInterval(async () => {
    await refresh();
  }, 5000);
}

async function refresh() {
  storage = (await chrome.runtime.sendMessage({ type: "GET_STORAGE" })) as AppStorage;
  renderAll();
}

// ── Boot ────────────────────────────────────────────────────────────────────
init();
