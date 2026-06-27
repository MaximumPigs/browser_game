// DOM wiring: connects the pure game logic (state.js) and the save layer
// (save.js) to the page. Keep this file thin — game rules live in state.js.

import {
  UPGRADES,
  click,
  tick,
  buy,
  costOf,
  canAfford,
  perClick,
  perSecond,
} from "./state.js";
import { load, save, clear, loadMemory, saveMemory } from "./save.js";
import { format } from "./format.js";
import {
  stageFor,
  tickerLine,
  artFor,
  describeUpgrade,
  returnMessage,
  nightLine,
  idleLine,
  collectFlicker,
  resetGreeting,
  glitchArt,
  counterLabel,
  pageTitle,
  isEnding,
  ENDING,
} from "./narrative.js";

const TICK_MS = 1000;
const TICKER_MS = 9000;
const GLITCH_MS = 6000; // how often we *consider* a one-frame art glitch
const FLICKER_MS = 7000; // how often we *consider* a collect-button flicker

let state = load();

// Persistent memory that survives Reset (Stage 3 "it remembers you").
let memory = loadMemory();

// Loading a save is itself a high-water mark — record it immediately so the
// memory reflects this run even before the first tick, and so an instant Reset
// still remembers the flock.
if ((state.lifetime || 0) > (memory.peakLifetime || 0)) {
  memory.peakLifetime = state.lifetime;
  saveMemory(memory);
}

// The effective stage never drops below what the player has already reached,
// even after a Reset — the madness doesn't wipe with the save.
function currentStage() {
  return stageFor(Math.max(state.lifetime || 0, memory.peakLifetime || 0));
}

// Time of the player's last manual interaction, for idle-aware lines.
let lastActivity = Date.now();
const idleSeconds = () => (Date.now() - lastActivity) / 1000;

// How long the player was away since their last session (seconds). Captured
// before any save re-stamps `lastSeen`. Drives the Stage 2+ return message.
const awaySeconds = state.lastSeen
  ? Math.max(0, (Date.now() - state.lastSeen) / 1000)
  : 0;

// Save, stamping the time so the next visit can tell how long they were gone,
// and recording the high-water mark in the memory that outlives Reset.
function persist() {
  state.lastSeen = Date.now();
  save(state);
  if ((state.lifetime || 0) > (memory.peakLifetime || 0)) {
    memory.peakLifetime = state.lifetime;
    saveMemory(memory);
  }
}

// Cache the last art frame applied so render() only touches the DOM on change.
let shownArt = null;

const els = {
  chickens: document.getElementById("chickens"),
  perSecond: document.getElementById("per-second"),
  perClick: document.getElementById("per-click"),
  collectBtn: document.getElementById("collect-btn"),
  collectArea: document.querySelector(".collect-area"),
  chicken: document.getElementById("chicken"),
  chickenLabel: document.getElementById("chicken-label"),
  resetBtn: document.getElementById("reset-btn"),
  shopList: document.getElementById("shop-list"),
  ticker: document.getElementById("ticker"),
};

// Rotate the flavor ticker on its own timer (not in render(), which runs every
// frame). The line shown depends on the player's current narrative stage; from
// Stage 3 the game sometimes "knows" the hour or that you've gone quiet.
function showTicker() {
  const stage = currentStage();
  const index = Math.floor(Math.random() * 1e6);

  let line = null;
  if (stage >= 3 && Math.random() < 0.5) {
    line =
      idleLine(idleSeconds(), index) ||
      nightLine(new Date().getHours(), index);
  }

  els.ticker.textContent = line || tickerLine(stage, index);
  replay(els.ticker, "fade-in");
}

// Spawn a rising, fading bit of text anchored inside `container`
// (which must be position: relative).
function spawnFloat(container, text) {
  const el = document.createElement("span");
  el.className = "float-num";
  el.textContent = text;
  // Spread successive floats horizontally so rapid clicks don't overlap.
  el.style.marginLeft = `${Math.round((Math.random() - 0.5) * 40)}px`;
  container.append(el);
  el.addEventListener("animationend", () => el.remove(), { once: true });
}

// Short label describing what an upgrade adds, for purchase feedback.
function effectLabel(u) {
  if (u.perClick) return `+${u.perClick}/collect`;
  if (u.perSecond) return `+${u.perSecond}/sec`;
  return "bought!";
}

// Restart a one-shot animation by toggling its class.
function replay(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth; // force reflow so the animation can re-trigger
  el.classList.add(cls);
}

// Build the shop once; cache each row's elements so render() only updates text
// and the disabled state rather than rebuilding the DOM every frame.
const rows = UPGRADES.map((u) => {
  const li = document.createElement("li");
  li.className = "upgrade";

  const info = document.createElement("div");
  info.className = "upgrade-info";

  const name = document.createElement("span");
  name.className = "upgrade-name";
  name.textContent = u.name;

  const desc = document.createElement("span");
  desc.className = "upgrade-desc";
  desc.textContent = u.description;

  info.append(name, desc);

  const owned = document.createElement("span");
  owned.className = "upgrade-owned";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.addEventListener("click", () => {
    const before = state.upgrades[u.id] || 0;
    state = buy(state, u.id);
    persist();
    render();
    // Only celebrate if the purchase actually went through.
    if ((state.upgrades[u.id] || 0) > before) {
      spawnFloat(li, effectLabel(u));
      replay(btn, "pop");
    }
  });

  li.append(info, owned, btn);
  els.shopList.append(li);
  return { upgrade: u, owned, btn, desc };
});

function render() {
  const stage = currentStage();
  const label = counterLabel(stage);

  els.chickens.textContent = format(state.chickens);
  els.perSecond.textContent = format(perSecond(state));
  els.perClick.textContent = format(perClick(state));
  els.chickenLabel.textContent = label;
  document.title = pageTitle(stage);

  // Swap the ASCII art only when the stage's frame actually changes.
  const art = artFor(stage);
  if (art !== shownArt) {
    els.chicken.textContent = art;
    shownArt = art;
  }

  for (const row of rows) {
    const id = row.upgrade.id;
    row.owned.textContent = `×${state.upgrades[id] || 0}`;
    row.btn.textContent = `Buy (${format(costOf(state, id))} ${label})`;
    row.btn.disabled = !canAfford(state, id);
    row.desc.textContent = describeUpgrade(stage, id, row.upgrade.description);
  }

  if (isEnding(stage)) triggerEnding();
}

// The ending: a quiet, one-line-at-a-time takeover. Plays once per page load;
// dismissing it drops the player back into the (still corrupted) game, because
// the compulsion doesn't end — that's the point.
let endingPlaying = false;
function triggerEnding() {
  if (endingPlaying) return;
  endingPlaying = true;

  const overlay = document.createElement("div");
  overlay.className = "ending";
  const lineEl = document.createElement("p");
  lineEl.className = "ending-line";
  overlay.append(lineEl);
  document.body.append(overlay);
  replay(overlay, "fade-in");

  let i = 0;
  (function nextLine() {
    if (i < ENDING.length) {
      lineEl.textContent = ENDING[i];
      replay(lineEl, "fade-in-slow");
      i += 1;
      setTimeout(nextLine, 3600);
    } else {
      // Rest on the final line, then offer the only way forward: to continue.
      const again = document.createElement("button");
      again.type = "button";
      again.className = "ending-again";
      again.textContent = "Collect";
      again.addEventListener("click", () => {
        overlay.remove();
        endingPlaying = false;
      });
      overlay.append(again);
      replay(again, "fade-in-slow");
    }
  })();
}

els.collectBtn.addEventListener("click", () => {
  lastActivity = Date.now();
  const gain = perClick(state);
  state = click(state);
  persist();
  render();
  spawnFloat(els.collectArea, `+${format(gain)}`);
  replay(els.chicken, "wiggle");
  replay(els.collectBtn, "pop");
});

els.resetBtn.addEventListener("click", () => {
  if (!confirm("Reset your farm? This clears all progress.")) return;
  // The flock is forgotten; the memory of it is not.
  memory.resets = (memory.resets || 0) + 1;
  saveMemory(memory);
  clear();
  state = load();
  render();
  // The wipe should feel clean — until it doesn't.
  const greeting = resetGreeting(
    currentStage(),
    memory.peakLifetime,
    memory.resets,
  );
  if (greeting) {
    els.ticker.textContent = greeting;
    replay(els.ticker, "fade-in");
  }
});

// Idle/incremental progress.
setInterval(() => {
  state = tick(state, TICK_MS / 1000);
  persist();
  render();
}, TICK_MS);

// Rotating flavor ticker.
setInterval(showTicker, TICKER_MS);

// Occasional one-frame ASCII glitch (Stage 2+): nudge a few lines out of
// alignment, then snap back. Random offsets each time so it never repeats.
function maybeGlitch() {
  if (currentStage() < 2 || Math.random() > 0.5) return;
  const base = artFor(currentStage());
  const offsets = base.split("\n").map(() => {
    if (Math.random() > 0.4) return 0; // most lines stay put
    return (Math.random() < 0.5 ? -1 : 1) * (1 + Math.floor(Math.random() * 2));
  });
  els.chicken.textContent = glitchArt(base, offsets);
  // Restore to the true frame next frame; render() can't fight us because
  // shownArt still matches the real art.
  setTimeout(() => {
    els.chicken.textContent = artFor(currentStage());
  }, 110);
}
setInterval(maybeGlitch, GLITCH_MS);

// Occasional collect-button flicker (Stage 3+): a verb of compulsion flashes
// over the friendly label, then reverts.
const COLLECT_LABEL = "Collect a chicken";
function maybeFlicker() {
  if (currentStage() < 3 || Math.random() > 0.45) return;
  const alt = collectFlicker(currentStage(), Math.floor(Math.random() * 1e6));
  if (!alt) return;
  els.collectBtn.textContent = alt;
  setTimeout(() => {
    els.collectBtn.textContent = COLLECT_LABEL;
  }, 300);
}
setInterval(maybeFlicker, FLICKER_MS);

render();

// First ticker line on load. A post-Reset return ("we remember you") wins over
// the "while you were away" message, which wins over a normal flavor line.
const greeting =
  resetGreeting(currentStage(), memory.peakLifetime, memory.resets) ||
  returnMessage(currentStage(), awaySeconds);
if (greeting) {
  els.ticker.textContent = greeting;
  replay(els.ticker, "fade-in");
} else {
  showTicker();
}
