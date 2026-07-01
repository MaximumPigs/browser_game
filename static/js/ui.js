// DOM-facing render helpers + keyboard input sampling. Impure (touches the DOM
// and window), but leans on pure modules for content and rendering.

import { renderArena as arenaToString } from "./combat.js";
import { SHOP } from "./content.js";
import { format } from "./format.js";
import { isOffered, isSoldOut, canAfford } from "./state.js";

export const show = (el) => el && el.classList.remove("hidden");
export const hide = (el) => el && el.classList.add("hidden");
export const setText = (el, t) => {
  if (el) el.textContent = t;
};

/** Render the arena grid into a <pre>. */
export function renderArenaInto(preEl, arena) {
  preEl.textContent = arenaToString(arena);
}

function costLabel(cost = {}) {
  const parts = [];
  if (cost.fish) parts.push(`${format(cost.fish)} fish`);
  if (cost.tins) parts.push(`${format(cost.tins)} tins`);
  return parts.length ? `Buy (${parts.join(" + ")})` : "Take";
}

/** (Re)build the shop list for the current state; `onBuy(id)` handles clicks. */
export function renderShop(listEl, state, onBuy) {
  listEl.textContent = "";
  for (const item of SHOP) {
    if (!isOffered(state, item)) continue;

    const li = document.createElement("li");
    li.className = "shop-item";

    const info = document.createElement("div");
    info.className = "shop-item-info";
    const name = document.createElement("span");
    name.className = "shop-item-name";
    name.textContent = item.name;
    const desc = document.createElement("span");
    desc.className = "shop-item-desc";
    desc.textContent = item.desc;
    info.append(name, desc);

    const owned = document.createElement("span");
    owned.className = "shop-item-owned";
    const soldOut = isSoldOut(state, item);
    if (item.once) owned.textContent = soldOut ? "owned" : "";
    else owned.textContent = state.bought[item.id] ? `×${state.bought[item.id]}` : "";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = soldOut ? "owned" : costLabel(item.cost);
    btn.disabled = soldOut || !canAfford(state, item);
    btn.addEventListener("click", () => onBuy(item.id));

    li.append(info, owned, btn);
    listEl.append(li);
  }
}

// --- Keyboard input ---------------------------------------------------------

function mapKey(e) {
  switch (e.key) {
    case "ArrowUp":
    case "w":
    case "W":
      return "up";
    case "ArrowDown":
    case "s":
    case "S":
      return "down";
    case "ArrowLeft":
    case "a":
    case "A":
      return "left";
    case "ArrowRight":
    case "d":
    case "D":
      return "right";
    case " ":
    case "j":
    case "J":
      return "attack";
    case "Shift":
    case "k":
    case "K":
      return "block";
    case "l":
    case "L":
      return "throw";
    case "h":
    case "H":
      return "tonic";
    default:
      return null;
  }
}

/**
 * Keyboard sampler. Only records/prevents-default while `active` (i.e. during
 * combat), so it never fights the rest of the page. `snapshot()` returns held
 * movement/attack/block plus edge-triggered throw/tonic (cleared each call).
 */
export function createInput(target = window) {
  let active = false;
  const held = new Set();
  const edges = new Set();

  const onDown = (e) => {
    if (!active) return;
    const k = mapKey(e);
    if (!k) return;
    e.preventDefault();
    if (!held.has(k)) edges.add(k);
    held.add(k);
  };
  const onUp = (e) => {
    if (!active) return;
    const k = mapKey(e);
    if (k) held.delete(k);
  };
  target.addEventListener("keydown", onDown);
  target.addEventListener("keyup", onUp);

  return {
    setActive(v) {
      active = v;
      held.clear();
      edges.clear();
    },
    snapshot() {
      const dx = (held.has("right") ? 1 : 0) - (held.has("left") ? 1 : 0);
      const dy = (held.has("down") ? 1 : 0) - (held.has("up") ? 1 : 0);
      const snap = {
        move: dx || dy ? { dx, dy } : null,
        attack: held.has("attack"),
        block: held.has("block"),
        throw: edges.has("throw"),
        tonic: edges.has("tonic"),
      };
      edges.clear();
      return snap;
    },
  };
}
