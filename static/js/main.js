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
import { load, save, clear } from "./save.js";
import { format } from "./format.js";
import {
  stageFor,
  tickerLine,
  artFor,
  describeUpgrade,
  returnMessage,
} from "./narrative.js";

const TICK_MS = 1000;
const TICKER_MS = 9000;

let state = load();

// How long the player was away since their last session (seconds). Captured
// before any save re-stamps `lastSeen`. Drives the Stage 2+ return message.
const awaySeconds = state.lastSeen
  ? Math.max(0, (Date.now() - state.lastSeen) / 1000)
  : 0;

// Save, stamping the time so the next visit can tell how long they were gone.
function persist() {
  state.lastSeen = Date.now();
  save(state);
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
  resetBtn: document.getElementById("reset-btn"),
  shopList: document.getElementById("shop-list"),
  ticker: document.getElementById("ticker"),
};

// Rotate the flavor ticker on its own timer (not in render(), which runs every
// frame). The line shown depends on the player's current narrative stage.
function showTicker() {
  const stage = stageFor(state.lifetime);
  const index = Math.floor(Math.random() * 1e6);
  els.ticker.textContent = tickerLine(stage, index);
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
  const stage = stageFor(state.lifetime);

  els.chickens.textContent = format(state.chickens);
  els.perSecond.textContent = format(perSecond(state));
  els.perClick.textContent = format(perClick(state));

  // Swap the ASCII art only when the stage's frame actually changes.
  const art = artFor(stage);
  if (art !== shownArt) {
    els.chicken.textContent = art;
    shownArt = art;
  }

  for (const row of rows) {
    const id = row.upgrade.id;
    row.owned.textContent = `×${state.upgrades[id] || 0}`;
    row.btn.textContent = `Buy (${format(costOf(state, id))} 🐔)`;
    row.btn.disabled = !canAfford(state, id);
    row.desc.textContent = describeUpgrade(stage, id, row.upgrade.description);
  }
}

els.collectBtn.addEventListener("click", () => {
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
  clear();
  state = load();
  render();
});

// Idle/incremental progress.
setInterval(() => {
  state = tick(state, TICK_MS / 1000);
  persist();
  render();
}, TICK_MS);

// Rotating flavor ticker.
setInterval(showTicker, TICKER_MS);

render();

// On return after an absence, the ticker first shows the "missing" message
// (Stage 2+), then normal rotation resumes on the next interval.
const returned = returnMessage(stageFor(state.lifetime), awaySeconds);
if (returned) {
  els.ticker.textContent = returned;
  replay(els.ticker, "fade-in");
} else {
  showTicker();
}
