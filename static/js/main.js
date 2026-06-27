// DOM wiring: connects the pure game logic (state.js) and the save layer
// (save.js) to the page. Keep this file thin — game rules live in state.js.

import { click, tick } from "./state.js";
import { load, save, clear } from "./save.js";

const TICK_MS = 1000;

let state = load();

const els = {
  points: document.getElementById("points"),
  perSecond: document.getElementById("per-second"),
  perClick: document.getElementById("per-click"),
  clickBtn: document.getElementById("click-btn"),
  resetBtn: document.getElementById("reset-btn"),
};

function render() {
  els.points.textContent = Math.floor(state.points);
  els.perSecond.textContent = state.perSecond;
  els.perClick.textContent = state.perClick;
}

els.clickBtn.addEventListener("click", () => {
  state = click(state);
  save(state);
  render();
});

els.resetBtn.addEventListener("click", () => {
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
