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

const TICK_MS = 1000;

let state = load();

const els = {
  chickens: document.getElementById("chickens"),
  perSecond: document.getElementById("per-second"),
  perClick: document.getElementById("per-click"),
  collectBtn: document.getElementById("collect-btn"),
  resetBtn: document.getElementById("reset-btn"),
  shopList: document.getElementById("shop-list"),
};

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
    state = buy(state, u.id);
    save(state);
    render();
  });

  li.append(info, owned, btn);
  els.shopList.append(li);
  return { upgrade: u, owned, btn };
});

function render() {
  els.chickens.textContent = Math.floor(state.chickens);
  els.perSecond.textContent = perSecond(state);
  els.perClick.textContent = perClick(state);

  for (const row of rows) {
    const id = row.upgrade.id;
    row.owned.textContent = `×${state.upgrades[id] || 0}`;
    row.btn.textContent = `Buy (${costOf(state, id)} 🐔)`;
    row.btn.disabled = !canAfford(state, id);
  }
}

els.collectBtn.addEventListener("click", () => {
  state = click(state);
  save(state);
  render();
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
