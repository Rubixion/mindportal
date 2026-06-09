import { D as DEFAULT_SESSION, a as DEFAULT_STREAK, b as DEFAULT_SETTINGS } from "../chunks/defaults-CCjS-AZq.js";
import { t as toDateString, a as areConsecutiveDays, c as categorizeDomain, b as computeScore, e as extractDomain } from "../chunks/utils-DXHU2JcO.js";
const scriptRel = "modulepreload";
const assetsURL = function(dep) {
  return "/" + dep;
};
const seen = {};
const __vitePreload = function preload(baseModule, deps, importerUrl) {
  let promise = Promise.resolve();
  if (deps && deps.length > 0) {
    document.getElementsByTagName("link");
    const cspNonceMeta = document.querySelector(
      "meta[property=csp-nonce]"
    );
    const cspNonce = cspNonceMeta?.nonce || cspNonceMeta?.getAttribute("nonce");
    promise = Promise.allSettled(
      deps.map((dep) => {
        dep = assetsURL(dep);
        if (dep in seen) return;
        seen[dep] = true;
        const isCss = dep.endsWith(".css");
        const cssSelector = isCss ? '[rel="stylesheet"]' : "";
        if (document.querySelector(`link[href="${dep}"]${cssSelector}`)) {
          return;
        }
        const link = document.createElement("link");
        link.rel = isCss ? "stylesheet" : scriptRel;
        if (!isCss) {
          link.as = "script";
        }
        link.crossOrigin = "";
        link.href = dep;
        if (cspNonce) {
          link.setAttribute("nonce", cspNonce);
        }
        document.head.appendChild(link);
        if (isCss) {
          return new Promise((res, rej) => {
            link.addEventListener("load", res);
            link.addEventListener(
              "error",
              () => rej(new Error(`Unable to preload CSS for ${dep}`))
            );
          });
        }
      })
    );
  }
  function handlePreloadError(err) {
    const e = new Event("vite:preloadError", {
      cancelable: true
    });
    e.payload = err;
    window.dispatchEvent(e);
    if (!e.defaultPrevented) {
      throw err;
    }
  }
  return promise.then((res) => {
    for (const item of res || []) {
      if (item.status !== "rejected") continue;
      handlePreloadError(item.reason);
    }
    return baseModule().catch(handlePreloadError);
  });
};
async function getStorage() {
  const raw = await chrome.storage.local.get([
    "settings",
    "dailyData",
    "streak",
    "session",
    "dismissedToday",
    "lastDismissedDate"
  ]);
  return {
    settings: { ...DEFAULT_SETTINGS, ...raw["settings"] },
    dailyData: raw["dailyData"] ?? {},
    streak: { ...DEFAULT_STREAK, ...raw["streak"] },
    session: { ...DEFAULT_SESSION, ...raw["session"] },
    dismissedToday: raw["dismissedToday"] ?? [],
    lastDismissedDate: raw["lastDismissedDate"] ?? ""
  };
}
async function saveSession(session) {
  await chrome.storage.local.set({ session });
}
async function saveStreak(streak) {
  await chrome.storage.local.set({ streak });
}
async function saveDayRecord(record) {
  const { dailyData } = await chrome.storage.local.get("dailyData");
  const existing = dailyData ?? {};
  existing[record.date] = record;
  const cutoff = /* @__PURE__ */ new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = toDateString(cutoff);
  for (const key of Object.keys(existing)) {
    if (key < cutoffStr) delete existing[key];
  }
  await chrome.storage.local.set({ dailyData: existing });
}
async function getTodayRecord(_settings) {
  const today = toDateString();
  const { dailyData } = await chrome.storage.local.get("dailyData");
  const existing = dailyData ?? {};
  return existing[today] ?? {
    date: today,
    productiveSeconds: 0,
    unproductiveSeconds: 0,
    neutralSeconds: 0,
    siteBreakdown: {},
    pomodoroSessionsCompleted: 0,
    goalMet: false,
    score: 0
  };
}
async function addDismissedSite(domain) {
  const today = toDateString();
  const raw = await chrome.storage.local.get(["dismissedToday", "lastDismissedDate"]);
  const lastDate = raw["lastDismissedDate"] ?? "";
  let dismissed = raw["dismissedToday"] ?? [];
  if (lastDate !== today) dismissed = [];
  if (!dismissed.includes(domain)) dismissed.push(domain);
  await chrome.storage.local.set({ dismissedToday: dismissed, lastDismissedDate: today });
}
const storage = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  addDismissedSite,
  getStorage,
  getTodayRecord,
  saveDayRecord,
  saveSession,
  saveStreak
}, Symbol.toStringTag, { value: "Module" }));
const ALARM_TICK = "ff_tick";
const ALARM_MIDNIGHT = "ff_midnight";
const ALARM_BREAK_REMINDER = "ff_break_reminder";
const ALARM_POMODORO = "ff_pomodoro";
const ALARM_FOCUS_MODE = "ff_focus_mode";
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("src/onboarding/index.html") });
  }
  await setupAlarms();
});
chrome.runtime.onStartup.addListener(async () => {
  await setupAlarms();
  await checkMidnightReset();
});
async function setupAlarms() {
  await chrome.alarms.clearAll();
  chrome.alarms.create(ALARM_TICK, { periodInMinutes: 10 / 60 });
  scheduleMidnightAlarm();
}
function scheduleMidnightAlarm() {
  const now = /* @__PURE__ */ new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 5, 0);
  chrome.alarms.create(ALARM_MIDNIGHT, { when: midnight.getTime() });
}
let trackingDomain = null;
let trackingStart = null;
async function getCurrentActiveDomain() {
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
async function flushCurrentDomain(now) {
  if (!trackingDomain || !trackingStart) return;
  const elapsed = Math.floor((now - trackingStart) / 1e3);
  if (elapsed <= 0) return;
  const { settings, session, dailyData } = await getStorage();
  if (session.focusModeActive && session.focusModeEndTime && now > session.focusModeEndTime) {
    await deactivateFocusMode();
  }
  const today = toDateString();
  const record = dailyData[today] ?? {
    date: today,
    productiveSeconds: 0,
    unproductiveSeconds: 0,
    neutralSeconds: 0,
    siteBreakdown: {},
    pomodoroSessionsCompleted: 0,
    goalMet: false,
    score: 0
  };
  const category = categorizeDomain(trackingDomain, settings);
  if (category === "productive") {
    record.productiveSeconds += elapsed;
  } else if (category === "unproductive") {
    record.unproductiveSeconds += elapsed;
  } else {
    record.neutralSeconds += elapsed;
  }
  record.siteBreakdown[trackingDomain] = (record.siteBreakdown[trackingDomain] ?? 0) + elapsed;
  record.score = computeScore(
    record.productiveSeconds,
    record.unproductiveSeconds,
    settings.dailyGoalMinutes,
    settings.unproductiveCapMinutes
  );
  record.goalMet = record.productiveSeconds >= settings.dailyGoalMinutes * 60 && record.unproductiveSeconds <= settings.unproductiveCapMinutes * 60;
  await saveDayRecord(record);
  await updateBadge(record.score);
  await checkBreakReminder(now, settings.breakReminderMinutes, category);
}
async function updateBadge(score) {
  const { session } = await getStorage();
  if (session.pomodoroActive && session.pomodoroEndTime) {
    const remaining = Math.max(0, Math.ceil((session.pomodoroEndTime - Date.now()) / 1e3));
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
async function checkBreakReminder(now, breakReminderMinutes, currentCategory) {
  if (breakReminderMinutes <= 0 || currentCategory !== "productive") return;
  const { session } = await getStorage();
  const elapsed = (now - session.lastBreakTime) / 1e3 / 60;
  if (elapsed >= breakReminderMinutes) {
    chrome.notifications.create("break_reminder", {
      type: "basic",
      iconUrl: chrome.runtime.getURL("assets/icons/icon48.png"),
      title: "Time for a break!",
      message: `You've been focused for ${Math.round(elapsed)} minutes. Step away for a few minutes.`
    });
    const updatedSession = { ...session, lastBreakTime: now };
    await saveSession(updatedSession);
  }
}
async function onTabChange() {
  const now = Date.now();
  await flushCurrentDomain(now);
  const domain = await getCurrentActiveDomain();
  trackingDomain = domain;
  trackingStart = domain ? now : null;
  const { session } = await getStorage();
  await saveSession({ ...session, currentDomain: domain, domainStartTime: domain ? now : null });
}
chrome.tabs.onActivated.addListener(onTabChange);
chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo) => {
  if (changeInfo.status === "complete") await onTabChange();
});
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    const now = Date.now();
    await flushCurrentDomain(now);
    trackingDomain = null;
    trackingStart = null;
  } else {
    await onTabChange();
  }
});
chrome.alarms.onAlarm.addListener(async (alarm) => {
  const now = Date.now();
  if (alarm.name === ALARM_TICK) {
    await flushCurrentDomain(now);
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
  if (alarm.name === ALARM_BREAK_REMINDER) ;
});
async function checkMidnightReset() {
  const today = toDateString();
  const { streak, dailyData, settings } = await getStorage();
  const yesterday = toDateString(new Date(Date.now() - 864e5));
  const yesterdayRecord = dailyData[yesterday];
  if (!yesterdayRecord) return;
  const newStreak = { ...streak };
  if (yesterdayRecord.goalMet) {
    if (areConsecutiveDays(streak.lastProductiveDate, yesterday) || streak.lastProductiveDate === "") {
      newStreak.current = streak.current + 1;
    } else if (settings.gracePeriodEnabled && areConsecutiveDays(streak.lastProductiveDate, toDateString(new Date(Date.now() - 1728e5)))) {
      newStreak.current = streak.current + 1;
    } else {
      newStreak.current = 1;
    }
    newStreak.lastProductiveDate = yesterday;
    newStreak.longest = Math.max(newStreak.current, streak.longest);
  } else {
    if (!settings.gracePeriodEnabled || streak.current === 0) {
      newStreak.current = 0;
    }
  }
  await saveStreak(newStreak);
  if (!dailyData[today]) {
    await saveDayRecord({
      date: today,
      productiveSeconds: 0,
      unproductiveSeconds: 0,
      neutralSeconds: 0,
      siteBreakdown: {},
      pomodoroSessionsCompleted: 0,
      goalMet: false,
      score: 0
    });
  }
}
async function handlePomodoroEnd() {
  const { session, settings } = await getStorage();
  const record = await getTodayRecord();
  if (session.pomodoroIsBreak) {
    chrome.notifications.create("pomodoro_work_start", {
      type: "basic",
      iconUrl: chrome.runtime.getURL("assets/icons/icon48.png"),
      title: "Break over — time to focus!",
      message: "Your break is done. Start your next Pomodoro session."
    });
    const updatedSession = { ...session, pomodoroActive: false, pomodoroEndTime: null };
    await saveSession(updatedSession);
  } else {
    const newSessionCount = session.pomodoroSessionCount + 1;
    const isLongBreak = newSessionCount % 4 === 0;
    const breakMinutes = isLongBreak ? settings.pomodoroLongBreakMinutes : settings.pomodoroShortBreakMinutes;
    record.pomodoroSessionsCompleted += 1;
    await saveDayRecord(record);
    chrome.notifications.create("pomodoro_break_start", {
      type: "basic",
      iconUrl: chrome.runtime.getURL("assets/icons/icon48.png"),
      title: isLongBreak ? "Great work! Long break time." : "Session complete! Take a short break.",
      message: `${isLongBreak ? "Long" : "Short"} break: ${breakMinutes} minutes. You've completed ${newSessionCount} session${newSessionCount !== 1 ? "s" : ""} today.`
    });
    const endTime = Date.now() + breakMinutes * 60 * 1e3;
    const updatedSession = {
      ...session,
      pomodoroActive: true,
      pomodoroEndTime: endTime,
      pomodoroIsBreak: true,
      pomodoroSessionCount: newSessionCount,
      lastBreakTime: Date.now()
    };
    await saveSession(updatedSession);
    chrome.alarms.create(ALARM_POMODORO, { when: endTime });
  }
}
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse).catch((err) => {
    console.error("FocusForge message error:", err);
    sendResponse({ error: String(err) });
  });
  return true;
});
async function handleMessage(message) {
  const { type } = message;
  if (type === "START_POMODORO") {
    const { session, settings } = await getStorage();
    const workMs = settings.pomodoroWorkMinutes * 60 * 1e3;
    const endTime = Date.now() + workMs;
    await chrome.alarms.clear(ALARM_POMODORO);
    chrome.alarms.create(ALARM_POMODORO, { when: endTime });
    await saveSession({
      ...session,
      pomodoroActive: true,
      pomodoroEndTime: endTime,
      pomodoroIsBreak: false
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
      pomodoroSessionCount: 0
    });
    return { ok: true };
  }
  if (type === "ACTIVATE_FOCUS_MODE") {
    const { session, settings } = await getStorage();
    const minutes = message["minutes"] ?? settings.focusModeDefaultMinutes;
    const endTime = Date.now() + minutes * 60 * 1e3;
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
    const { addDismissedSite: addDismissedSite2 } = await __vitePreload(async () => {
      const { addDismissedSite: addDismissedSite3 } = await Promise.resolve().then(() => storage);
      return { addDismissedSite: addDismissedSite3 };
    }, true ? void 0 : void 0);
    await addDismissedSite2(message["domain"]);
    return { ok: true };
  }
  if (type === "GET_STORAGE") {
    return getStorage();
  }
  if (type === "TAB_CHANGED") {
    await onTabChange();
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
    message: "You're back. Distracting sites are unblocked."
  });
}
