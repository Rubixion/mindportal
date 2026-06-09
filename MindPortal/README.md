# FocusForge 🔥

> Forge your focus, one day at a time.

A Chrome Extension (Manifest V3) that helps you build discipline through time tracking, site warnings, streaks, and focus sessions.

---

## Features

| Feature | Description |
|---|---|
| ⏱️ **Time Tracking** | Tracks seconds on productive vs. unproductive vs. neutral sites. Resets at midnight. |
| 🚧 **Site Warnings** | Full-page overlay when entering unproductive sites. Three modes: Countdown (5s pause), Warn Only, Hard Block. |
| 🔥 **Streaks** | Daily streak that increments when you hit your productive time goal and stay under your unproductive cap. |
| 🍅 **Pomodoro Timer** | 25/5/15 minute work-break cycles running in the background via Chrome Alarms. Badge shows countdown. |
| 🔒 **Focus Mode** | One-click time-boxed lockdown that hard-blocks all unproductive sites. |
| 🎯 **Daily Goals** | Set a productive time target and an unproductive time cap. Progress bars in popup. |
| 📊 **Analytics** | Bar, pie, and line charts (Chart.js) plus a 90-day streak calendar heatmap. |
| 💬 **Motivational Quotes** | 50 curated quotes shown on each popup open. |
| 🔔 **Break Reminders** | Notification after X minutes of continuous productive work. |

---

## Quick Start

### Install in Chrome

1. Run `npm run build`
2. Open Chrome → `chrome://extensions`
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked** → select the `dist/` folder
5. Complete the one-time onboarding — set your name, daily goal, and warning mode

### Development

```bash
npm install          # Install dependencies
npm run dev          # Watch mode (auto-rebuilds on save)
npm run build        # Production build → dist/
npm test             # Run unit tests (Vitest)
npm run lint         # ESLint check
npm run lint:fix     # Auto-fix lint errors
npm run format       # Prettier format
```

---

## Project Structure

```
focusforge/
├── manifest.json               # MV3 manifest
├── src/
│   ├── background/
│   │   └── service-worker.ts   # Tab tracking, alarms, streaks, Pomodoro
│   ├── content/
│   │   └── content-script.ts   # Injects warning overlay on unproductive sites
│   ├── popup/                  # Popup (score, timers, focus mode)
│   ├── options/                # Settings page + analytics charts
│   ├── onboarding/             # First-run setup wizard
│   └── shared/
│       ├── types.ts            # All TypeScript interfaces
│       ├── storage.ts          # Typed chrome.storage wrappers
│       ├── defaults.ts         # Default site lists and settings
│       ├── utils.ts            # Domain extraction, scoring, formatting
│       └── quotes.ts           # 50 motivational quotes
├── tests/                      # Vitest unit tests
└── scripts/
    └── generate-icons.js       # PNG icon generator (run as prebuild)
```

---

## How Scoring Works

`score = (productiveMin / goalMin) × 70 + (1 − unproductiveMin / capMin) × 30`

- Clamped to 0–100
- Green ≥ 70 · Orange ≥ 40 · Red < 40
- A day counts as "productive" (streak++) when score ≥ threshold AND goal met

---

## Default Site Lists

**Productive**: github.com, docs.google.com, notion.so, stackoverflow.com, coursera.org, leetcode.com, figma.com, …

**Unproductive**: youtube.com, reddit.com, twitter.com/x.com, instagram.com, tiktok.com, netflix.com, twitch.tv, …

All lists are fully customizable from **Settings → Sites**.

---

## Data & Privacy

All data is stored locally in `chrome.storage.local`. Nothing is sent to any server. Use **Settings → About → Export Data** to download a JSON backup, or **Reset All Data** to start fresh.
