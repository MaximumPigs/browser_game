// Narrative / "perception" layer. Pure and unit-tested — no DOM, no time,
// no randomness in here (callers pass an index in).
//
// Design note: the story is an UNRELIABLE NARRATOR. Nothing about the farm
// actually changes — every later-stage distortion (rotting ticker, corrupted
// art, the game seeming to "know" things) is the player's own mind coming
// apart. The voice you read is the player's perception, not the world.
//
import { format } from "./format.js";

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
  // Stage 3 — it addresses you directly. No more deniability: the narrator
  // watches itself from outside and doesn't like what it sees. (Stage 2 adds
  // no new ticker lines; its horror is visual.)
  3: [
    "You're still here.",
    "Why do you keep counting?",
    "You stopped feeding yourself days ago.",
    "Your reflection is holding a chicken too.",
    "They line up the way you taught them.",
    "You can stop whenever you want. You won't.",
  ],
};

// Context-aware lines the game surfaces when it "knows" something — these are
// the player's own awareness curdling, not the farm acting. Used only at
// Stage 3+; callers supply the real clock / idle time.
export const NIGHT_LINES = [
  "It's late. Why are you still collecting?",
  "Everyone else is asleep. Not you. Not them.",
  "The dark doesn't bother you anymore.",
];

export const IDLE_LINES = [
  "Still there? They can tell.",
  "Stopping won't help.",
  "They noticed you went quiet.",
];

const pick = (arr, index) =>
  arr[((index % arr.length) + arr.length) % arr.length];

/** A late-night line if `hour` (0-23) is in the small hours, else null. */
export function nightLine(hour, index) {
  const late = hour >= 23 || hour < 5;
  return late ? pick(NIGHT_LINES, index) : null;
}

/** An "you went idle" line once the player has been still a while, else null. */
export function idleLine(idleSeconds, index) {
  return idleSeconds >= 45 ? pick(IDLE_LINES, index) : null;
}

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

// --- Collect button flicker --------------------------------------------------

// Alternate labels the collect button briefly flickers to at Stage 3+. The
// verbs turn from tending into compulsion.
export const COLLECT_FLICKER = {
  3: ["Collect", "Feed it", "Again", "Don't stop", "Just one more"],
};

/**
 * A momentary alternate label for the collect button at `stage`, or null if
 * this stage doesn't flicker. Caller decides when (and how briefly) to show it.
 */
export function collectFlicker(stage, index) {
  for (let s = stage; s >= 0; s--) {
    if (COLLECT_FLICKER[s]) return pick(COLLECT_FLICKER[s], index);
  }
  return null;
}

// --- Reset greeting ----------------------------------------------------------

/**
 * Greeting shown on a fresh start that followed a wipe — the farm remembering
 * the player it isn't supposed to. Null before Stage 3 or with nothing
 * remembered. `peakLifetime` is the largest flock ever reached.
 */
export function resetGreeting(stage, peakLifetime, resets) {
  if (stage < 3 || resets < 1 || peakLifetime <= 0) return null;
  return `Welcome back. We waited. All ${format(peakLifetime)} of us.`;
}

// --- ASCII art glitch --------------------------------------------------------

/**
 * Return a one-frame "glitched" version of `art`: each line is nudged
 * horizontally by the matching entry in `offsets` (positive = indent, negative
 * = pull left by removing leading spaces). Randomness lives in the caller — it
 * generates the offsets — so this stays pure and testable. Lines with offset 0
 * (or missing) are untouched.
 */
export function glitchArt(art, offsets) {
  return art
    .split("\n")
    .map((line, i) => {
      const off = offsets[i] || 0;
      if (off > 0) return " ".repeat(off) + line;
      if (off < 0) {
        let drop = 0;
        const max = -off;
        while (drop < max && drop < line.length && line[drop] === " ") drop++;
        return line.slice(drop);
      }
      return line;
    })
    .join("\n");
}
