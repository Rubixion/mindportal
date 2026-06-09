const DEFAULT_SETTINGS = {
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
    "netlify.com"
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
    "disneyplus.com"
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
  onboardingComplete: false
};
const DEFAULT_STREAK = {
  current: 0,
  longest: 0,
  lastProductiveDate: ""
};
const DEFAULT_SESSION = {
  pomodoroActive: false,
  pomodoroEndTime: null,
  pomodoroIsBreak: false,
  pomodoroSessionCount: 0,
  focusModeActive: false,
  focusModeEndTime: null,
  lastBreakTime: Date.now(),
  currentDomain: null,
  domainStartTime: null
};
export {
  DEFAULT_SESSION as D,
  DEFAULT_STREAK as a,
  DEFAULT_SETTINGS as b
};
