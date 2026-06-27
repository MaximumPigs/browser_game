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

const TICK_MS = 1000;

let state = load();

const els = {
  chickens: document.getElementById("chickens"),
  perSecond: document.getElementById("per-second"),
  perClick: document.getElementById("per-click"),
  collectBtn: document.getElementById("collect-btn"),
  collectArea: document.querySelector(".collect-area"),
  chicken: document.getElementById("chicken"),
  resetBtn: document.getElementById("reset-btn"),
  shopList: document.getElementById("shop-list"),
};

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
  info.innerHTML =
    `<span class="upgrade-name">${u.name}</span>` +
    `<span class="upgrade-desc">${u.description}</span>`;

  const owned = document.createElement("span");
  owned.className = "upgrade-owned";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.addEventListener("click", () => {
    const before = state.upgrades[u.id] || 0;
    state = buy(state, u.id);
    save(state);
    render();
    // Only celebrate if the purchase actually went through.
    if ((state.upgrades[u.id] || 0) > before) {
      spawnFloat(li, effectLabel(u));
      replay(btn, "pop");
    }
  });

  li.append(info, owned, btn);
  els.shopList.append(li);
  return { upgrade: u, owned, btn };
});

function render() {
  els.chickens.textContent = format(state.chickens);
  els.perSecond.textContent = format(perSecond(state));
  els.perClick.textContent = format(perClick(state));

  for (const row of rows) {
    const id = row.upgrade.id;
    row.owned.textContent = `×${state.upgrades[id] || 0}`;
    row.btn.textContent = `Buy (${format(costOf(state, id))} 🐔)`;
    row.btn.disabled = !canAfford(state, id);
  }
}

els.collectBtn.addEventListener("click", () => {
  const gain = perClick(state);
  state = click(state);
  save(state);
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
  save(state);
  render();
}, TICK_MS);

render();
