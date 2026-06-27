// Browser-facing save/load layer. This is the only place that touches
// localStorage, so the pure logic in state.js stays unit-testable.

import { newGame, migrate } from "./state.js";

const SAVE_KEY = "browser_game.save";

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

/** Clear the saved game. */
export function clear() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}
