// Browser-facing save/load layer. This is the only place that touches
// localStorage, so the pure logic in state.js stays unit-testable.

import { newGame, migrate } from "./state.js";

const SAVE_KEY = "browser_game.save";
// A separate store that `clear()` deliberately leaves alone — the farm
// remembers you even after you wipe your progress. (Stage 3 narrative.)
const MEMORY_KEY = "browser_game.memory";

const EMPTY_MEMORY = { peakLifetime: 0, resets: 0 };

/** Load the saved game, or start a new one. Migrates old saves forward. */
export function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return newGame();
    return migrate(JSON.parse(raw));
  } catch {
    // Corrupt or unreadable save — start fresh rather than crashing.
    return newGame();
  }
}

/** Persist the current state. */
export function save(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or unavailable; nothing useful to do here.
  }
}

/** Clear the saved game. Intentionally leaves the memory store intact. */
export function clear() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}

/** Load the persistent memory (survives reset), or a blank record. */
export function loadMemory() {
  try {
    const raw = localStorage.getItem(MEMORY_KEY);
    if (!raw) return { ...EMPTY_MEMORY };
    return { ...EMPTY_MEMORY, ...JSON.parse(raw) };
  } catch {
    return { ...EMPTY_MEMORY };
  }
}

/** Persist the memory record. */
export function saveMemory(memory) {
  try {
    localStorage.setItem(MEMORY_KEY, JSON.stringify(memory));
  } catch {
    // ignore
  }
}
