// Pure game-state logic. No DOM, no localStorage access in here so it stays
// unit-testable. The browser-facing save/load wrapper lives in save.js.

export const SAVE_VERSION = 1;

/** Create a fresh game state. */
export function newGame() {
  return {
    version: SAVE_VERSION,
    points: 0,
    perClick: 1,
    perSecond: 0,
  };
}

/** Apply one manual click. Returns a new state (does not mutate input). */
export function click(state) {
  return { ...state, points: state.points + state.perClick };
}

/**
 * Advance the game by `seconds` of idle/incremental progress.
 * Returns a new state.
 */
export function tick(state, seconds) {
  return { ...state, points: state.points + state.perSecond * seconds };
}

/**
 * Migrate a loaded save to the current version, filling in any missing fields.
 * Always returns a state stamped with the current SAVE_VERSION.
 */
export function migrate(save) {
  return { ...newGame(), ...save, version: SAVE_VERSION };
}
