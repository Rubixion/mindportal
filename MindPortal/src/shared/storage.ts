import type { AppStorage, Settings, DayRecord, StreakData, ActiveSession } from "./types";
import { DEFAULT_SETTINGS, DEFAULT_STREAK, DEFAULT_SESSION } from "./defaults";
import { toDateString } from "./utils";

/** Reads the full app storage, filling in defaults for missing keys. */
export async function getStorage(): Promise<AppStorage> {
  const raw = await chrome.storage.local.get([
    "settings",
    "dailyData",
    "streak",
    "session",
    "dismissedToday",
    "lastDismissedDate",
  ]);

  return {
    settings: { ...DEFAULT_SETTINGS, ...(raw["settings"] as Partial<Settings> | undefined) },
    dailyData: (raw["dailyData"] as Record<string, DayRecord> | undefined) ?? {},
    streak: { ...DEFAULT_STREAK, ...(raw["streak"] as Partial<StreakData> | undefined) },
    session: { ...DEFAULT_SESSION, ...(raw["session"] as Partial<ActiveSession> | undefined) },
    dismissedToday: (raw["dismissedToday"] as string[] | undefined) ?? [],
    lastDismissedDate: (raw["lastDismissedDate"] as string | undefined) ?? "",
  };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ settings });
}

export async function saveSession(session: ActiveSession): Promise<void> {
  await chrome.storage.local.set({ session });
}

export async function saveStreak(streak: StreakData): Promise<void> {
  await chrome.storage.local.set({ streak });
}

export async function saveDayRecord(record: DayRecord): Promise<void> {
  const { dailyData } = await chrome.storage.local.get("dailyData");
  const existing = (dailyData as Record<string, DayRecord> | undefined) ?? {};
  existing[record.date] = record;
  // Keep only last 90 days of data
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = toDateString(cutoff);
  for (const key of Object.keys(existing)) {
    if (key < cutoffStr) delete existing[key];
  }
  await chrome.storage.local.set({ dailyData: existing });
}

export async function getTodayRecord(_settings: AppStorage["settings"]): Promise<DayRecord> {
  const today = toDateString();
  const { dailyData } = await chrome.storage.local.get("dailyData");
  const existing = (dailyData as Record<string, DayRecord> | undefined) ?? {};
  return (
    existing[today] ?? {
      date: today,
      productiveSeconds: 0,
      unproductiveSeconds: 0,
      neutralSeconds: 0,
      siteBreakdown: {},
      pomodoroSessionsCompleted: 0,
      goalMet: false,
      score: 0,
    }
  );
}

export async function addDismissedSite(domain: string): Promise<void> {
  const today = toDateString();
  const raw = await chrome.storage.local.get(["dismissedToday", "lastDismissedDate"]);
  const lastDate = (raw["lastDismissedDate"] as string | undefined) ?? "";
  let dismissed = (raw["dismissedToday"] as string[] | undefined) ?? [];
  if (lastDate !== today) dismissed = [];
  if (!dismissed.includes(domain)) dismissed.push(domain);
  await chrome.storage.local.set({ dismissedToday: dismissed, lastDismissedDate: today });
}

export async function clearAllData(): Promise<void> {
  await chrome.storage.local.clear();
}
