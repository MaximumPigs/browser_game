// Pure game-state logic for the chicken farm. No DOM, no localStorage access
// in here so it stays unit-testable. The browser-facing save/load wrapper
// lives in save.js.

export const SAVE_VERSION = 3;

// Upgrade catalogue. Each upgrade can be bought repeatedly; its cost grows
// geometrically with how many you already own.
//   perClick:   extra chickens gained per manual collect
//   perSecond:  extra chickens gained automatically each second
export const UPGRADES = [
  {
    id: "feed",
    name: "Better Feed",
    description: "Healthier hens. +1 chicken per collect.",
    baseCost: 10,
    growth: 1.15,
    perClick: 1,
    perSecond: 0,
  },
  {
    id: "coop",
    name: "Chicken Coop",
    description: "A cozy coop. +1 chicken every second.",
    baseCost: 25,
    growth: 1.15,
    perClick: 0,
    perSecond: 1,
  },
  {
    id: "rooster",
    name: "Rooster",
    description: "Keeps the flock growing. +5 chickens every second.",
    baseCost: 300,
    growth: 1.2,
    perClick: 0,
    perSecond: 5,
  },
  {
    id: "barn",
    name: "Big Barn",
    description: "Room to roam. +25 chickens every second.",
    baseCost: 2000,
    growth: 1.25,
    perClick: 0,
    perSecond: 25,
  },
];

const UPGRADES_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

/** Create a fresh game state. */
export function newGame() {
  return {
    version: SAVE_VERSION,
    chickens: 0,
    // Total chickens ever collected (never spent down). Drives long-term
    // progression; intentionally separate from the spendable `chickens`.
    lifetime: 0,
    upgrades: Object.fromEntries(UPGRADES.map((u) => [u.id, 0])),
  };
}

/** Chickens gained per manual collect, including upgrade bonuses. */
export function perClick(state) {
  return UPGRADES.reduce(
    (total, u) => total + u.perClick * (state.upgrades[u.id] || 0),
    1, // base: 1 chicken per click
  );
}

/** Chickens gained automatically each second from upgrades. */
export function perSecond(state) {
  return UPGRADES.reduce(
    (total, u) => total + u.perSecond * (state.upgrades[u.id] || 0),
    0,
  );
}

/** Current cost to buy one more of the given upgrade. */
export function costOf(state, id) {
  const u = UPGRADES_BY_ID[id];
  const owned = state.upgrades[id] || 0;
  return Math.floor(u.baseCost * Math.pow(u.growth, owned));
}

/** Whether the player can currently afford the given upgrade. */
export function canAfford(state, id) {
  return state.chickens >= costOf(state, id);
}

/** Apply one manual collect. Returns a new state (does not mutate input). */
export function click(state) {
  const gain = perClick(state);
  return {
    ...state,
    chickens: state.chickens + gain,
    lifetime: (state.lifetime || 0) + gain,
  };
}

/**
 * Advance the game by `seconds` of idle/incremental progress.
 * Returns a new state.
 */
export function tick(state, seconds) {
  const gain = perSecond(state) * seconds;
  return {
    ...state,
    chickens: state.chickens + gain,
    lifetime: (state.lifetime || 0) + gain,
  };
}

/**
 * Buy one of the given upgrade if affordable. Returns a new state; if the
 * player can't afford it (or the id is unknown) the state is returned
 * unchanged.
 */
export function buy(state, id) {
  if (!UPGRADES_BY_ID[id] || !canAfford(state, id)) return state;
  return {
    ...state,
    chickens: state.chickens - costOf(state, id),
    upgrades: { ...state.upgrades, [id]: (state.upgrades[id] || 0) + 1 },
  };
}

/**
 * Migrate a loaded save to the current version, filling in any missing fields
 * (including newly added upgrades). Always returns a state stamped with the
 * current SAVE_VERSION.
 */
export function migrate(save) {
  const fresh = newGame();
  return {
    ...fresh,
    ...save,
    // v1 saves used `points`; carry them over to `chickens`.
    chickens: save.chickens ?? save.points ?? 0,
    // Older saves predate lifetime tracking; seed it from current balance so
    // returning players don't snap back to the very start of progression.
    lifetime: save.lifetime ?? save.chickens ?? save.points ?? 0,
    upgrades: { ...fresh.upgrades, ...(save.upgrades || {}) },
    version: SAVE_VERSION,
  };
}
