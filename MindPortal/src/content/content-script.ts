import { extractDomain, domainMatchesList } from "../shared/utils";
import type { AppStorage } from "../shared/types";

// Only run once per page load
if (document.readyState !== "complete" && !document.getElementById("ff-overlay-root")) {
  main();
}

async function main() {
  const storage = await getStorage();
  if (!storage.settings.onboardingComplete) return;

  const domain = extractDomain(window.location.href);
  if (!domain) return;

  const { settings, session, dismissedToday, lastDismissedDate } = storage;

  // Refresh dismissed list if date changed
  const today = new Date().toISOString().slice(0, 10);
  const dismissed = lastDismissedDate === today ? dismissedToday : [];

  // Check if already dismissed today
  if (dismissed.includes(domain)) return;

  // Check if it's an unproductive site
  if (!domainMatchesList(domain, settings.unproductiveSites)) return;

  // In focus mode → always hard block
  const mode = session.focusModeActive ? "block" : settings.warningMode;

  // During pomodoro work session with autoFocusMode → block
  const autoBlock =
    settings.pomodoroAutoFocusMode &&
    session.pomodoroActive &&
    !session.pomodoroIsBreak;
  const effectiveMode = autoBlock ? "block" : mode;

  showOverlay(domain, effectiveMode, settings.countdownSeconds, settings.userName);
}

async function getStorage(): Promise<AppStorage> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "GET_STORAGE" }, (response) => {
      resolve(response as AppStorage);
    });
  });
}

function showOverlay(
  domain: string,
  mode: "warn" | "countdown" | "block",
  countdownSeconds: number,
  userName: string
) {
  // Freeze page scroll while overlay is active
  document.documentElement.style.overflow = "hidden";

  const root = document.createElement("div");
  root.id = "ff-overlay-root";
  root.setAttribute("style", `
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.88);
    z-index: 2147483647;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    animation: ff-fade-in 0.2s ease;
  `);

  const card = document.createElement("div");
  card.setAttribute("style", `
    background: #141414;
    border: 1px solid #2a2a2a;
    border-radius: 16px;
    padding: 40px 48px;
    max-width: 480px;
    width: 90%;
    text-align: center;
    box-shadow: 0 24px 64px rgba(0,0,0,0.6);
    animation: ff-slide-up 0.25s ease;
  `);

  const greeting = userName ? `Heads up, ${userName}` : "Heads up";

  if (mode === "block") {
    card.innerHTML = `
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <h2 style="color:#e8e8e8;font-size:22px;font-weight:700;margin:0 0 8px">${greeting}</h2>
      <p style="color:#888;font-size:15px;margin:0 0 16px">
        <span style="color:#f87171;font-weight:600">${domain}</span> is blocked during Focus Mode.
      </p>
      <p style="color:#555;font-size:13px;margin:0">Deactivate Focus Mode from the extension to visit this site.</p>
      <button id="ff-go-back" style="${btnStyle("#6c63ff")}">← Go Back</button>
    `;
  } else {
    const countdownId = "ff-countdown-num";
    const continueId = "ff-continue-btn";

    card.innerHTML = `
      <div style="font-size:40px;margin-bottom:16px">⚠️</div>
      <h2 style="color:#e8e8e8;font-size:22px;font-weight:700;margin:0 0 8px">${greeting}</h2>
      <p style="color:#aaa;font-size:15px;margin:0 0 6px">
        You're about to open
        <span style="color:#fb923c;font-weight:600">${domain}</span>
      </p>
      <p style="color:#666;font-size:13px;margin:0 0 28px">This site is marked as <span style="color:#f87171">UNPRODUCTIVE</span>.</p>
      <div style="display:flex;gap:12px;justify-content:center;margin-bottom:20px">
        <button id="ff-go-back" style="${btnStyle("#333", "#e8e8e8")}">← Go Back</button>
        <button id="${continueId}" style="${btnStyle("#6c63ff")}" ${mode === "countdown" ? "disabled" : ""}>
          ${mode === "countdown" ? `Continue in <span id="${countdownId}">${countdownSeconds}</span>s…` : "Continue Anyway →"}
        </button>
      </div>
      <label style="display:flex;align-items:center;justify-content:center;gap:8px;color:#555;font-size:13px;cursor:pointer">
        <input type="checkbox" id="ff-dismiss-today" style="accent-color:#6c63ff">
        Don't warn me for ${domain} today
      </label>
    `;
  }

  // Inject keyframe CSS
  const style = document.createElement("style");
  style.textContent = `
    @keyframes ff-fade-in { from { opacity: 0 } to { opacity: 1 } }
    @keyframes ff-slide-up { from { transform: translateY(20px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
    #ff-overlay-root * { box-sizing: border-box; }
  `;
  document.head.appendChild(style);
  root.appendChild(card);
  document.body.appendChild(root);

  // Go Back button
  document.getElementById("ff-go-back")?.addEventListener("click", () => {
    removeOverlay();
    history.back();
  });

  if (mode === "warn") {
    // Instant continue
    document.getElementById("ff-continue-btn")?.addEventListener("click", () => {
      handleContinue(domain);
    });
  } else if (mode === "countdown") {
    // Countdown timer
    let remaining = countdownSeconds;
    const countdownEl = document.getElementById(countdownId);
    const continueBtn = document.getElementById("ff-continue-btn") as HTMLButtonElement | null;

    const interval = setInterval(() => {
      remaining--;
      if (countdownEl) countdownEl.textContent = String(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        if (continueBtn) {
          continueBtn.disabled = false;
          continueBtn.innerHTML = "Continue →";
          continueBtn.addEventListener("click", () => handleContinue(domain));
        }
      }
    }, 1000);
  }

  function handleContinue(domain: string) {
    const dismissCheckbox = document.getElementById("ff-dismiss-today") as HTMLInputElement | null;
    if (dismissCheckbox?.checked) {
      chrome.runtime.sendMessage({ type: "DISMISS_SITE_TODAY", domain });
    }
    removeOverlay();
  }

  function removeOverlay() {
    root.remove();
    style.remove();
    document.documentElement.style.overflow = "";
  }
}

function btnStyle(bg: string, color = "#fff"): string {
  return `
    background: ${bg};
    color: ${color};
    border: none;
    border-radius: 8px;
    padding: 12px 24px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s;
    outline: none;
    font-family: inherit;
    &:hover { opacity: 0.85 }
    &:disabled { opacity: 0.4; cursor: not-allowed }
  `.replace(/\s+/g, " ");
}
