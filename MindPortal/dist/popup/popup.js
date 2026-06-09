import "../chunks/modulepreload-polyfill-DaKOjhqt.js";
import { b as computeScore, s as scoreColor, f as formatDuration, g as formatCountdown } from "../chunks/utils-DXHU2JcO.js";
const QUOTES = [
  { text: "Discipline is choosing between what you want now and what you want most.", author: "Abraham Lincoln" },
  { text: "We are what we repeatedly do. Excellence, then, is not an act but a habit.", author: "Aristotle" },
  { text: "The successful warrior is the average person with laser-like focus.", author: "Bruce Lee" },
  { text: "Motivation is what gets you started. Habit is what keeps you going.", author: "Jim Ryun" },
  { text: "You don't rise to the level of your goals, you fall to the level of your systems.", author: "James Clear" },
  { text: "It's not that I'm so smart, it's just that I stay with problems longer.", author: "Albert Einstein" },
  { text: "The man who moves a mountain begins by carrying away small stones.", author: "Confucius" },
  { text: "Small daily improvements over time lead to stunning results.", author: "Robin Sharma" },
  { text: "The secret of your future is hidden in your daily routine.", author: "Mike Murdock" },
  { text: "First, forget inspiration. Habit is more dependable.", author: "Octavia Butler" },
  { text: "Waste no more time arguing what a good person should be. Be one.", author: "Marcus Aurelius" },
  { text: "Confine yourself to the present.", author: "Marcus Aurelius" },
  { text: "You have power over your mind, not outside events. Realize this and you will find strength.", author: "Marcus Aurelius" },
  { text: "The impediment to action advances action. What stands in the way becomes the way.", author: "Marcus Aurelius" },
  { text: "Luck is what happens when preparation meets opportunity.", author: "Seneca" },
  { text: "It is not that we have little time, but that we waste a good deal of it.", author: "Seneca" },
  { text: "Difficulties strengthen the mind as labor does the body.", author: "Seneca" },
  { text: "No man is free who is not master of himself.", author: "Epictetus" },
  { text: "Make the best use of what is in your power, and take the rest as it happens.", author: "Epictetus" },
  { text: "He who is not a good servant will not be a good master.", author: "Plato" },
  { text: "The future depends on what you do today.", author: "Mahatma Gandhi" },
  { text: "Focus on being productive instead of busy.", author: "Tim Ferriss" },
  { text: "Starve your distractions, feed your focus.", author: "Anonymous" },
  { text: "A year from now you may wish you had started today.", author: "Karen Lamb" },
  { text: "The pain of discipline is far less than the pain of regret.", author: "Sarah Bombell" },
  { text: "Action is the foundational key to all success.", author: "Pablo Picasso" },
  { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  { text: "Perseverance is not a long race; it is many short races one after the other.", author: "Walter Elliot" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "You miss 100% of the shots you don't take.", author: "Wayne Gretzky" },
  { text: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier" },
  { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { text: "Do one thing every day that scares you.", author: "Eleanor Roosevelt" },
  { text: "Everything you want is on the other side of fear.", author: "Jack Canfield" },
  { text: "The harder you work for something, the greater you'll feel when you achieve it.", author: "Anonymous" },
  { text: "Don't limit your challenges. Challenge your limits.", author: "Anonymous" },
  { text: "Push yourself, because no one else is going to do it for you.", author: "Anonymous" },
  { text: "Great things never come from comfort zones.", author: "Anonymous" },
  { text: "Dream it. Wish it. Do it.", author: "Anonymous" },
  { text: "Success doesn't just find you. You have to go out and get it.", author: "Anonymous" },
  { text: "The key to success is to focus on goals, not obstacles.", author: "Anonymous" },
  { text: "Dream bigger. Do bigger.", author: "Anonymous" },
  { text: "Don't stop when you're tired. Stop when you're done.", author: "Anonymous" },
  { text: "Wake up with determination. Go to bed with satisfaction.", author: "Anonymous" },
  { text: "Do something today that your future self will thank you for.", author: "Sean Patrick Flanery" },
  { text: "Little things make big days.", author: "Anonymous" },
  { text: "It's going to be hard, but hard does not mean impossible.", author: "Anonymous" },
  { text: "Don't wait for opportunity. Create it.", author: "Anonymous" },
  { text: "Sometimes later becomes never. Do it now.", author: "Anonymous" },
  { text: "Hard work beats talent when talent doesn't work hard.", author: "Tim Notke" }
];
function getRandomQuote() {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)];
}
let storage = null;
let timerInterval = null;
let focusInterval = null;
async function init() {
  storage = await chrome.runtime.sendMessage({ type: "GET_STORAGE" });
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
  const hour = (/* @__PURE__ */ new Date()).getHours();
  const period = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const name = settings.userName ? `, ${settings.userName}` : "";
  if (greetingEl) greetingEl.textContent = `Good ${period}${name}`;
  const dateEl = document.getElementById("today-date");
  if (dateEl) {
    dateEl.textContent = (/* @__PURE__ */ new Date()).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric"
    });
  }
}
function renderScore() {
  if (!storage) return;
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const record = storage.dailyData[today];
  const numEl = document.getElementById("score-num");
  const ringEl = document.getElementById("ring-fill");
  const sessionsEl = document.getElementById("sessions-label");
  if (!record) {
    if (numEl) numEl.textContent = "0";
    if (ringEl) {
      ringEl.style.strokeDashoffset = "213.6";
      ringEl.style.stroke = "#6c63ff";
    }
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
    const offset = circumference - score / 100 * circumference;
    ringEl.style.strokeDashoffset = String(offset);
    ringEl.style.stroke = scoreColor(score);
  }
  if (sessionsEl && record.pomodoroSessionsCompleted > 0) {
    sessionsEl.textContent = `🍅 ${record.pomodoroSessionsCompleted} session${record.pomodoroSessionsCompleted !== 1 ? "s" : ""} completed`;
  }
}
function renderTimeBars() {
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
      const remaining = Math.max(0, Math.ceil((session.pomodoroEndTime - Date.now()) / 1e3));
      if (displayEl) displayEl.textContent = formatCountdown(remaining);
    };
    updateDisplay();
    timerInterval = setInterval(updateDisplay, 500);
    if (sessionInfoEl) {
      const sessionNum = session.pomodoroSessionCount % 4 + (session.pomodoroIsBreak ? 0 : 1);
      const type = session.pomodoroIsBreak ? session.pomodoroSessionCount % 4 === 0 ? "Long Break" : "Short Break" : "Work";
      sessionInfoEl.textContent = `Session ${sessionNum}/4 · ${type}`;
    }
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
      const remaining = Math.max(0, Math.ceil((session.focusModeEndTime - Date.now()) / 1e3));
      if (remainingEl) remainingEl.textContent = `${formatCountdown(remaining)} remaining`;
    };
    updateFocus();
    focusInterval = setInterval(updateFocus, 1e3);
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
  const select = document.getElementById("focus-duration");
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
function startPolling() {
  setInterval(async () => {
    await refresh();
  }, 5e3);
}
async function refresh() {
  storage = await chrome.runtime.sendMessage({ type: "GET_STORAGE" });
  renderAll();
}
init();
