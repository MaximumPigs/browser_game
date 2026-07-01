// DOM-facing render helpers + keyboard input sampling. Impure (touches the DOM
// and window), but leans on pure modules for content and rendering.

import { arenaCells } from "./combat.js";
import { SHOP } from "./content.js";
import { format } from "./format.js";
import { isOffered, isSoldOut, canAfford } from "./state.js";

export const show = (el) => el && el.classList.remove("hidden");
export const hide = (el) => el && el.classList.add("hidden");
export const setText = (el, t) => {
  if (el) el.textContent = t;
};

/** Size a grid element to the arena's dimensions (columns via CSS var --cell). */
export function setupArenaGrid(gridEl, arena) {
  gridEl.style.gridTemplateColumns = `repeat(${arena.width}, var(--cell))`;
  gridEl.style.gridTemplateRows = `repeat(${arena.height}, var(--cell))`;
}

/**
 * Render the arena into a grid of <span> cells (created once, updated in place).
 * Steady state only — transient hit/strike effects go through spawnFx().
 */
export function renderArenaInto(gridEl, arena) {
  const w = arena.width;
  const h = arena.height;
  if (gridEl._w !== w || gridEl._h !== h) {
    setupArenaGrid(gridEl, arena);
    gridEl.textContent = "";
    const cells = [];
    for (let i = 0; i < w * h; i++) {
      const s = document.createElement("span");
      s.className = "cell";
      gridEl.append(s);
      cells.push(s);
    }
    gridEl._cells = cells;
    gridEl._w = w;
    gridEl._h = h;
  }
  const grid = arenaCells(arena);
  const cells = gridEl._cells;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = grid[y][x];
      const el = cells[y * w + x];
      el.textContent = c.glyph;
      let cls = "cell k-" + c.kind;
      if (c.aim) cls += " aim";
      if (c.telegraph) cls += " telegraph";
      if (c.blocking) cls += " blocking";
      if (c.winding) cls += " winding";
      el.className = cls;
    }
  }
}

/**
 * Spawn transient, self-removing effect glyphs over the arena (a separate grid
 * overlay so the steady renderer never clobbers them). Returns true if the
 * player was struck this frame (so the caller can shake the stage).
 */
export function spawnFx(fxEl, arena, events) {
  if (fxEl._w !== arena.width) {
    setupArenaGrid(fxEl, arena);
    fxEl._w = arena.width;
  }
  const put = (x, y, text, cls) => {
    const s = document.createElement("span");
    s.className = "fx " + cls;
    s.textContent = text;
    s.style.gridColumn = x + 1;
    s.style.gridRow = y + 1;
    fxEl.append(s);
    s.addEventListener("animationend", () => s.remove(), { once: true });
  };
  let playerHit = false;
  for (const ev of events) {
    if (ev.type === "strike") put(ev.x, ev.y, "✳", "fx-strike");
    else if (ev.type === "hit" && ev.target === "enemy") put(ev.x, ev.y, `-${ev.dmg}`, "fx-dmg");
    else if (ev.type === "hit" && ev.target === "player") {
      put(ev.x, ev.y, `-${ev.dmg}`, "fx-dmg-player");
      playerHit = true;
    } else if (ev.type === "blocked") {
      const p = arena.player;
      put(p.x + p.facing.dx, p.y + p.facing.dy, "✦", "fx-block");
    } else if (ev.type === "death") put(ev.x, ev.y, "✖", "fx-death");
  }
  return playerHit;
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
