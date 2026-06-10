import {
  getStorage,
  saveSession,
  saveStreak,
  saveDayRecord,
  getTodayRecord,
  savePetState,
} from "../shared/storage";
import {
  toDateString,
  extractDomain,
  categorizeDomain,
  computeScore,
  areConsecutiveDays,
} from "../shared/utils";
import type { ActiveSession, DayRecord, StreakData } from "../shared/types";

// Alarm names
const ALARM_TICK = "mp_tick";
const ALARM_MIDNIGHT = "mp_midnight";
const ALARM_BREAK_REMINDER = "mp_break_reminder";
const ALARM_POMODORO = "mp_pomodoro";
const ALARM_FOCUS_MODE = "mp_focus_mode";

// ─── Install / Startup ────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async (_details) => {
  await setupAlarms();
});

chrome.runtime.onStartup.addListener(async () => {
  await setupAlarms();
  await checkMidnightReset();
});

async function setupAlarms() {
  await chrome.alarms.clearAll();

  // Tick every 10 seconds to flush accumulated time
  chrome.alarms.create(ALARM_TICK, { periodInMinutes: 10 / 60 });

  // Midnight reset — fires at next midnight
  scheduleMidnightAlarm();
}

function scheduleMidnightAlarm() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 5, 0); // 00:00:05 next day
  chrome.alarms.create(ALARM_MIDNIGHT, { when: midnight.getTime() });
}

// ─── Tab Tracking ─────────────────────────────────────────────────────────────

let trackingDomain: string | null = null;
let trackingStart: number | null = null;

async function getCurrentActiveDomain(): Promise<string | null> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.url) return null;
    const url = tab.url;
    if (url.startsWith("chrome://") || url.startsWith("chrome-extension://") || url.startsWith("about:")) {
      return null;
    }
    return extractDomain(url);
  } catch {
    return null;
  }
}

async function flushCurrentDomain(now: number) {
  if (!trackingDomain || !trackingStart) return;
  const elapsed = Math.floor((now - trackingStart) / 1000);
  if (elapsed <= 0) return;

  const { settings, session, dailyData } = await getStorage();

  // Check if focus mode has expired
  if (session.focusModeActive && session.focusModeEndTime && now > session.focusModeEndTime) {
    await deactivateFocusMode();
  }

  const today = toDateString();
  const record: DayRecord = dailyData[today] ?? {
    date: today,
    productiveSeconds: 0,
    unproductiveSeconds: 0,
    neutralSeconds: 0,
    siteBreakdown: {},
    pomodoroSessionsCompleted: 0,
    goalMet: false,
    score: 0,
  };

  const category = categorizeDomain(trackingDomain, settings);
  if (category === "productive") {
    record.productiveSeconds += elapsed;
  } else if (category === "unproductive") {
    record.unproductiveSeconds += elapsed;
  } else {
    record.neutralSeconds += elapsed;
  }

  // Update site breakdown
  record.siteBreakdown[trackingDomain] = (record.siteBreakdown[trackingDomain] ?? 0) + elapsed;

  // Recompute score and goal
  record.score = computeScore(
    record.productiveSeconds,
    record.unproductiveSeconds,
    settings.dailyGoalMinutes,
    settings.unproductiveCapMinutes
  );
  record.goalMet =
    record.productiveSeconds >= settings.dailyGoalMinutes * 60 &&
    record.unproductiveSeconds <= settings.unproductiveCapMinutes * 60;

  await saveDayRecord(record);
  await updateBadge(record.score);
  await checkBreakReminder(now, settings.breakReminderMinutes, category);
}

async function updateBadge(score: number) {
  const { session } = await getStorage();
  if (session.pomodoroActive && session.pomodoroEndTime) {
    const remaining = Math.max(0, Math.ceil((session.pomodoroEndTime - Date.now()) / 1000));
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    const label = m > 0 ? `${m}m` : `${s}s`;
    await chrome.action.setBadgeText({ text: label });
    await chrome.action.setBadgeBackgroundColor({ color: session.pomodoroIsBreak ? "#4ade80" : "#6c63ff" });
  } else if (session.focusModeActive) {
    await chrome.action.setBadgeText({ text: "🔒" });
    await chrome.action.setBadgeBackgroundColor({ color: "#f87171" });
  } else {
    const label = score > 0 ? `${score}` : "";
    await chrome.action.setBadgeText({ text: label });
    const color = score >= 70 ? "#4ade80" : score >= 40 ? "#fb923c" : "#f87171";
    await chrome.action.setBadgeBackgroundColor({ color });
  }
}

async function checkBreakReminder(
  now: number,
  breakReminderMinutes: number,
  currentCategory: string
) {
  if (breakReminderMinutes <= 0 || currentCategory !== "productive") return;
  const { session } = await getStorage();
  const elapsed = (now - session.lastBreakTime) / 1000 / 60;
  if (elapsed >= breakReminderMinutes) {
    chrome.notifications.create("break_reminder", {
      type: "basic",
      iconUrl: chrome.runtime.getURL("assets/icons/icon48.png"),
      title: "Time for a break!",
      message: `You've been focused for ${Math.round(elapsed)} minutes. Step away for a few minutes.`,
    });
    // Reset break timer
    const updatedSession: ActiveSession = { ...session, lastBreakTime: now };
    await saveSession(updatedSession);
  }
}

// ─── Tab / Window Event Listeners ─────────────────────────────────────────────

async function onTabChange() {
  const now = Date.now();
  await flushCurrentDomain(now);
  const domain = await getCurrentActiveDomain();
  trackingDomain = domain;
  trackingStart = domain ? now : null;

  // Persist to session
  const { session } = await getStorage();
  await saveSession({ ...session, currentDomain: domain, domainStartTime: domain ? now : null });
}

chrome.tabs.onActivated.addListener(onTabChange);
chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo) => {
  if (changeInfo.status === "complete") await onTabChange();
});
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Window lost focus — flush but don't start new tracking
    const now = Date.now();
    await flushCurrentDomain(now);
    trackingDomain = null;
    trackingStart = null;
  } else {
    await onTabChange();
  }
});

// ─── Alarm Handler ────────────────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener(async (alarm) => {
  const now = Date.now();

  if (alarm.name === ALARM_TICK) {
    await flushCurrentDomain(now);
    // Reset tracking start after flush
    if (trackingDomain) trackingStart = now;
    await updateBadge(0);
  }

  if (alarm.name === ALARM_MIDNIGHT) {
    await checkMidnightReset();
    scheduleMidnightAlarm();
  }

  if (alarm.name === ALARM_POMODORO) {
    await handlePomodoroEnd();
  }

  if (alarm.name === ALARM_FOCUS_MODE) {
    await deactivateFocusMode();
  }

  if (alarm.name === ALARM_BREAK_REMINDER) {
    // Handled inline in checkBreakReminder
  }
});

// ─── Midnight Reset / Streak Update ───────────────────────────────────────────

async function checkMidnightReset() {
  const today = toDateString();
  const { streak, dailyData, settings } = await getStorage();
  const yesterday = toDateString(new Date(Date.now() - 86_400_000));

  const yesterdayRecord = dailyData[yesterday];
  if (!yesterdayRecord) return;

  const newStreak: StreakData = { ...streak };

  if (yesterdayRecord.goalMet) {
    if (areConsecutiveDays(streak.lastProductiveDate, yesterday) || streak.lastProductiveDate === "") {
      newStreak.current = streak.current + 1;
    } else if (
      settings.gracePeriodEnabled &&
      areConsecutiveDays(streak.lastProductiveDate, toDateString(new Date(Date.now() - 172_800_000)))
    ) {
      // Grace period: allow one skipped day
      newStreak.current = streak.current + 1;
    } else {
      newStreak.current = 1;
    }
    newStreak.lastProductiveDate = yesterday;
    newStreak.longest = Math.max(newStreak.current, streak.longest);
  } else {
    // Check grace period
    if (!settings.gracePeriodEnabled || streak.current === 0) {
      newStreak.current = 0;
    }
  }

  await saveStreak(newStreak);

  // Pre-create today's record
  if (!dailyData[today]) {
    await saveDayRecord({
      date: today,
      productiveSeconds: 0,
      unproductiveSeconds: 0,
      neutralSeconds: 0,
      siteBreakdown: {},
      pomodoroSessionsCompleted: 0,
      goalMet: false,
      score: 0,
    });
  }
}

// ─── Pomodoro ─────────────────────────────────────────────────────────────────

async function handlePomodoroEnd() {
  const { session, settings } = await getStorage();
  const record = await getTodayRecord(settings);

  if (session.pomodoroIsBreak) {
    // Break ended — notify and start next work session
    chrome.notifications.create("pomodoro_work_start", {
      type: "basic",
      iconUrl: chrome.runtime.getURL("assets/icons/icon48.png"),
      title: "Break over — time to focus!",
      message: "Your break is done. Start your next Pomodoro session.",
    });
    const updatedSession: ActiveSession = { ...session, pomodoroActive: false, pomodoroEndTime: null };
    await saveSession(updatedSession);
  } else {
    // Work session ended — increment count, start break
    const newSessionCount = session.pomodoroSessionCount + 1;
    const isLongBreak = newSessionCount % 4 === 0;
    const breakMinutes = isLongBreak
      ? settings.pomodoroLongBreakMinutes
      : settings.pomodoroShortBreakMinutes;

    // Update day record
    record.pomodoroSessionsCompleted += 1;
    await saveDayRecord(record);

    chrome.notifications.create("pomodoro_break_start", {
      type: "basic",
      iconUrl: chrome.runtime.getURL("assets/icons/icon48.png"),
      title: isLongBreak ? "Great work! Long break time." : "Session complete! Take a short break.",
      message: `${isLongBreak ? "Long" : "Short"} break: ${breakMinutes} minutes. You've completed ${newSessionCount} session${newSessionCount !== 1 ? "s" : ""} today.`,
    });

    const endTime = Date.now() + breakMinutes * 60 * 1000;
    const updatedSession: ActiveSession = {
      ...session,
      pomodoroActive: true,
      pomodoroEndTime: endTime,
      pomodoroIsBreak: true,
      pomodoroSessionCount: newSessionCount,
      lastBreakTime: Date.now(),
    };
    await saveSession(updatedSession);
    chrome.alarms.create(ALARM_POMODORO, { when: endTime });
  }
}

// ─── Message Handlers (from popup / content) ─────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse).catch((err) => {
    console.error("MindPortal message error:", err);
    sendResponse({ error: String(err) });
  });
  return true; // async response
});

async function handleMessage(message: Record<string, unknown>): Promise<unknown> {
  const { type } = message;

  if (type === "START_POMODORO") {
    const { session, settings } = await getStorage();
    const workMs = settings.pomodoroWorkMinutes * 60 * 1000;
    const endTime = Date.now() + workMs;
    await chrome.alarms.clear(ALARM_POMODORO);
    chrome.alarms.create(ALARM_POMODORO, { when: endTime });
    await saveSession({
      ...session,
      pomodoroActive: true,
      pomodoroEndTime: endTime,
      pomodoroIsBreak: false,
    });
    return { ok: true };
  }

  if (type === "PAUSE_POMODORO") {
    const { session } = await getStorage();
    await chrome.alarms.clear(ALARM_POMODORO);
    await saveSession({ ...session, pomodoroActive: false, pomodoroEndTime: null });
    return { ok: true };
  }

  if (type === "SKIP_POMODORO") {
    await chrome.alarms.clear(ALARM_POMODORO);
    await handlePomodoroEnd();
    return { ok: true };
  }

  if (type === "STOP_POMODORO") {
    const { session } = await getStorage();
    await chrome.alarms.clear(ALARM_POMODORO);
    await saveSession({
      ...session,
      pomodoroActive: false,
      pomodoroEndTime: null,
      pomodoroIsBreak: false,
      pomodoroSessionCount: 0,
    });
    return { ok: true };
  }

  if (type === "ACTIVATE_FOCUS_MODE") {
    const { session, settings } = await getStorage();
    const minutes = (message["minutes"] as number | undefined) ?? settings.focusModeDefaultMinutes;
    const endTime = Date.now() + minutes * 60 * 1000;
    await chrome.alarms.clear(ALARM_FOCUS_MODE);
    chrome.alarms.create(ALARM_FOCUS_MODE, { when: endTime });
    await saveSession({ ...session, focusModeActive: true, focusModeEndTime: endTime });
    return { ok: true };
  }

  if (type === "DEACTIVATE_FOCUS_MODE") {
    await deactivateFocusMode();
    return { ok: true };
  }

  if (type === "DISMISS_SITE_TODAY") {
    const { addDismissedSite } = await import("../shared/storage");
    await addDismissedSite(message["domain"] as string);
    return { ok: true };
  }

  if (type === "GET_STORAGE") {
    return getStorage();
  }

  if (type === "TAB_CHANGED") {
    await onTabChange();
    return { ok: true };
  }

  if (type === "FEED_PET") {
    const storage = await getStorage();
    const today = toDateString();
    const todayRecord = storage.dailyData[today];
    const productiveSecs = todayRecord?.productiveSeconds ?? 0;

    if (storage.pet.lastFedDate === today) {
      return { ok: false, reason: "already_fed" };
    }
    if (productiveSecs < 20 * 60) {
      return { ok: false, reason: "not_enough_work", needed: 20 - Math.floor(productiveSecs / 60) };
    }

    const newPet = {
      lastFedDate: today,
      totalFeedCount: storage.pet.totalFeedCount + 1,
    };
    await savePetState(newPet);
    return { ok: true, pet: newPet };
  }

  if (type === "SAVE_SETTINGS") {
    const { saveSettings } = await import("../shared/storage");
    await saveSettings(message["settings"] as import("../shared/types").Settings);
    return { ok: true };
  }

  return { error: "Unknown message type" };
}

async function deactivateFocusMode() {
  const { session } = await getStorage();
  await chrome.alarms.clear(ALARM_FOCUS_MODE);
  await saveSession({ ...session, focusModeActive: false, focusModeEndTime: null });
  chrome.notifications.create("focus_mode_end", {
    type: "basic",
    iconUrl: chrome.runtime.getURL("assets/icons/icon48.png"),
    title: "Focus Mode ended",
    message: "You're back. Distracting sites are unblocked.",
  });
}
