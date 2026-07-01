// Pure game-state logic. No DOM, no localStorage, no Date/Math.random.
// The browser-facing save wrapper lives in save.js; timing/RNG live in main.js.

import { CONFIG, SHOP } from "./content.js";

export const SAVE_VERSION = 1;

const SHOP_BY_ID = Object.fromEntries(SHOP.map((i) => [i.id, i]));

/** A fresh game. */
export function newGame() {
  return {
    version: SAVE_VERSION,
    fish: 0,
    tins: 0,
    fishRateBonus: 0, // added to base fish/sec by shop items
    autoCanRate: 0, // automatic cans/sec (post-Cannery)
    weapon: null, // { id, name, attack, attackCdMs }
    armour: null, // { id, name, maxHp, defense }
    inv: { tonic: 0 }, // consumables
    bought: {}, // itemId -> true (once) or count (repeatable)
    flags: {
      eatRevealed: false,
      shopRevealed: false,
      pierPrompt: false, // pier button visible (after first weapon)
      adventureUnlocked: false, // Adventure tab visible (after walking the pier)
      canneryUnlocked: false, // "Can (10) fish" available (story reward)
      docksCleared: false,
    },
    stats: { eats: 0 },
  };
}

// Shallow-deep clone of the mutable state shape (enough to keep returns pure).
function clone(s) {
  return {
    ...s,
    inv: { ...s.inv },
    bought: { ...s.bought },
    flags: { ...s.flags },
    stats: { ...s.stats },
    weapon: s.weapon ? { ...s.weapon } : null,
    armour: s.armour ? { ...s.armour } : null,
  };
}

/** Fish gained per second, including shop bonuses. */
export function fishPerSec(state) {
  return CONFIG.baseFishPerSec + (state.fishRateBonus || 0);
}

/**
 * Advance the game by `seconds`. Accrues fish, flips reveal flags at their
 * thresholds, and runs any automatic canning (bounded by available fish).
 */
export function tick(state, seconds) {
  const s = clone(state);
  s.fish += fishPerSec(s) * seconds;

  if (s.fish >= CONFIG.revealEatAt) s.flags.eatRevealed = true;
  if (s.fish >= CONFIG.revealShopAt) s.flags.shopRevealed = true;

  if (s.flags.canneryUnlocked && s.autoCanRate > 0) {
    const cans = Math.min(s.autoCanRate * seconds, s.fish / CONFIG.canCostFish);
    if (cans > 0) {
      s.fish -= cans * CONFIG.canCostFish;
      s.tins += cans * CONFIG.canYieldTins;
    }
  }
  return s;
}

/** Manually can 10 fish into 1 tin. No-op if locked or unaffordable. */
export function canFish(state) {
  if (!state.flags.canneryUnlocked) return state;
  if (state.fish < CONFIG.canCostFish) return state;
  const s = clone(state);
  s.fish -= CONFIG.canCostFish;
  s.tins += CONFIG.canYieldTins;
  return s;
}

/** Eat all fish (a joke). Resets fish to 0 and counts the shame. */
export function eatAllFish(state) {
  const s = clone(state);
  s.fish = 0;
  s.stats.eats += 1;
  return s;
}

/** Whether an item is offered (its requiresFlag, if any, is set). */
export function isOffered(state, item) {
  return !item.requiresFlag || !!state.flags[item.requiresFlag];
}

/** Whether a once-item has already been bought. */
export function isSoldOut(state, item) {
  return !!item.once && !!state.bought[item.id];
}

/** Whether the player can currently afford `item`. */
export function canAfford(state, item) {
  const c = item.cost || {};
  return (state.fish >= (c.fish || 0)) && (state.tins >= (c.tins || 0));
}

/**
 * Buy a shop item by id. Applies its declarative effect. Returns the state
 * unchanged if the item is unknown, not offered, sold out, or unaffordable.
 */
export function buyItem(state, id) {
  const item = SHOP_BY_ID[id];
  if (!item) return state;
  if (!isOffered(state, item) || isSoldOut(state, item) || !canAfford(state, item)) {
    return state;
  }

  const s = clone(state);
  const c = item.cost || {};
  s.fish -= c.fish || 0;
  s.tins -= c.tins || 0;

  const e = item.effect || {};
  if (e.fishRate) s.fishRateBonus += e.fishRate;
  if (e.autoCanRate) s.autoCanRate += e.autoCanRate;
  if (e.weapon) {
    s.weapon = { ...e.weapon };
    if (!s.flags.pierPrompt) s.flags.pierPrompt = true; // first weapon → pier beat
  }
  if (e.armour) s.armour = { ...e.armour };
  if (e.consumable) {
    for (const [k, v] of Object.entries(e.consumable)) {
      s.inv[k] = (s.inv[k] || 0) + v;
    }
  }

  if (item.once) s.bought[id] = true;
  else s.bought[id] = (s.bought[id] || 0) + 1;

  return s;
}

/** Walk to the end of the pier — reveals the Adventure tab. */
export function walkPier(state) {
  if (!state.flags.pierPrompt) return state;
  const s = clone(state);
  s.flags.adventureUnlocked = true;
  return s;
}

/**
 * Apply a quest reward: grant fish, set an unlock flag (e.g. canneryUnlocked)
 * and/or a "cleared" flag. This is how core systems are earned diegetically.
 */
export function applyReward(state, reward = {}) {
  const s = clone(state);
  if (reward.fish) s.fish += reward.fish;
  if (reward.unlockFlag) s.flags[reward.unlockFlag] = true;
  if (reward.clearsFlag) s.flags[reward.clearsFlag] = true;
  return s;
}

/** Reconcile consumables spent during a combat run. */
export function afterCombat(state, { tinsUsed = 0, tonicsUsed = 0 } = {}) {
  const s = clone(state);
  s.tins = Math.max(0, s.tins - tinsUsed);
  s.inv.tonic = Math.max(0, (s.inv.tonic || 0) - tonicsUsed);
  return s;
}

/** Bring an older/partial save up to the current shape. */
export function migrate(save) {
  const fresh = newGame();
  const s = save && typeof save === "object" ? save : {};
  return {
    ...fresh,
    ...s,
    inv: { ...fresh.inv, ...(s.inv || {}) },
    bought: { ...fresh.bought, ...(s.bought || {}) },
    flags: { ...fresh.flags, ...(s.flags || {}) },
    stats: { ...fresh.stats, ...(s.stats || {}) },
    weapon: s.weapon || null,
    armour: s.armour || null,
    version: SAVE_VERSION,
  };
}
