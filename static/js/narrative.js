// Narrative / "perception" layer. Pure and unit-tested — no DOM, no time,
// no randomness in here (callers pass an index in).
//
// Design note: the story is an UNRELIABLE NARRATOR. Nothing about the farm
// actually changes — every later-stage distortion (rotting ticker, corrupted
// art, the game seeming to "know" things) is the player's own mind coming
// apart. The voice you read is the player's perception, not the world.
//
// Stage is driven by `lifetime` (total chickens ever collected): the deeper
// they get, the further gone they are. Only Stage 0 has content for now;
// higher stages fall back to Stage 0 until their content is written, so the
// game reads as a perfectly ordinary clicker until later work lands.

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

// Flavor lines shown in the rotating ticker, keyed by stage. Stage 0 is
// wholesome on its face. A couple of lines are only ominous in hindsight
// ("You could do this forever.") — deniable now, foreshadowing later.
export const TICKERS = {
  0: [
    "The hens are happy today.",
    "Sunlight warms the fresh straw.",
    "A gentle clucking fills the yard.",
    "The flock follows you to the fence.",
    "Everything is calm on the farm.",
    "You could do this forever.",
    "There's always room for one more.",
  ],
};

/**
 * Pick a ticker line for the given stage. `index` selects which line (wraps
 * around, and tolerates negatives); randomness/timing live in the caller so
 * this stays pure. Stages without their own lines fall back to Stage 0.
 */
export function tickerLine(stage, index) {
  const lines = TICKERS[stage] || TICKERS[0];
  const i = ((index % lines.length) + lines.length) % lines.length;
  return lines[i];
}
