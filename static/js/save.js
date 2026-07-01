// The only module that touches localStorage. Keeps persistence out of the pure
// game logic.

import { newGame, migrate } from "./state.js";

const SAVE_KEY = "fishbox.save";

/** Load the saved game (migrated), or a new one. Never throws. */
export function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return newGame();
    return migrate(JSON.parse(raw));
  } catch {
    // Corrupt/unreadable — start fresh rather than crash.
    return newGame();
  }
}

/** Persist the current state. */
export function save(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // Storage full/unavailable; nothing useful to do.
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
