export interface Settings {
  userName: string;
  productiveSites: string[];
  unproductiveSites: string[];
  dailyGoalMinutes: number;
  unproductiveCapMinutes: number;
  warningMode: "warn" | "countdown" | "block";
  countdownSeconds: number;
  gracePeriodEnabled: boolean;
  pomodoroWorkMinutes: number;
  pomodoroShortBreakMinutes: number;
  pomodoroLongBreakMinutes: number;
  pomodoroAutoFocusMode: boolean;
  breakReminderMinutes: number;
  focusModeDefaultMinutes: number;
  onboardingComplete: boolean;
}

export interface DayRecord {
  date: string; // YYYY-MM-DD
  productiveSeconds: number;
  unproductiveSeconds: number;
  neutralSeconds: number;
  siteBreakdown: Record<string, number>; // domain → seconds
  pomodoroSessionsCompleted: number;
  goalMet: boolean;
  score: number;
}

export interface StreakData {
  current: number;
  longest: number;
  lastProductiveDate: string; // YYYY-MM-DD
}

export interface ActiveSession {
  pomodoroActive: boolean;
  pomodoroEndTime: number | null; // unix ms
  pomodoroIsBreak: boolean;
  pomodoroSessionCount: number; // sessions since last long break
  focusModeActive: boolean;
  focusModeEndTime: number | null; // unix ms
  lastBreakTime: number; // unix ms — for break reminders
  currentDomain: string | null;
  domainStartTime: number | null; // unix ms
}

export interface AppStorage {
  settings: Settings;
  dailyData: Record<string, DayRecord>;
  streak: StreakData;
  session: ActiveSession;
  dismissedToday: string[]; // domains dismissed from warning today
  lastDismissedDate: string; // YYYY-MM-DD — reset dismissals when date changes
}

export type SiteCategory = "productive" | "unproductive" | "neutral";

export interface TabTimeEvent {
  domain: string;
  seconds: number;
  category: SiteCategory;
}
