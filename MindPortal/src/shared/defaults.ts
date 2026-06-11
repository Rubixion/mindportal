import type { Settings, StreakData, ActiveSession, PetState } from "./types";

export const DEFAULT_SETTINGS: Settings = {
  userName: "",
  productiveSites: [
    "github.com",
    "gitlab.com",
    "docs.google.com",
    "drive.google.com",
    "notion.so",
    "stackoverflow.com",
    "developer.mozilla.org",
    "coursera.org",
    "udemy.com",
    "khanacademy.org",
    "leetcode.com",
    "linear.app",
    "figma.com",
    "vercel.com",
    "netlify.com",
  ],
  unproductiveSites: [
    "youtube.com",
    "reddit.com",
    "twitter.com",
    "x.com",
    "instagram.com",
    "tiktok.com",
    "netflix.com",
    "facebook.com",
    "twitch.tv",
    "9gag.com",
    "buzzfeed.com",
    "hulu.com",
    "disneyplus.com",
  ],
  dailyGoalMinutes: 120,
  unproductiveCapMinutes: 30,
  warningMode: "countdown",
  countdownSeconds: 5,
  gracePeriodEnabled: false,
  pomodoroWorkMinutes: 25,
  pomodoroShortBreakMinutes: 5,
  pomodoroLongBreakMinutes: 15,
  pomodoroAutoFocusMode: false,
  breakReminderMinutes: 50,
  focusModeDefaultMinutes: 30,
  onboardingComplete: false,
  popupSize: "normal",
  animationsEnabled: true,
  languageGoal: "",
};

export const DEFAULT_PET: PetState = {
  lastFedDate: "",
  totalFeedCount: 0,
};

export const DEFAULT_STREAK: StreakData = {
  current: 0,
  longest: 0,
  lastProductiveDate: "",
};

export const DEFAULT_SESSION: ActiveSession = {
  pomodoroActive: false,
  pomodoroEndTime: null,
  pomodoroIsBreak: false,
  pomodoroSessionCount: 0,
  focusModeActive: false,
  focusModeEndTime: null,
  lastBreakTime: Date.now(),
  currentDomain: null,
  domainStartTime: null,
  intention: "",
};
