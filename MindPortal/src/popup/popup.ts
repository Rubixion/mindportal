import type { Chart as ChartType } from "chart.js";
import type { AppStorage, OllieMood, PopupSize, Settings } from "../shared/types";
import {
  formatDuration,
  formatCountdown,
  scoreColor,
  toDateString,
  extractDomain,
} from "../shared/utils";
import { DEFAULT_SETTINGS } from "../shared/defaults";

// ─── Globals ──────────────────────────────────────────────────────────────────

let ChartLib: typeof import("chart.js/auto") | null = null;
let storage: AppStorage | null = null;
let notes = "";
let notesAutosaveTimer: ReturnType<typeof setTimeout> | null = null;
let dailyChart: ChartType | null = null;
let pollInterval: ReturnType<typeof setInterval> | null = null;

// Focus launcher state machine
type FocusState = "idle" | "countdown" | "active";
let focusState: FocusState = "idle";
let selectedMinutes = 25;
let focusCountdownTimer: ReturnType<typeof setTimeout> | null = null;
let focusCountdownNum = 3;

// Track which tabs have had event listeners bound
const boundTabs = new Set<string>();

// ─── Entry point ─────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  storage = await getStorage();
  applySize(storage.settings.popupSize ?? "normal");

  if (!storage.settings.onboardingComplete) {
    showOnboarding();
  } else {
    showApp();
  }
});

// ─── Storage ─────────────────────────────────────────────────────────────────

async function getStorage(): Promise<AppStorage> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "GET_STORAGE" }, (res: AppStorage) => {
      resolve(res);
    });
  });
}

async function refreshStorage() {
  storage = await getStorage();
}

// ─── Size ─────────────────────────────────────────────────────────────────────

function applySize(size: PopupSize) {
  document.body.classList.remove("size-mini", "size-large");
  if (size === "mini") document.body.classList.add("size-mini");
  if (size === "large") document.body.classList.add("size-large");

  const sM = document.getElementById("btn-size-m");
  const sS = document.getElementById("btn-size-s");
  const sL = document.getElementById("btn-size-l");
  sS?.classList.toggle("size-btn-active", size === "mini");
  sM?.classList.toggle("size-btn-active", size === "normal");
  sL?.classList.toggle("size-btn-active", size === "large");
}

async function setSize(size: PopupSize) {
  applySize(size);
  if (!storage) return;
  const settings: Settings = { ...storage.settings, popupSize: size };
  storage = { ...storage, settings };
  chrome.runtime.sendMessage({ type: "SAVE_SETTINGS", settings });
}

// ─── Onboarding ───────────────────────────────────────────────────────────────

function showOnboarding() {
  document.getElementById("onboarding")!.hidden = false;
  document.getElementById("app")!.hidden = true;
  bindOnboarding();
}

function showApp() {
  document.getElementById("onboarding")!.hidden = true;
  document.getElementById("app")!.hidden = false;
  bindAppShell();
  switchTab("home");
  startPolling();
}

function bindOnboarding() {
  let obGoalMinutes = 120;
  let obWarningMode: Settings["warningMode"] = "countdown";
  const obDistractionSites: string[] = [];

  // Step 1
  const nameInput = document.getElementById("ob-name-input") as HTMLInputElement;
  document.getElementById("ob-step1-next")?.addEventListener("click", () => {
    const name = nameInput.value.trim();
    if (!name) { nameInput.focus(); return; }
    goObStep(1, 2);
  });

  // Step 2 — chip selection
  document.querySelectorAll<HTMLButtonElement>(".ob-site-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      const site = btn.dataset.site!;
      btn.classList.toggle("selected");
      if (btn.classList.contains("selected")) {
        if (!obDistractionSites.includes(site)) obDistractionSites.push(site);
      } else {
        const idx = obDistractionSites.indexOf(site);
        if (idx > -1) obDistractionSites.splice(idx, 1);
      }
    });
  });

  document.getElementById("ob-step2-back")?.addEventListener("click", () => goObStep(2, 1));
  document.getElementById("ob-step2-next")?.addEventListener("click", () => goObStep(2, 3));

  // Step 3 — goal
  document.querySelectorAll<HTMLButtonElement>(".ob-goal-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".ob-goal-card").forEach((b) => b.classList.remove("ob-goal-selected"));
      btn.classList.add("ob-goal-selected");
      obGoalMinutes = parseInt(btn.dataset.minutes ?? "120");
    });
  });

  document.getElementById("ob-step3-back")?.addEventListener("click", () => goObStep(3, 2));
  document.getElementById("ob-step3-next")?.addEventListener("click", () => goObStep(3, 4));

  // Step 4 — warning mode
  document.querySelectorAll<HTMLButtonElement>(".ob-warn-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".ob-warn-card").forEach((b) => b.classList.remove("ob-warn-selected"));
      btn.classList.add("ob-warn-selected");
      obWarningMode = btn.dataset.mode as Settings["warningMode"];
    });
  });

  document.getElementById("ob-step4-back")?.addEventListener("click", () => goObStep(4, 3));
  document.getElementById("ob-step4-next")?.addEventListener("click", () => {
    const name = nameInput.value.trim();
    const title = document.getElementById("ob-final-title");
    const body = document.getElementById("ob-final-body");
    if (title) title.textContent = `You're all set${name ? `, ${name}` : ""}.`;
    if (body) body.textContent = `I'll be here whenever you need a nudge, ${name || "friend"}. Let's build something good.`;
    goObStep(4, 5);
  });

  // Step 5 — finish
  document.getElementById("ob-finish")?.addEventListener("click", async () => {
    const name = nameInput.value.trim();
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      userName: name,
      dailyGoalMinutes: obGoalMinutes,
      warningMode: obWarningMode,
      onboardingComplete: true,
      unproductiveSites: obDistractionSites.length > 0 ? obDistractionSites : DEFAULT_SETTINGS.unproductiveSites,
    };
    await new Promise<void>((res) => {
      chrome.runtime.sendMessage({ type: "SAVE_SETTINGS", settings }, () => res());
    });
    storage = await getStorage();
    showApp();
  });
}

function goObStep(from: number, to: number) {
  const fromEl = document.getElementById(`ob-step-${from}`);
  const toEl = document.getElementById(`ob-step-${to}`);
  if (fromEl) fromEl.hidden = true;
  if (toEl) toEl.hidden = false;
}

// ─── App shell ────────────────────────────────────────────────────────────────

function bindAppShell() {
  // Tab navigation
  document.querySelectorAll<HTMLButtonElement>(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      if (tab) switchTab(tab);
    });
    // Keyboard: arrow keys
    btn.addEventListener("keydown", (e) => {
      const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>(".tab-btn"));
      const idx = tabs.indexOf(btn);
      if (e.key === "ArrowRight" && idx < tabs.length - 1) {
        e.preventDefault();
        tabs[idx + 1]?.focus();
        tabs[idx + 1]?.click();
      } else if (e.key === "ArrowLeft" && idx > 0) {
        e.preventDefault();
        tabs[idx - 1]?.focus();
        tabs[idx - 1]?.click();
      }
    });
  });

  // Size buttons
  document.getElementById("btn-size-s")?.addEventListener("click", () => setSize("mini"));
  document.getElementById("btn-size-m")?.addEventListener("click", () => setSize("normal"));
  document.getElementById("btn-size-l")?.addEventListener("click", () => setSize("large"));

  // Open in page
  document.getElementById("btn-open-page")?.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("src/options/index.html") });
    window.close();
  });
}

function switchTab(tab: string) {
  // Update tab buttons
  document.querySelectorAll<HTMLButtonElement>(".tab-btn").forEach((btn) => {
    const isActive = btn.dataset.tab === tab;
    btn.classList.toggle("tab-active", isActive);
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  // Show/hide panels
  document.querySelectorAll<HTMLElement>(".panel").forEach((panel) => {
    panel.hidden = panel.id !== `panel-${tab}`;
  });

  // Bind events and render (once per tab)
  if (!boundTabs.has(tab)) {
    bindTabEvents(tab);
    boundTabs.add(tab);
  }

  renderTab(tab);
}

function renderTab(tab: string) {
  if (!storage) return;
  switch (tab) {
    case "home":      renderHome(); break;
    case "analytics": void renderAnalytics(); break;
    case "sites":     renderSites(); break;
    case "goals":     renderGoals(); break;
    case "notes":     /* Notes renders on first bind */ break;
    case "language":  renderLanguage(); break;
    case "profile":   renderProfile(); break;
  }
}

function startPolling() {
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(async () => {
    await refreshStorage();
    const activeTab = document.querySelector<HTMLButtonElement>(".tab-active")?.dataset.tab ?? "home";
    renderTab(activeTab);
    if (focusState === "active") updateFocusTimer();
  }, 5000);
}

// ─── Home ─────────────────────────────────────────────────────────────────────

function bindTabEvents(tab: string) {
  if (tab === "home") bindHome();
  if (tab === "analytics") { /* no persistent binds needed */ }
  if (tab === "sites") bindSites();
  if (tab === "goals") bindGoals();
  if (tab === "notes") bindNotes();
  if (tab === "language") bindLanguage();
  if (tab === "profile") bindProfile();
}

function renderHome() {
  if (!storage) return;
  const { settings, streak, session, dailyData, pet } = storage;
  const today = toDateString();
  const todayRecord = dailyData[today];
  const productiveSecs = todayRecord?.productiveSeconds ?? 0;
  const score = todayRecord?.score ?? 0;

  // Greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const name = settings.userName ? `, ${settings.userName}` : "";
  const greetEl = document.getElementById("today-greeting");
  if (greetEl) greetEl.textContent = `${greeting}${name}`;

  // Stats
  const timeEl = document.getElementById("stat-focus-time");
  if (timeEl) timeEl.textContent = formatDuration(productiveSecs);

  const streakEl = document.getElementById("stat-streak");
  if (streakEl) streakEl.textContent = String(streak.current);

  // Score ring
  const arc = document.getElementById("score-arc");
  const label = document.getElementById("score-label");
  const circumference = 113;
  const offset = circumference - (score / 100) * circumference;
  if (arc) {
    arc.setAttribute("stroke-dashoffset", String(offset));
    arc.setAttribute("stroke", scoreColor(score));
  }
  if (label) label.textContent = String(score);

  // Ollie mood + message
  updateOllie(storage, productiveSecs, score);

  // Suggestion card
  renderSuggestion(storage, productiveSecs, score);

  // Feed button
  const fedToday = pet.lastFedDate === today;
  const feedBtn = document.getElementById("feed-btn") as HTMLButtonElement | null;
  if (feedBtn) {
    feedBtn.textContent = fedToday ? "Fed ✓" : "Feed";
    feedBtn.disabled = fedToday;
    feedBtn.style.opacity = fedToday ? "0.5" : "1";
  }

  // Focus launcher sync
  if (session.focusModeActive) {
    setFocusState("active");
    updateFocusTimer();
  } else if (focusState === "active") {
    setFocusState("idle");
  }

  // Pomo card
  const pomoCard = document.getElementById("pomo-card");
  if (pomoCard) {
    const showPomo = session.pomodoroActive && !session.focusModeActive;
    pomoCard.hidden = !showPomo;
    if (showPomo) renderPomoCard();
  }
}

function bindHome() {
  // Feed
  document.getElementById("feed-btn")?.addEventListener("click", async () => {
    const res = await sendMsg({ type: "FEED_PET" }) as { ok: boolean; reason?: string; needed?: number };
    if (res.ok) {
      await refreshStorage();
      renderHome();
    } else if (res.reason === "already_fed") {
      showOllieMessage("You already fed me today! Come back tomorrow.", 3000);
    } else if (res.reason === "not_enough_work") {
      const n = res.needed ?? 0;
      showOllieMessage(`Need ${n} more minutes of focus time to feed me.`, 3000);
    }
  });

  // Preset buttons
  document.querySelectorAll<HTMLButtonElement>(".preset-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".preset-btn").forEach((b) => b.classList.remove("selected", "preset-default"));
      btn.classList.add("selected");
      selectedMinutes = parseInt(btn.dataset.minutes ?? "25");
    });
  });

  // Start focus
  document.getElementById("btn-start-focus")?.addEventListener("click", () => {
    startFocusCountdown();
  });

  // Intention input — also captures Enter
  const intentionInput = document.getElementById("fl-intention") as HTMLInputElement | null;
  intentionInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") startFocusCountdown();
  });

  // End focus
  document.getElementById("btn-end-focus")?.addEventListener("click", async () => {
    await sendMsg({ type: "DEACTIVATE_FOCUS_MODE" });
    setFocusState("idle");
    await refreshStorage();
    renderHome();
  });

  // Pomo controls
  document.getElementById("btn-pomo-pause")?.addEventListener("click", async () => {
    const { session } = storage!;
    if (session.pomodoroActive) {
      await sendMsg({ type: "PAUSE_POMODORO" });
    } else {
      await sendMsg({ type: "START_POMODORO", minutes: selectedMinutes });
    }
    await refreshStorage();
    renderHome();
  });

  document.getElementById("btn-pomo-skip")?.addEventListener("click", async () => {
    await sendMsg({ type: "SKIP_POMODORO" });
    await refreshStorage();
    renderHome();
  });

  document.getElementById("btn-pomo-stop")?.addEventListener("click", async () => {
    await sendMsg({ type: "STOP_POMODORO" });
    await refreshStorage();
    renderHome();
  });
}

// ─── Focus launcher state machine ─────────────────────────────────────────────

function setFocusState(state: FocusState) {
  focusState = state;
  const idle      = document.getElementById("fl-idle");
  const countdown = document.getElementById("fl-countdown");
  const active    = document.getElementById("fl-active");
  if (idle)      idle.hidden      = state !== "idle";
  if (countdown) countdown.hidden = state !== "countdown";
  if (active)    active.hidden    = state !== "active";
}

function startFocusCountdown() {
  if (focusState !== "idle") return;
  setFocusState("countdown");
  focusCountdownNum = 3;
  const numEl = document.getElementById("fl-countdown-num");
  if (numEl) numEl.textContent = "3";

  if (focusCountdownTimer) clearTimeout(focusCountdownTimer);

  const tick = () => {
    focusCountdownNum--;
    if (numEl) {
      numEl.style.opacity = "0";
      numEl.style.transform = "scale(0.7)";
      setTimeout(() => {
        if (numEl) {
          numEl.textContent = focusCountdownNum > 0 ? String(focusCountdownNum) : "Go!";
          numEl.style.opacity = "1";
          numEl.style.transform = "scale(1)";
        }
      }, 150);
    }

    if (focusCountdownNum > 0) {
      focusCountdownTimer = setTimeout(tick, 1000);
    } else {
      // Launch
      focusCountdownTimer = setTimeout(() => void activateFocus(), 600);
    }
  };

  focusCountdownTimer = setTimeout(tick, 1000);
}

async function activateFocus() {
  const intentionInput = document.getElementById("fl-intention") as HTMLInputElement | null;
  const intention = intentionInput?.value.trim() ?? "";

  await sendMsg({ type: "ACTIVATE_FOCUS_MODE", minutes: selectedMinutes, intention });
  await refreshStorage();
  setFocusState("active");

  // Display intention in active view
  const dispEl = document.getElementById("fl-active-intention");
  if (dispEl) dispEl.textContent = intention || "";

  updateFocusTimer();
}

function updateFocusTimer() {
  if (!storage) return;
  const { session } = storage;
  if (!session.focusModeActive || !session.focusModeEndTime) {
    const timerEl = document.getElementById("fl-timer-display");
    if (timerEl) timerEl.textContent = "00:00";
    return;
  }
  const remaining = Math.max(0, session.focusModeEndTime - Date.now());
  const timerEl = document.getElementById("fl-timer-display");
  if (timerEl) timerEl.textContent = formatCountdown(Math.floor(remaining / 1000));

  const intentionEl = document.getElementById("fl-active-intention");
  if (intentionEl && storage.session.intention) {
    intentionEl.textContent = storage.session.intention;
  }
}

// ─── Pomodoro card ───────────────────────────────────────────────────────────

function renderPomoCard() {
  if (!storage) return;
  const { session } = storage;
  const label = document.getElementById("pomo-label");
  const time  = document.getElementById("pomo-time");
  const count = document.getElementById("pomo-count");
  const pause = document.getElementById("btn-pomo-pause") as HTMLButtonElement | null;

  if (label) label.textContent = session.pomodoroIsBreak ? "Break" : "Focus";
  if (count) count.textContent = `Session ${session.pomodoroSessionCount + 1}`;
  if (pause) pause.textContent = session.pomodoroActive ? "Pause" : "Resume";

  if (session.pomodoroEndTime) {
    const remaining = Math.max(0, session.pomodoroEndTime - Date.now());
    if (time) time.textContent = formatCountdown(Math.floor(remaining / 1000));
  }
}

// ─── Ollie ────────────────────────────────────────────────────────────────────

const OLLIE_MOODS: Record<OllieMood, {
  mouthD: string;
  irisColor: string;
  cheekOpacity: number;
  message: string[];
}> = {
  happy: {
    mouthD: "M44 72 Q50 76 56 72",
    irisColor: "#6982d8",
    cheekOpacity: 0.18,
    message: [
      "Nice work today. Keep it going.",
      "You're on a roll.",
      "That's the spirit.",
    ],
  },
  proud: {
    mouthD: "M43 71 Q50 79 57 71",
    irisColor: "#34d399",
    cheekOpacity: 0.22,
    message: [
      "Look at you. Crushing it.",
      "Really proud of you today.",
      "Goal achieved. Well done.",
    ],
  },
  focused: {
    mouthD: "M46 73 Q50 74 54 73",
    irisColor: "#6982d8",
    cheekOpacity: 0,
    message: [
      "Dialed in. Keep it up.",
      "In the zone. Don't break it.",
      "Focus mode. Go.",
    ],
  },
  sleepy: {
    mouthD: "M45 73 Q50 74 55 73",
    irisColor: "#6982d8",
    cheekOpacity: 0,
    message: [
      "Slow start? That's okay.",
      "Even a small session counts.",
      "When you're ready, I'm here.",
    ],
  },
  worried: {
    mouthD: "M44 74 Q50 71 56 74",
    irisColor: "#f87171",
    cheekOpacity: 0,
    message: [
      "Distraction time is climbing. Just a heads-up.",
      "Still time to turn it around.",
      "One session can shift the whole day.",
    ],
  },
  sad: {
    mouthD: "M44 74 Q50 69 56 74",
    irisColor: "#94a3b8",
    cheekOpacity: 0,
    message: [
      "Tough day. It happens.",
      "Tomorrow is a clean slate.",
      "Rest counts too.",
    ],
  },
  hungry: {
    mouthD: "M44 72 Q50 76 56 72",
    irisColor: "#fbbf24",
    cheekOpacity: 0.1,
    message: [
      "You haven't fed me yet today!",
      "Hit your focus goal and I'll be happy.",
      "20 minutes of focus earns a feeding.",
    ],
  },
};

function pickMood(storage: AppStorage, productiveSecs: number, score: number): OllieMood {
  const { session, pet } = storage;
  const today = toDateString();

  if (session.focusModeActive) return "focused";
  if (session.pomodoroActive && !session.pomodoroIsBreak) return "focused";
  if (score >= 80) return "proud";
  if (score >= 50) return "happy";
  if (productiveSecs > 0 && score < 30) return "worried";
  if (pet.lastFedDate !== today && productiveSecs === 0) return "hungry";
  if (productiveSecs === 0) return "sleepy";
  return "happy";
}

function updateOllie(storage: AppStorage, productiveSecs: number, score: number) {
  const mood = pickMood(storage, productiveSecs, score);
  const cfg = OLLIE_MOODS[mood];

  const mouth  = document.getElementById("ollie-mouth");
  const pupilL = document.getElementById("pupil-l");
  const pupilR = document.getElementById("pupil-r");
  const cheekL = document.getElementById("cheek-l");
  const cheekR = document.getElementById("cheek-r");

  if (mouth)  mouth.setAttribute("d", cfg.mouthD);
  if (pupilL) pupilL.setAttribute("fill", cfg.irisColor);
  if (pupilR) pupilR.setAttribute("fill", cfg.irisColor);

  const cheekColor = `rgba(249,115,22,${cfg.cheekOpacity})`;
  if (cheekL) cheekL.setAttribute("fill", cheekColor);
  if (cheekR) cheekR.setAttribute("fill", cheekColor);

  const msgs = cfg.message;
  const msg = msgs[Math.floor(Date.now() / 30000) % msgs.length];
  showOllieMessage(msg);
}

function showOllieMessage(msg: string, durationMs?: number) {
  const el = document.getElementById("ollie-message");
  if (!el) return;
  el.textContent = msg;
  if (durationMs) {
    setTimeout(() => {
      if (storage) updateOllie(storage, 0, 0);
    }, durationMs);
  }
}

// ─── Suggestion card ─────────────────────────────────────────────────────────

function renderSuggestion(storage: AppStorage, productiveSecs: number, score: number) {
  const card = document.getElementById("suggestion-card");
  const icon = document.getElementById("suggestion-icon");
  const text = document.getElementById("suggestion-text");
  if (!card || !icon || !text) return;

  const { session, settings } = storage;
  const goalSecs = settings.dailyGoalMinutes * 60;
  const remaining = goalSecs - productiveSecs;

  let suggestion: { icon: string; msg: string } | null = null;

  if (session.focusModeActive && session.focusModeEndTime) {
    const mins = Math.ceil((session.focusModeEndTime - Date.now()) / 60000);
    suggestion = { icon: "🔒", msg: `Focus mode active. ${mins}m left. You've got this.` };
  } else if (remaining > 0 && remaining < goalSecs) {
    const m = Math.ceil(remaining / 60);
    suggestion = { icon: "⏳", msg: `${m} more minutes and you'll hit your goal.` };
  } else if (score >= 80) {
    suggestion = { icon: "🏆", msg: "Goal reached! You can still keep going." };
  } else if (productiveSecs === 0) {
    suggestion = { icon: "💡", msg: "Try a short 15-minute session to get started." };
  }

  if (suggestion) {
    card.hidden = false;
    icon.textContent = suggestion.icon;
    text.textContent = suggestion.msg;
  } else {
    card.hidden = true;
  }
}

// ─── Analytics ───────────────────────────────────────────────────────────────

async function renderAnalytics() {
  if (!storage) return;

  // Lazy load chart.js
  if (!ChartLib) {
    ChartLib = await import("chart.js/auto");
  }

  const { dailyData } = storage;
  const today = new Date();

  // Build 7-day dataset
  const days: string[] = [];
  const labels: string[] = [];
  const productiveData: number[] = [];
  const unproductiveData: number[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = toDateString(d);
    days.push(key);
    labels.push(d.toLocaleDateString("en-US", { weekday: "short" }));
    const rec = dailyData[key];
    productiveData.push(rec ? Math.round(rec.productiveSeconds / 60) : 0);
    unproductiveData.push(rec ? Math.round(rec.unproductiveSeconds / 60) : 0);
  }

  const hasData = productiveData.some((v) => v > 0);
  const emptyEl = document.getElementById("analytics-empty");
  const chartWrap = document.querySelector<HTMLElement>(".chart-wrap");
  if (emptyEl) emptyEl.hidden = hasData;
  if (chartWrap) chartWrap.style.display = hasData ? "block" : "none";

  // Date range label
  const rangeEl = document.getElementById("analytics-date-range");
  if (rangeEl && days.length > 0) {
    const from = new Date(days[0]!).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const to   = new Date(days[days.length - 1]!).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    rangeEl.textContent = `${from} – ${to}`;
  }

  // Insight
  const insightCard = document.getElementById("insight-card");
  const insightText = document.getElementById("insight-text");
  if (insightCard && insightText && hasData) {
    const weeklyFocusMins = productiveData.reduce((a, b) => a + b, 0);
    const bestDay = labels[productiveData.indexOf(Math.max(...productiveData))] ?? "";
    const avgMins = Math.round(weeklyFocusMins / 7);
    const insight = weeklyFocusMins === 0
      ? "No focus time recorded this week. A 15-minute session is enough to start."
      : `You averaged ${avgMins} minutes of focus per day. Your best day was ${bestDay}.`;
    insightText.textContent = insight;
    insightCard.hidden = false;
  } else if (insightCard) {
    insightCard.hidden = true;
  }

  // Chart
  if (hasData) {
    const canvas = document.getElementById("daily-chart") as HTMLCanvasElement | null;
    if (!canvas) return;

    if (dailyChart) {
      dailyChart.destroy();
      dailyChart = null;
    }

    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const { Chart } = ChartLib!;
    dailyChart = new Chart(canvas, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Productive",
            data: productiveData,
            backgroundColor: "rgba(105,130,216,0.7)",
            borderRadius: 4,
          },
          {
            label: "Distraction",
            data: unproductiveData,
            backgroundColor: "rgba(248,113,113,0.5)",
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y}m`,
            },
          },
        },
        scales: {
          x: {
            grid: { color: "rgba(255,255,255,0.05)" },
            ticks: { color: "rgba(255,255,255,0.4)", font: { size: 11 } },
          },
          y: {
            grid: { color: "rgba(255,255,255,0.05)" },
            ticks: { color: "rgba(255,255,255,0.4)", font: { size: 11 } },
          },
        },
      },
    });
  }

  // Calendar
  renderCalendar(dailyData);

  // Breakdown
  renderBreakdown(dailyData[toDateString()]);
}

function renderCalendar(dailyData: AppStorage["dailyData"]) {
  const cal = document.getElementById("score-calendar");
  if (!cal) return;
  cal.innerHTML = "";

  const today = new Date();
  const year  = today.getFullYear();
  const month = today.getMonth();
  const days  = new Date(year, month + 1, 0).getDate();

  for (let d = 1; d <= days; d++) {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const rec = dailyData[key];
    const score = rec?.score ?? 0;
    const el = document.createElement("div");
    el.className = "cal-day";
    el.title = rec ? `${key}: score ${score}` : key;
    if (score > 0) {
      const alpha = 0.2 + (score / 100) * 0.7;
      el.style.background = `rgba(105,130,216,${alpha})`;
      el.style.borderColor = "rgba(105,130,216,0.2)";
    }
    cal.appendChild(el);
  }
}

function renderBreakdown(record: AppStorage["dailyData"][string] | undefined) {
  const container = document.getElementById("site-breakdown");
  if (!container) return;
  container.innerHTML = "";

  if (!record || Object.keys(record.siteBreakdown).length === 0) {
    container.innerHTML = `<span style="font-size:0.8125rem;color:var(--ink-3)">No site data today yet.</span>`;
    return;
  }

  const sorted = Object.entries(record.siteBreakdown)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6);

  const max = sorted[0]?.[1] ?? 1;

  for (const [domain, secs] of sorted) {
    const pct = Math.round((secs / max) * 100);
    const row = document.createElement("div");
    row.className = "breakdown-row";
    row.innerHTML = `
      <span class="breakdown-domain" title="${domain}">${domain}</span>
      <div class="breakdown-bar-wrap"><div class="breakdown-bar" style="width:${pct}%"></div></div>
      <span class="breakdown-time">${formatDuration(secs)}</span>
    `;
    container.appendChild(row);
  }
}

// ─── Sites ────────────────────────────────────────────────────────────────────

function renderSites() {
  if (!storage) return;
  renderTagList("productive-tags", storage.settings.productiveSites, "productive");
  renderTagList("unproductive-tags", storage.settings.unproductiveSites, "unproductive");
  renderCurrentSiteCard();
}

function renderCurrentSiteCard() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab?.url) return;
    const domain = extractDomain(tab.url);
    if (!domain) return;

    const card = document.getElementById("current-site-card");
    const domEl = document.getElementById("current-site-domain");
    if (card) card.hidden = false;
    if (domEl) domEl.textContent = domain;
  });
}

function renderTagList(containerId: string, sites: string[], _type: string) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";

  for (const site of sites) {
    const tag = document.createElement("span");
    tag.className = "site-tag";
    const removeBtn = document.createElement("button");
    removeBtn.className = "site-tag-remove";
    removeBtn.textContent = "×";
    removeBtn.setAttribute("aria-label", `Remove ${site}`);
    removeBtn.addEventListener("click", () => void removeSite(site, _type as "productive" | "unproductive"));
    tag.textContent = site;
    tag.appendChild(removeBtn);
    container.appendChild(tag);
  }
}

function bindSites() {
  // Current site quick-add
  document.getElementById("btn-mark-productive")?.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const domain = extractDomain(tabs[0]?.url ?? "");
      if (!domain) return;
      await addSite(domain, "productive");
    });
  });

  document.getElementById("btn-mark-distracting")?.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const domain = extractDomain(tabs[0]?.url ?? "");
      if (!domain) return;
      await addSite(domain, "unproductive");
    });
  });

  // Add productive
  const prodInput = document.getElementById("add-productive-input") as HTMLInputElement;
  document.getElementById("add-productive-btn")?.addEventListener("click", async () => {
    const v = prodInput.value.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (!v) return;
    await addSite(v, "productive");
    prodInput.value = "";
  });

  prodInput?.addEventListener("keydown", async (e) => {
    if (e.key !== "Enter") return;
    const v = prodInput.value.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (!v) return;
    await addSite(v, "productive");
    prodInput.value = "";
  });

  // Add unproductive
  const unprodInput = document.getElementById("add-unproductive-input") as HTMLInputElement;
  document.getElementById("add-unproductive-btn")?.addEventListener("click", async () => {
    const v = unprodInput.value.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (!v) return;
    await addSite(v, "unproductive");
    unprodInput.value = "";
  });

  unprodInput?.addEventListener("keydown", async (e) => {
    if (e.key !== "Enter") return;
    const v = unprodInput.value.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (!v) return;
    await addSite(v, "unproductive");
    unprodInput.value = "";
  });
}

async function addSite(domain: string, type: "productive" | "unproductive") {
  if (!storage || !domain) return;
  const settings = { ...storage.settings };

  // Remove from both lists first
  settings.productiveSites = settings.productiveSites.filter((s) => s !== domain);
  settings.unproductiveSites = settings.unproductiveSites.filter((s) => s !== domain);

  if (type === "productive") settings.productiveSites.push(domain);
  else settings.unproductiveSites.push(domain);

  await chrome.runtime.sendMessage({ type: "SAVE_SETTINGS", settings });
  storage = { ...storage, settings };
  renderSites();
}

async function removeSite(domain: string, type: "productive" | "unproductive") {
  if (!storage) return;
  const settings = { ...storage.settings };
  if (type === "productive") settings.productiveSites = settings.productiveSites.filter((s) => s !== domain);
  else settings.unproductiveSites = settings.unproductiveSites.filter((s) => s !== domain);
  await chrome.runtime.sendMessage({ type: "SAVE_SETTINGS", settings });
  storage = { ...storage, settings };
  renderSites();
}

// ─── Goals ────────────────────────────────────────────────────────────────────

function renderGoals() {
  if (!storage) return;
  const { settings } = storage;

  (document.getElementById("input-daily-goal") as HTMLInputElement).value = String(settings.dailyGoalMinutes);
  (document.getElementById("input-distraction-cap") as HTMLInputElement).value = String(settings.unproductiveCapMinutes);
  (document.getElementById("input-countdown") as HTMLInputElement).value = String(settings.countdownSeconds);
  (document.getElementById("input-pomo-work") as HTMLInputElement).value = String(settings.pomodoroWorkMinutes);
  (document.getElementById("input-pomo-short") as HTMLInputElement).value = String(settings.pomodoroShortBreakMinutes);
  (document.getElementById("input-pomo-long") as HTMLInputElement).value = String(settings.pomodoroLongBreakMinutes);
  (document.getElementById("check-grace") as HTMLInputElement).checked = settings.gracePeriodEnabled;
  (document.getElementById("check-auto-focus") as HTMLInputElement).checked = settings.pomodoroAutoFocusMode;

  // Warning mode radio
  document.querySelectorAll<HTMLInputElement>('input[name="warn-mode"]').forEach((radio) => {
    radio.checked = radio.value === settings.warningMode;
  });

  // Preset highlight
  const daily = settings.dailyGoalMinutes;
  const cap   = settings.unproductiveCapMinutes;
  document.querySelectorAll<HTMLButtonElement>(".goal-preset").forEach((btn) => {
    const g = parseInt(btn.dataset.goal ?? "0");
    const c = parseInt(btn.dataset.cap ?? "0");
    btn.classList.toggle("goal-preset-active", g === daily && c === cap);
  });
}

function bindGoals() {
  // Preset cards
  document.querySelectorAll<HTMLButtonElement>(".goal-preset").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const g = parseInt(btn.dataset.goal ?? "120");
      const c = parseInt(btn.dataset.cap ?? "30");
      (document.getElementById("input-daily-goal") as HTMLInputElement).value = String(g);
      (document.getElementById("input-distraction-cap") as HTMLInputElement).value = String(c);
      await saveGoals();
    });
  });

  // Save button
  document.getElementById("btn-save-goals")?.addEventListener("click", () => void saveGoals());
}

async function saveGoals() {
  if (!storage) return;
  const dailyGoal   = parseInt((document.getElementById("input-daily-goal") as HTMLInputElement).value);
  const distractCap = parseInt((document.getElementById("input-distraction-cap") as HTMLInputElement).value);
  const countdown   = parseInt((document.getElementById("input-countdown") as HTMLInputElement).value);
  const pomoWork    = parseInt((document.getElementById("input-pomo-work") as HTMLInputElement).value);
  const pomoShort   = parseInt((document.getElementById("input-pomo-short") as HTMLInputElement).value);
  const pomoLong    = parseInt((document.getElementById("input-pomo-long") as HTMLInputElement).value);
  const grace       = (document.getElementById("check-grace") as HTMLInputElement).checked;
  const autoFocus   = (document.getElementById("check-auto-focus") as HTMLInputElement).checked;
  const warnRadio   = document.querySelector<HTMLInputElement>('input[name="warn-mode"]:checked');

  const settings: Settings = {
    ...storage.settings,
    dailyGoalMinutes: isNaN(dailyGoal) ? 120 : dailyGoal,
    unproductiveCapMinutes: isNaN(distractCap) ? 30 : distractCap,
    countdownSeconds: isNaN(countdown) ? 5 : countdown,
    pomodoroWorkMinutes: isNaN(pomoWork) ? 25 : pomoWork,
    pomodoroShortBreakMinutes: isNaN(pomoShort) ? 5 : pomoShort,
    pomodoroLongBreakMinutes: isNaN(pomoLong) ? 15 : pomoLong,
    gracePeriodEnabled: grace,
    pomodoroAutoFocusMode: autoFocus,
    warningMode: (warnRadio?.value as Settings["warningMode"]) ?? "countdown",
  };

  await chrome.runtime.sendMessage({ type: "SAVE_SETTINGS", settings });
  storage = { ...storage, settings };

  // Preset highlight update
  renderGoals();

  // Save status
  const statusEl = document.getElementById("goals-save-status");
  if (statusEl) {
    statusEl.textContent = "Saved";
    setTimeout(() => { if (statusEl) statusEl.textContent = ""; }, 2000);
  }
}

// ─── Notes ────────────────────────────────────────────────────────────────────

const NOTE_TEMPLATES: Record<string, string> = {
  plan: `Today's Plan\n━━━━━━━━━━\nMust do:\n- \n- \n\nWould like to:\n- \n\nNot today:\n- `,
  sprint: `Work Sprint\n━━━━━━━━━━\nGoal for this session:\n\nSteps:\n1. \n2. \n3. \n\nDone when:`,
  brain: `Brain Dump\n━━━━━━━━━━\n`,
  reflect: `Reflection\n━━━━━━━━━━\nWhat went well:\n\nWhat was hard:\n\nTomorrow I'll:\n`,
};

function bindNotes() {
  // Load notes
  chrome.storage.local.get("notes", (res) => {
    notes = (res["notes"] as string | undefined) ?? "";
    const ta = document.getElementById("notes-textarea") as HTMLTextAreaElement | null;
    if (ta) {
      ta.value = notes;
      updateCharCount(notes);
    }
  });

  // Autosave
  const ta = document.getElementById("notes-textarea") as HTMLTextAreaElement | null;
  ta?.addEventListener("input", () => {
    notes = ta.value;
    updateCharCount(notes);
    scheduleSaveNotes();
  });

  // Templates
  document.querySelectorAll<HTMLButtonElement>(".tpl-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tpl = NOTE_TEMPLATES[btn.dataset.tpl ?? ""] ?? "";
      if (ta) {
        if (ta.value && !confirm("Replace current notes with this template?")) return;
        ta.value = tpl;
        notes = tpl;
        updateCharCount(notes);
        scheduleSaveNotes();
        ta.focus();
        ta.setSelectionRange(tpl.length, tpl.length);
      }
    });
  });

  // Clear
  document.getElementById("btn-clear-notes")?.addEventListener("click", () => {
    if (!ta?.value) return;
    if (confirm("Clear all notes?")) {
      ta.value = "";
      notes = "";
      updateCharCount("");
      scheduleSaveNotes();
    }
  });
}

function updateCharCount(text: string) {
  const el = document.getElementById("notes-char-count");
  if (el) el.textContent = `${text.length} chars`;
}

function scheduleSaveNotes() {
  if (notesAutosaveTimer) clearTimeout(notesAutosaveTimer);
  const badge = document.getElementById("autosave-badge");
  if (badge) badge.classList.remove("visible");

  notesAutosaveTimer = setTimeout(() => {
    chrome.storage.local.set({ notes }, () => {
      if (badge) {
        badge.classList.add("visible");
        setTimeout(() => badge.classList.remove("visible"), 2000);
      }
    });
  }, 800);
}

// ─── Language ─────────────────────────────────────────────────────────────────

function renderLanguage() {
  if (!storage) return;
  const lang = storage.settings.languageGoal ?? "";

  document.querySelectorAll<HTMLButtonElement>(".lang-chip").forEach((btn) => {
    btn.classList.toggle("selected", btn.dataset.lang === lang);
  });

  const wrap = document.getElementById("lang-selected-wrap");
  const val  = document.getElementById("lang-selected-value");
  if (wrap) wrap.hidden = !lang;
  if (val) val.textContent = lang;
}

function bindLanguage() {
  document.querySelectorAll<HTMLButtonElement>(".lang-chip").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!storage) return;
      const lang = btn.dataset.lang ?? "";
      const settings: Settings = { ...storage.settings, languageGoal: lang };
      await chrome.runtime.sendMessage({ type: "SAVE_SETTINGS", settings });
      storage = { ...storage, settings };
      renderLanguage();
    });
  });

  document.getElementById("lang-change-btn")?.addEventListener("click", async () => {
    if (!storage) return;
    const settings: Settings = { ...storage.settings, languageGoal: "" };
    await chrome.runtime.sendMessage({ type: "SAVE_SETTINGS", settings });
    storage = { ...storage, settings };
    renderLanguage();
  });
}

// ─── Profile ─────────────────────────────────────────────────────────────────

function renderProfile() {
  if (!storage) return;
  const { settings, streak, dailyData, xp, level } = storage;

  (document.getElementById("profile-name") as HTMLElement).textContent = settings.userName || "You";
  (document.getElementById("profile-level") as HTMLElement).textContent = `Level ${level}`;
  (document.getElementById("profile-name-input") as HTMLInputElement).value = settings.userName;

  // XP bar
  const xpForNext = level * 100;
  const pct = Math.min(100, Math.round((xp / xpForNext) * 100));
  const xpBar = document.getElementById("xp-bar") as HTMLElement;
  if (xpBar) xpBar.style.width = `${pct}%`;
  const xpLabel = document.getElementById("xp-label");
  if (xpLabel) xpLabel.textContent = `${xp} / ${xpForNext} XP`;

  // Stats
  const totalSessions = Object.values(dailyData).reduce(
    (acc, r) => acc + (r.pomodoroSessionsCompleted ?? 0), 0
  );
  const totalFocusSecs = Object.values(dailyData).reduce(
    (acc, r) => acc + (r.productiveSeconds ?? 0), 0
  );
  const hours = (totalFocusSecs / 3600).toFixed(1);

  const statStreak   = document.getElementById("pstat-streak");
  const statSessions = document.getElementById("pstat-sessions");
  const statHours    = document.getElementById("pstat-hours");

  if (statStreak)   statStreak.textContent   = String(streak.current);
  if (statSessions) statSessions.textContent = String(totalSessions);
  if (statHours)    statHours.textContent    = `${hours}h`;
}

function bindProfile() {
  document.getElementById("btn-save-name")?.addEventListener("click", async () => {
    if (!storage) return;
    const input = document.getElementById("profile-name-input") as HTMLInputElement;
    const name = input.value.trim();
    const settings: Settings = { ...storage.settings, userName: name };
    await chrome.runtime.sendMessage({ type: "SAVE_SETTINGS", settings });
    storage = { ...storage, settings };
    renderProfile();
    renderHome();
  });

  document.getElementById("btn-reset-data")?.addEventListener("click", async () => {
    if (!confirm("Reset ALL MindPortal data? This cannot be undone.")) return;
    await chrome.storage.local.clear();
    window.location.reload();
  });
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function sendMsg(msg: Record<string, unknown>): Promise<unknown> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, resolve);
  });
}
