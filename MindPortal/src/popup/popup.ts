import type { AppStorage, PopupSize } from "../shared/types";
import { formatDuration, formatCountdown, scoreColor, computeScore } from "../shared/utils";
import { DEFAULT_SETTINGS } from "../shared/defaults";

let storage: AppStorage | null = null;
let timerInterval: ReturnType<typeof setInterval> | null = null;
let focusInterval: ReturnType<typeof setInterval> | null = null;
let selectedGoal = 120;

// ── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  storage = (await chrome.runtime.sendMessage({ type: "GET_STORAGE" })) as AppStorage;

  // Apply saved size
  applySize(storage.settings.popupSize ?? "normal");

  // Set today's date in score section
  const dateEl = document.getElementById("score-date");
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric",
    });
  }

  if (!storage.settings.onboardingComplete) {
    showOnboarding();
  } else {
    showMain();
    startPolling();
  }
}

// ── Size mode ─────────────────────────────────────────────────────────────────

function applySize(size: PopupSize) {
  document.body.classList.remove("size-mini", "size-normal", "size-large");
  document.body.classList.add(`size-${size}`);
  document.querySelectorAll<HTMLButtonElement>(".sz-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.size === size);
  });
}

async function saveSize(size: PopupSize) {
  const raw = await chrome.storage.local.get("settings");
  const settings = { ...DEFAULT_SETTINGS, ...(raw["settings"] ?? {}) };
  settings.popupSize = size;
  await chrome.storage.local.set({ settings });
}

document.querySelectorAll<HTMLButtonElement>(".sz-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const size = btn.dataset.size as PopupSize;
    applySize(size);
    saveSize(size);
  });
});

// ── Onboarding ────────────────────────────────────────────────────────────────

function showOnboarding() {
  document.getElementById("onboarding")!.classList.remove("hidden");
  document.getElementById("main")!.classList.add("hidden");

  // Render Ollie in onboarding welcome screen
  const wrap = document.getElementById("ob-ollie-wrap");
  if (wrap) wrap.innerHTML = cloneOllieSVG(60);
  const wrap1 = document.getElementById("ob-ollie-wrap-1");
  if (wrap1) wrap1.innerHTML = cloneOllieSVG(52);
  applyOllieMood(wrap?.querySelector("svg") ?? null, "happy");
  applyOllieMood(wrap1?.querySelector("svg") ?? null, "hungry");

  // Step navigation
  document.getElementById("ob-next-0")?.addEventListener("click", () => goStep(1));

  document.getElementById("ob-next-1")?.addEventListener("click", () => {
    const name = (document.getElementById("ob-name") as HTMLInputElement)?.value.trim();
    if (!name) { document.getElementById("ob-name")?.focus(); return; }
    goStep(2);
  });

  document.getElementById("ob-name")?.addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key === "Enter") document.getElementById("ob-next-1")?.click();
  });

  document.querySelectorAll<HTMLButtonElement>(".goal-opt").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".goal-opt").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      selectedGoal = Number(btn.dataset.val);
    });
  });

  document.getElementById("ob-finish")?.addEventListener("click", finishOnboarding);
}

function goStep(step: number) {
  document.querySelectorAll(".ob-step").forEach(el => el.classList.add("hidden"));
  document.getElementById(`ob-${step}`)?.classList.remove("hidden");
}

async function finishOnboarding() {
  const nameInput = document.getElementById("ob-name") as HTMLInputElement;
  const name = nameInput?.value.trim() || "there";

  const raw = await chrome.storage.local.get("settings");
  const settings = { ...DEFAULT_SETTINGS, ...(raw["settings"] ?? {}) };
  settings.userName = name;
  settings.dailyGoalMinutes = selectedGoal;
  settings.onboardingComplete = true;
  await chrome.storage.local.set({ settings });

  storage = (await chrome.runtime.sendMessage({ type: "GET_STORAGE" })) as AppStorage;
  document.getElementById("onboarding")!.classList.add("hidden");
  showMain();
  startPolling();
}

// ── Main view ─────────────────────────────────────────────────────────────────

function showMain() {
  document.getElementById("main")!.classList.remove("hidden");
  document.getElementById("onboarding")!.classList.add("hidden");

  renderAll();
  bindMainEvents();
}

function renderAll() {
  if (!storage) return;
  renderPet();
  renderScore();
  renderProgress();
  renderPomodoro();
  renderFocusMode();
}

// ── Pet / Ollie ───────────────────────────────────────────────────────────────

function cloneOllieSVG(size: number): string {
  const svg = document.getElementById("ollie-svg");
  if (!svg) return "";
  const clone = svg.cloneNode(true) as SVGElement;
  clone.setAttribute("width", String(size));
  clone.setAttribute("height", String(Math.round(size * 78 / 64)));
  clone.removeAttribute("id");
  return clone.outerHTML;
}

function getOllieMood(pet: AppStorage["pet"]): "happy" | "hungry" | "sad" {
  if (!pet.lastFedDate) return "hungry";
  const today = new Date().toISOString().slice(0, 10);
  if (pet.lastFedDate === today) return "happy";
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (pet.lastFedDate === yesterday) return "hungry";
  return "sad";
}

function getPetLevel(streak: number): number {
  if (streak >= 60) return 5;
  if (streak >= 30) return 4;
  if (streak >= 14) return 3;
  if (streak >= 7)  return 2;
  return 1;
}

function applyOllieMood(svg: SVGElement | null, mood: "happy" | "hungry" | "sad") {
  if (!svg) return;
  const irisL  = svg.querySelector("#ollie-iris-l, [id='ollie-iris-l']") as SVGCircleElement | null;
  const irisR  = svg.querySelector("#ollie-iris-r, [id='ollie-iris-r']") as SVGCircleElement | null;
  const cheekL = svg.querySelector("#ollie-cheek-l, [id='ollie-cheek-l']") as SVGCircleElement | null;
  const cheekR = svg.querySelector("#ollie-cheek-r, [id='ollie-cheek-r']") as SVGCircleElement | null;
  const tear   = svg.querySelector("#ollie-tear, [id='ollie-tear']")   as SVGEllipseElement | null;
  const pupilL = svg.querySelector("#ollie-pupil-l, [id='ollie-pupil-l']") as SVGCircleElement | null;
  const pupilR = svg.querySelector("#ollie-pupil-r, [id='ollie-pupil-r']") as SVGCircleElement | null;

  if (mood === "happy") {
    irisL?.setAttribute("r", "7"); irisR?.setAttribute("r", "7");
    irisL?.setAttribute("cy", "30"); irisR?.setAttribute("cy", "30");
    pupilL?.setAttribute("r", "4"); pupilR?.setAttribute("r", "4");
    cheekL?.setAttribute("opacity", "0.22"); cheekR?.setAttribute("opacity", "0.22");
    tear?.setAttribute("opacity", "0");
    irisL?.setAttribute("fill", "rgb(100,130,210)"); irisR?.setAttribute("fill", "rgb(100,130,210)");
  } else if (mood === "hungry") {
    irisL?.setAttribute("r", "6"); irisR?.setAttribute("r", "6");
    irisL?.setAttribute("cy", "30"); irisR?.setAttribute("cy", "30");
    pupilL?.setAttribute("r", "3.5"); pupilR?.setAttribute("r", "3.5");
    cheekL?.setAttribute("opacity", "0"); cheekR?.setAttribute("opacity", "0");
    tear?.setAttribute("opacity", "0");
    irisL?.setAttribute("fill", "rgb(100,130,210)"); irisR?.setAttribute("fill", "rgb(100,130,210)");
  } else {
    // sad: small irises shifted down, tear visible
    irisL?.setAttribute("r", "5"); irisR?.setAttribute("r", "5");
    irisL?.setAttribute("cy", "32"); irisR?.setAttribute("cy", "32");
    pupilL?.setAttribute("r", "3"); pupilR?.setAttribute("r", "3");
    pupilL?.setAttribute("cy", "32"); pupilR?.setAttribute("cy", "32");
    cheekL?.setAttribute("opacity", "0"); cheekR?.setAttribute("opacity", "0");
    tear?.setAttribute("opacity", "0.6");
    irisL?.setAttribute("fill", "rgba(100,130,210,0.5)"); irisR?.setAttribute("fill", "rgba(100,130,210,0.5)");
  }
}

function renderPet() {
  if (!storage) return;
  const { pet, streak, settings } = storage;
  const today = new Date().toISOString().slice(0, 10);
  const mood = getOllieMood(pet);
  const level = getPetLevel(streak.current);

  // Apply mood to Ollie SVG
  const wrap = document.getElementById("ollie-wrap");
  if (wrap) {
    wrap.className = `ollie-${mood}`;
    const svg = document.getElementById("ollie-svg") as SVGElement | null;
    applyOllieMood(svg, mood);
  }

  // Greeting
  const greetEl = document.getElementById("pet-greeting");
  const hour = new Date().getHours();
  const period = hour < 12 ? "Morning" : hour < 17 ? "Hey" : "Evening";
  const name = settings.userName || "";
  if (greetEl) greetEl.textContent = name ? `${period}, ${name}!` : `${period}!`;

  // Mood text
  const moodEl = document.getElementById("pet-mood-text");
  const moodTexts: Record<string, string> = {
    happy: "Ollie is happy — well fed!",
    hungry: "Ollie needs feeding today",
    sad: "Ollie is sad — missed a day",
  };
  if (moodEl) moodEl.textContent = moodTexts[mood];

  // Detail
  const detailEl = document.getElementById("pet-mood-detail");
  if (detailEl) {
    if (mood === "hungry") {
      const prodSec = storage.dailyData[today]?.productiveSeconds ?? 0;
      const needed = Math.max(0, 20 - Math.floor(prodSec / 60));
      detailEl.textContent = needed > 0 ? `${needed}m more productive time to unlock feed` : "Ready to be fed!";
    } else if (mood === "happy") {
      detailEl.textContent = `Level ${level} companion · ${pet.totalFeedCount} total feeds`;
    } else {
      detailEl.textContent = `Hit today's goal to start the streak again`;
    }
  }

  // Streak chip
  const numEl = document.getElementById("streak-num");
  if (numEl) numEl.textContent = String(streak.current);

  // Feed button state
  const feedBtn = document.getElementById("feed-btn") as HTMLButtonElement | null;
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

// ── Score ─────────────────────────────────────────────────────────────────────

function renderScore() {
  if (!storage) return;
  const today = new Date().toISOString().slice(0, 10);
  const record = storage.dailyData[today];
  const { settings } = storage;

  const score = record
    ? computeScore(record.productiveSeconds, record.unproductiveSeconds, settings.dailyGoalMinutes, settings.unproductiveCapMinutes)
    : 0;

  const numEl  = document.getElementById("score-num");
  const arcEl  = document.getElementById("score-arc") as SVGCircleElement | null;
  const gradeEl = document.getElementById("score-grade");
  const subEl  = document.getElementById("score-sub");

  if (numEl)  { numEl.textContent = String(score); numEl.style.color = score > 0 ? scoreColor(score) : "rgba(255,255,255,0.3)"; }

  // Arc: circumference for r=28 is 2π*28 ≈ 175.9
  if (arcEl) {
    const circ = 175.9;
    arcEl.style.strokeDashoffset = String(circ - (score / 100) * circ);
    arcEl.style.stroke = scoreColor(score);
  }

  const grade = score >= 90 ? "Excellent" : score >= 70 ? "Good" : score >= 50 ? "Fair" : score > 0 ? "Keep going" : "Not started";
  if (gradeEl) gradeEl.textContent = grade;

  const prodMin = record ? Math.floor(record.productiveSeconds / 60) : 0;
  if (subEl) subEl.textContent = prodMin > 0 ? `${prodMin}m productive today` : "Start a productive session";
}

// ── Progress bars ─────────────────────────────────────────────────────────────

function renderProgress() {
  if (!storage) return;
  const today = new Date().toISOString().slice(0, 10);
  const record = storage.dailyData[today];
  const { settings } = storage;

  const prodSec   = record?.productiveSeconds ?? 0;
  const unprodSec = record?.unproductiveSeconds ?? 0;
  const goalSec   = settings.dailyGoalMinutes * 60;
  const capSec    = settings.unproductiveCapMinutes * 60;

  const prodPct   = Math.min((prodSec / goalSec) * 100, 100);
  const unprodPct = Math.min((unprodSec / capSec) * 100, 100);

  const prodBar   = document.getElementById("prod-bar") as HTMLElement | null;
  const unprodBar = document.getElementById("unprod-bar") as HTMLElement | null;

  if (prodBar)   prodBar.style.width   = `${prodPct}%`;
  if (unprodBar) {
    unprodBar.style.width = `${unprodPct}%`;
    unprodBar.className = `prog-fill ${unprodPct >= 100 ? "over" : "dim"}`;
  }

  const prodValEl   = document.getElementById("prod-val");
  const unprodValEl = document.getElementById("unprod-val");
  if (prodValEl)   prodValEl.textContent   = `${formatDuration(prodSec)} / ${formatDuration(goalSec)}`;
  if (unprodValEl) unprodValEl.textContent = `${formatDuration(unprodSec)} / ${formatDuration(capSec)}`;

  // Top sites (large mode)
  const topEl = document.getElementById("top-sites");
  if (topEl && record) {
    const sorted = Object.entries(record.siteBreakdown)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    topEl.innerHTML = sorted.length
      ? sorted.map(([domain, secs]) =>
          `<div class="top-site-row"><span class="top-site-name">${domain}</span><span class="top-site-time">${formatDuration(secs)}</span></div>`
        ).join("")
      : "";
  }
}

// ── Pomodoro ──────────────────────────────────────────────────────────────────

function renderPomodoro() {
  if (!storage) return;
  const { session, settings } = storage;

  const timeEl     = document.getElementById("timer-time");
  const modeEl     = document.getElementById("timer-mode-text");
  const sessionEl  = document.getElementById("session-count");
  const startBtn   = document.getElementById("pom-start");
  const pauseBtn   = document.getElementById("pom-pause");
  const resumeBtn  = document.getElementById("pom-resume");
  const skipBtn    = document.getElementById("pom-skip");
  const stopBtn    = document.getElementById("pom-stop");

  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }

  if (session.pomodoroActive && session.pomodoroEndTime) {
    startBtn?.classList.add("hidden");
    pauseBtn?.classList.remove("hidden");
    resumeBtn?.classList.add("hidden");
    skipBtn?.classList.remove("hidden");
    stopBtn?.classList.remove("hidden");

    const sessionNum = (session.pomodoroSessionCount % 4) + (session.pomodoroIsBreak ? 0 : 1);
    const type = session.pomodoroIsBreak
      ? (session.pomodoroSessionCount % 4 === 0 ? "Long Break" : "Short Break")
      : "Work";
    if (sessionEl) sessionEl.textContent = `Session ${sessionNum}/4`;
    if (modeEl)  { modeEl.textContent = type; modeEl.classList.remove("hidden"); }

    const updateTimer = () => {
      const remaining = Math.max(0, Math.ceil((session.pomodoroEndTime! - Date.now()) / 1000));
      if (timeEl) timeEl.textContent = formatCountdown(remaining);
    };
    updateTimer();
    timerInterval = setInterval(updateTimer, 500);

  } else if (session.pomodoroActive === false && session.pomodoroEndTime === null && session.pomodoroSessionCount > 0) {
    // paused state (we paused but didn't stop)
    startBtn?.classList.add("hidden");
    pauseBtn?.classList.add("hidden");
    resumeBtn?.classList.remove("hidden");
    skipBtn?.classList.remove("hidden");
    stopBtn?.classList.remove("hidden");
    if (timeEl) timeEl.textContent = formatCountdown(settings.pomodoroWorkMinutes * 60);
    if (modeEl) modeEl.classList.add("hidden");
    if (sessionEl) sessionEl.textContent = "Paused";
  } else {
    // idle
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

// ── Focus mode ────────────────────────────────────────────────────────────────

function renderFocusMode() {
  if (!storage) return;
  const { session } = storage;

  const idleEl   = document.getElementById("focus-idle");
  const activeEl = document.getElementById("focus-active");
  const activateBtn = document.getElementById("btn-focus-activate");
  const cancelBtn   = document.getElementById("btn-focus-cancel");
  const durationSel = document.getElementById("focus-duration");
  const remainEl   = document.getElementById("focus-remaining");

  if (focusInterval) { clearInterval(focusInterval); focusInterval = null; }

  if (session.focusModeActive && session.focusModeEndTime) {
    idleEl?.classList.add("hidden");
    activeEl?.classList.remove("hidden");
    activateBtn?.classList.add("hidden");
    durationSel?.classList.add("hidden");
    cancelBtn?.classList.remove("hidden");

    const updateRemaining = () => {
      const secs = Math.max(0, Math.ceil((session.focusModeEndTime! - Date.now()) / 1000));
      if (remainEl) remainEl.textContent = `${formatCountdown(secs)} remaining`;
    };
    updateRemaining();
    focusInterval = setInterval(updateRemaining, 1000);
  } else {
    idleEl?.classList.remove("hidden");
    activeEl?.classList.add("hidden");
    activateBtn?.classList.remove("hidden");
    durationSel?.classList.remove("hidden");
    cancelBtn?.classList.add("hidden");
  }
}

// ── Event bindings ────────────────────────────────────────────────────────────

function bindMainEvents() {
  // Feed Ollie
  document.getElementById("feed-btn")?.addEventListener("click", async () => {
    const result = await chrome.runtime.sendMessage({ type: "FEED_PET" }) as { ok: boolean; reason?: string; needed?: number };
    if (result.ok) {
      const wrap = document.getElementById("ollie-wrap");
      if (wrap) {
        wrap.className = "ollie-fed";
        setTimeout(() => { wrap.className = "ollie-happy"; }, 700);
      }
      const feedBtn = document.getElementById("feed-btn") as HTMLButtonElement | null;
      if (feedBtn) { feedBtn.textContent = "Fed!"; feedBtn.classList.add("fed"); feedBtn.disabled = true; }
      storage = (await chrome.runtime.sendMessage({ type: "GET_STORAGE" })) as AppStorage;
      renderPet();
    } else if (result.reason === "not_enough_work") {
      const detail = document.getElementById("pet-mood-detail");
      if (detail) detail.textContent = `Need ${result.needed ?? "some"} more minutes of focus first`;
    }
  });

  // Pomodoro
  document.getElementById("pom-start")?.addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ type: "START_POMODORO" });
    storage = (await chrome.runtime.sendMessage({ type: "GET_STORAGE" })) as AppStorage;
    renderPomodoro();
  });
  document.getElementById("pom-pause")?.addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ type: "PAUSE_POMODORO" });
    storage = (await chrome.runtime.sendMessage({ type: "GET_STORAGE" })) as AppStorage;
    renderPomodoro();
  });
  document.getElementById("pom-resume")?.addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ type: "START_POMODORO" });
    storage = (await chrome.runtime.sendMessage({ type: "GET_STORAGE" })) as AppStorage;
    renderPomodoro();
  });
  document.getElementById("pom-skip")?.addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ type: "SKIP_POMODORO" });
    storage = (await chrome.runtime.sendMessage({ type: "GET_STORAGE" })) as AppStorage;
    renderPomodoro();
  });
  document.getElementById("pom-stop")?.addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ type: "STOP_POMODORO" });
    storage = (await chrome.runtime.sendMessage({ type: "GET_STORAGE" })) as AppStorage;
    renderPomodoro();
  });

  // Focus mode
  document.getElementById("btn-focus-activate")?.addEventListener("click", async () => {
    const sel = document.getElementById("focus-duration") as HTMLSelectElement | null;
    const minutes = Number(sel?.value ?? 30);
    await chrome.runtime.sendMessage({ type: "ACTIVATE_FOCUS_MODE", minutes });
    storage = (await chrome.runtime.sendMessage({ type: "GET_STORAGE" })) as AppStorage;
    renderFocusMode();
  });
  document.getElementById("btn-focus-cancel")?.addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ type: "DEACTIVATE_FOCUS_MODE" });
    storage = (await chrome.runtime.sendMessage({ type: "GET_STORAGE" })) as AppStorage;
    renderFocusMode();
  });

  // Footer
  document.getElementById("btn-settings")?.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });
  document.getElementById("btn-analytics")?.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("src/options/index.html") + "?tab=analytics" });
  });
}

// ── Polling ───────────────────────────────────────────────────────────────────

function startPolling() {
  setInterval(async () => {
    storage = (await chrome.runtime.sendMessage({ type: "GET_STORAGE" })) as AppStorage;
    renderAll();
  }, 5000);
}

// ── Run ───────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", init);
