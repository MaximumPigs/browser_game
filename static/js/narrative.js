// Narrative / "perception" layer. Pure and unit-tested — no DOM, no time,
// no randomness in here (callers pass an index in).
//
// Design note: the story is an UNRELIABLE NARRATOR. Nothing about the farm
// actually changes — every later-stage distortion (rotting ticker, corrupted
// art, the game seeming to "know" things) is the player's own mind coming
// apart. The voice you read is the player's perception, not the world.
//
// Stage is driven by `lifetime` (total chickens ever collected): the deeper
// they get, the further gone they are. Stages 0-1 have content; higher stages
// reuse the lines unlocked so far until their own content is written.

export const STAGES = [
  { id: 0, minLifetime: 0 },
  { id: 1, minLifetime: 1_000 },
  { id: 2, minLifetime: 10_000 },
  { id: 3, minLifetime: 75_000 },
  { id: 4, minLifetime: 500_000 },
  { id: 5, minLifetime: 2_000_000 },
];

/** Which narrative stage a player at `lifetime` total chickens is in. */
export function stageFor(lifetime) {
  let stage = 0;
  for (const s of STAGES) {
    if ((lifetime || 0) >= s.minLifetime) stage = s.id;
  }
  return stage;
}

// Flavor lines shown in the rotating ticker. Keyed by the stage that *adds*
// them; the visible pool is cumulative (see tickerPool), so earlier lines keep
// surfacing as new ones creep in. That mix is deliberate: a mind coming apart
// still has lucid moments, and the lucid farmer still has intrusive thoughts.
export const TICKERS = {
  // Stage 0 — wholesome on its face. A couple of lines are only ominous in
  // hindsight ("You could do this forever.") — deniable now, foreshadowing.
  0: [
    "The hens are happy today.",
    "Sunlight warms the fresh straw.",
    "A gentle clucking fills the yard.",
    "The flock follows you to the fence.",
    "Everything is calm on the farm.",
    "You could do this forever.",
    "There's always room for one more.",
  ],
  // Stage 1 — first cracks. Each line is individually deniable (tiredness, a
  // quirky thought), but they're about the *farmer*, not the farm: memory,
  // perception, compulsion, lost time. The narrator is starting to slip.
  1: [
    "You've collected more than you could ever eat.",
    "Where do they all go?",
    "You don't quite remember starting.",
    "The clucking almost sounds like words.",
    "Your hand keeps moving after you stop.",
  ],
};

/**
 * The cumulative pool of ticker lines visible at `stage`: every line unlocked
 * by stages 0..stage, in order (so index 0 is always the first Stage 0 line).
 * Stages with no new lines simply reuse what's unlocked so far.
 */
export function tickerPool(stage) {
  const pool = [];
  for (let s = 0; s <= stage; s++) {
    if (TICKERS[s]) pool.push(...TICKERS[s]);
  }
  return pool.length ? pool : TICKERS[0];
}

/**
 * Pick a ticker line for the given stage. `index` selects which line (wraps
 * around, and tolerates negatives); randomness/timing live in the caller so
 * this stays pure.
 */
export function tickerLine(stage, index) {
  const lines = tickerPool(stage);
  const i = ((index % lines.length) + lines.length) % lines.length;
  return lines[i];
}

// --- ASCII art ---------------------------------------------------------------

// The chicken is the same drawing at every stage; only details rot. `eye` is
// the one knob Stage 2 turns: the friendly "o" becomes a dark, fixed "●".
const chickenArt = (eye) =>
  [
    "",
    "        _",
    "      _( )_",
    `     ( ${eye}   )>`,
    "      (___)",
    "      /   \\",
    "     |     |",
    "     '-----'",
    "",
  ].join("\n");

// Art keyed by the stage that introduces a new frame. Resolved cumulatively by
// artFor (latest frame at-or-below the current stage wins).
export const ART = {
  0: chickenArt("o"),
  2: chickenArt("●"), // the eye stops looking back the same way
};

/** The chicken art to show at `stage` (most recent frame at or below it). */
export function artFor(stage) {
  for (let s = stage; s >= 0; s--) {
    if (ART[s]) return ART[s];
  }
  return ART[0];
}

// --- Upgrade descriptions ----------------------------------------------------

// Per-stage overrides for upgrade descriptions, keyed by stage then upgrade id.
// Stage 2 keeps the cheerful names but the descriptions gain a second reading —
// confinement, control, things better not said. Still ostensibly about poultry.
export const UPGRADE_DESCRIPTIONS = {
  2: {
    feed: "They're hungrier than they used to be.",
    coop: "Easier to keep them where you can see them.",
    rooster: "He keeps the others from leaving.",
    barn: "So much room. No one would hear.",
  },
};

/**
 * The description to show for upgrade `id` at `stage`, falling back to
 * `fallback` (the upgrade's own default) when no override applies.
 */
export function describeUpgrade(stage, id, fallback) {
  for (let s = stage; s >= 0; s--) {
    if (UPGRADE_DESCRIPTIONS[s] && UPGRADE_DESCRIPTIONS[s][id]) {
      return UPGRADE_DESCRIPTIONS[s][id];
    }
  }
  return fallback;
}

// --- Return ("while you were away") message ----------------------------------

/** How many chickens the player imagines went missing while away. */
export function missingCount(elapsedSeconds) {
  return Math.min(99, Math.max(1, Math.floor(elapsedSeconds / 60)));
}

/**
 * Message shown when the player returns after an absence — null when it
 * shouldn't fire (before Stage 2, or after only a brief gap). The "missing"
 * chickens are imagined: the count never actually leaves the save.
 */
export function returnMessage(stage, elapsedSeconds) {
  if (stage < 2 || elapsedSeconds < 60) return null;
  return `While you were away, ${missingCount(elapsedSeconds)} went missing.`;
}
