import type { AppStorage, Settings, DayRecord, StreakData, ActiveSession, PetState, IntentionRecord } from "./types";
import { DEFAULT_SETTINGS, DEFAULT_STREAK, DEFAULT_SESSION, DEFAULT_PET } from "./defaults";
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
    "pet",
    "xp",
    "level",
    "intentionHistory",
    "delayQueue",
  ]);

  return {
    settings: { ...DEFAULT_SETTINGS, ...(raw["settings"] as Partial<Settings> | undefined) },
    dailyData: (raw["dailyData"] as Record<string, DayRecord> | undefined) ?? {},
    streak: { ...DEFAULT_STREAK, ...(raw["streak"] as Partial<StreakData> | undefined) },
    session: { ...DEFAULT_SESSION, ...(raw["session"] as Partial<ActiveSession> | undefined) },
    dismissedToday: (raw["dismissedToday"] as string[] | undefined) ?? [],
    lastDismissedDate: (raw["lastDismissedDate"] as string | undefined) ?? "",
    pet: { ...DEFAULT_PET, ...(raw["pet"] as Partial<PetState> | undefined) },
    xp: (raw["xp"] as number | undefined) ?? 0,
    level: (raw["level"] as number | undefined) ?? 1,
    intentionHistory: (raw["intentionHistory"] as IntentionRecord[] | undefined) ?? [],
    delayQueue: (raw["delayQueue"] as string[] | undefined) ?? [],
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

export async function savePetState(pet: PetState): Promise<void> {
  await chrome.storage.local.set({ pet });
}

export async function awardXP(amount: number): Promise<{ xp: number; level: number; leveledUp: boolean }> {
  const raw = await chrome.storage.local.get(["xp", "level"]);
  const currentXP = ((raw["xp"] as number | undefined) ?? 0) + amount;
  const currentLevel = (raw["level"] as number | undefined) ?? 1;
  const xpForNextLevel = currentLevel * 100;
  const leveledUp = currentXP >= xpForNextLevel;
  const newLevel = leveledUp ? currentLevel + 1 : currentLevel;
  const newXP = leveledUp ? currentXP - xpForNextLevel : currentXP;
  await chrome.storage.local.set({ xp: newXP, level: newLevel });
  return { xp: newXP, level: newLevel, leveledUp };
}

export async function addIntentionRecord(record: IntentionRecord): Promise<void> {
  const raw = await chrome.storage.local.get("intentionHistory");
  const history = (raw["intentionHistory"] as IntentionRecord[] | undefined) ?? [];
  history.unshift(record);
  if (history.length > 50) history.splice(50);
  await chrome.storage.local.set({ intentionHistory: history });
}

export async function addToDelayQueue(domain: string): Promise<void> {
  const raw = await chrome.storage.local.get("delayQueue");
  const queue = (raw["delayQueue"] as string[] | undefined) ?? [];
  if (!queue.includes(domain)) queue.push(domain);
  await chrome.storage.local.set({ delayQueue: queue });
}

export async function clearDelayQueue(): Promise<void> {
  await chrome.storage.local.set({ delayQueue: [] });
}

export async function clearAllData(): Promise<void> {
  await chrome.storage.local.clear();
}
