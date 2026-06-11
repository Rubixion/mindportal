import { extractDomain, domainMatchesList } from "../shared/utils";
import type { AppStorage } from "../shared/types";

if (!document.getElementById("mp-overlay-root")) {
  main();
}

async function main() {
  const storage = await getStorage();
  if (!storage.settings.onboardingComplete) return;

  const domain = extractDomain(window.location.href);
  if (!domain) return;

  const { settings, session, dismissedToday, lastDismissedDate } = storage;

  const today = new Date().toISOString().slice(0, 10);
  const dismissed = lastDismissedDate === today ? dismissedToday : [];

  if (dismissed.includes(domain)) return;
  if (!domainMatchesList(domain, settings.unproductiveSites)) return;

  const autoBlock =
    settings.pomodoroAutoFocusMode &&
    session.pomodoroActive &&
    !session.pomodoroIsBreak;

  const mode = session.focusModeActive || autoBlock ? "block" : settings.warningMode;

  showOverlay(domain, mode, settings.countdownSeconds, session.intention, storage);
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
  intention: string,
  storage: AppStorage,
) {
  document.documentElement.style.overflow = "hidden";

  // Inject styles
  const style = document.createElement("style");
  style.textContent = `
    @keyframes mp-fade-in  { from { opacity: 0 } to { opacity: 1 } }
    @keyframes mp-slide-up { from { transform: translateY(16px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
    @keyframes mp-pulse    { 0%,100% { opacity:1 } 50% { opacity:0.6 } }
    @media (prefers-reduced-motion: reduce) {
      .mp-animated { animation: none !important; transition: none !important; }
    }
    #mp-overlay-root * { box-sizing: border-box; margin: 0; padding: 0; }
    #mp-overlay-root button:focus-visible { outline: 2px solid #6982d8; outline-offset: 2px; }
  `;
  document.head.appendChild(style);

  const root = document.createElement("div");
  root.id = "mp-overlay-root";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", "MindPortal focus reminder");
  root.setAttribute("style", `
    position: fixed;
    inset: 0;
    background: rgba(5,5,15,0.9);
    z-index: 2147483647;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    animation: mp-fade-in 0.18s ease;
  `);

  const card = document.createElement("div");
  card.className = "mp-animated";
  card.setAttribute("style", `
    background: #0f0f2a;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 14px;
    padding: 36px 40px;
    max-width: 440px;
    width: 90%;
    text-align: center;
    box-shadow: 0 20px 60px rgba(0,0,0,0.7);
    animation: mp-slide-up 0.22s cubic-bezier(0.16,1,0.3,1);
  `);

  // Build Ollie SVG inline
  const irisColor = mode === "block" ? "#f87171" : "#6982d8";
  const mouthPath = mode === "block" ? "M44 74 Q50 69 56 74" : "M44 72 Q50 76 56 72";
  const mouthColor = mode === "block" ? "#f87171" : "#6982d8";

  const ollieSvg = `
    <svg width="72" height="83" viewBox="0 0 100 115" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="margin-bottom:16px;filter:drop-shadow(0 4px 16px rgba(105,130,216,0.3))">
      <ellipse cx="50" cy="97" rx="18" ry="14" fill="#171740"/>
      <ellipse cx="31" cy="93" rx="10" ry="15" fill="#111130" transform="rotate(-12 31 93)"/>
      <ellipse cx="69" cy="93" rx="10" ry="15" fill="#111130" transform="rotate(12 69 93)"/>
      <circle cx="50" cy="54" r="28" fill="#1a1a42"/>
      <polygon points="27,37 17,8 38,28" fill="#1a1a42"/>
      <polygon points="73,37 83,8 62,28" fill="#1a1a42"/>
      <ellipse cx="50" cy="56" rx="20" ry="18" fill="#20205a"/>
      <circle cx="38" cy="51" r="10" fill="#fff"/>
      <circle cx="62" cy="51" r="10" fill="#fff"/>
      <circle cx="38" cy="51" r="6" fill="${irisColor}"/>
      <circle cx="62" cy="51" r="6" fill="${irisColor}"/>
      <circle cx="38" cy="51" r="3" fill="#05050f"/>
      <circle cx="62" cy="51" r="3" fill="#05050f"/>
      <circle cx="40" cy="49" r="1.5" fill="#fff"/>
      <circle cx="64" cy="49" r="1.5" fill="#fff"/>
      <path d="M46 62 L50 69 L54 62 Q50 60 46 62 Z" fill="#f5a623"/>
      <path d="${mouthPath}" stroke="${mouthColor}" stroke-width="2" fill="none" stroke-linecap="round"/>
      <ellipse cx="50" cy="91" rx="12" ry="8" fill="#20205a"/>
    </svg>
  `;

  const name = storage.settings.userName ? storage.settings.userName : "";

  if (mode === "block") {
    const intentionNote = intention
      ? `<p style="font-size:13px;color:rgba(105,130,216,0.8);margin-bottom:20px;line-height:1.4">
           You set out to: <em>${intention}</em>
         </p>`
      : "";

    card.innerHTML = `
      ${ollieSvg}
      <h2 style="color:rgba(255,255,255,0.92);font-size:20px;font-weight:700;margin-bottom:10px;letter-spacing:-0.02em">
        ${name ? `Hey ${name}, focus is on.` : "You're in focus mode."}
      </h2>
      <p style="color:rgba(255,255,255,0.5);font-size:14px;margin-bottom:6px">
        <strong style="color:#f87171">${domain}</strong> is blocked right now.
      </p>
      ${intentionNote}
      <p style="color:rgba(255,255,255,0.28);font-size:12px;margin-bottom:28px">
        Deactivate focus mode from MindPortal to visit this site.
      </p>
      <div style="display:flex;gap:10px;justify-content:center">
        <button id="mp-go-back" style="${btnPrimary}">← Go back</button>
        <button id="mp-queue-btn" style="${btnSecondary}" title="Open this site after your focus session ends">Open after focus</button>
      </div>
    `;
  } else {
    const countdownId = "mp-countdown-num";
    const continueId  = "mp-continue-btn";

    card.innerHTML = `
      ${ollieSvg}
      <h2 style="color:rgba(255,255,255,0.92);font-size:20px;font-weight:700;margin-bottom:10px;letter-spacing:-0.02em">
        ${name ? `${name}, just a moment.` : "Just a moment."}
      </h2>
      <p style="color:rgba(255,255,255,0.5);font-size:14px;margin-bottom:20px;line-height:1.45">
        <strong style="color:#fbbf24">${domain}</strong> is on your distraction list.
        Is this a good use of your time right now?
      </p>
      <div style="display:flex;gap:10px;justify-content:center;margin-bottom:18px">
        <button id="mp-go-back" style="${btnPrimary}">← Go back</button>
        <button id="${continueId}" style="${btnGhost}" ${mode === "countdown" ? "disabled" : ""}>
          ${mode === "countdown"
            ? `Continue in <span id="${countdownId}">${countdownSeconds}</span>s`
            : "Continue anyway"}
        </button>
      </div>
      <label style="display:inline-flex;align-items:center;gap:7px;color:rgba(255,255,255,0.32);font-size:12px;cursor:pointer">
        <input type="checkbox" id="mp-dismiss-today" style="accent-color:#6982d8"/>
        Skip warnings for ${domain} today
      </label>
    `;
  }

  root.appendChild(card);
  document.body.appendChild(root);

  // Go back
  document.getElementById("mp-go-back")?.addEventListener("click", () => {
    removeOverlay();
    history.back();
  });

  // Delay queue (block mode)
  document.getElementById("mp-queue-btn")?.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "ADD_DELAY_QUEUE", domain });
    removeOverlay();
    history.back();
  });

  // Countdown / continue (warn / countdown modes)
  if (mode === "warn") {
    document.getElementById("mp-continue-btn")?.addEventListener("click", () => handleContinue());
  } else if (mode === "countdown") {
    let remaining = countdownSeconds;
    const countdownEl = document.getElementById(countdownId);
    const continueBtn = document.getElementById(continueId) as HTMLButtonElement | null;

    const interval = setInterval(() => {
      remaining--;
      if (countdownEl) countdownEl.textContent = String(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        if (continueBtn) {
          continueBtn.disabled = false;
          continueBtn.textContent = "Continue anyway";
          continueBtn.addEventListener("click", () => handleContinue());
        }
      }
    }, 1000);
  }

  function handleContinue() {
    const cb = document.getElementById("mp-dismiss-today") as HTMLInputElement | null;
    if (cb?.checked) {
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

const btnPrimary = `
  background: #6982d8;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 10px 20px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s;
`.replace(/\s+/g, " ");

const btnSecondary = `
  background: rgba(248,113,113,0.12);
  color: #f87171;
  border: 1px solid rgba(248,113,113,0.25);
  border-radius: 8px;
  padding: 10px 20px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s;
`.replace(/\s+/g, " ");

const btnGhost = `
  background: transparent;
  color: rgba(255,255,255,0.45);
  border: 1px solid rgba(255,255,255,0.13);
  border-radius: 8px;
  padding: 10px 20px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
`.replace(/\s+/g, " ");
