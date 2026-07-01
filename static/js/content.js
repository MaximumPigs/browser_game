// Static game data. No logic here — just the catalogue the pure modules read.

// Tuning knobs in one place.
export const CONFIG = {
  baseFishPerSec: 1,
  canCostFish: 10, // "Can (10) fish"
  canYieldTins: 1,
  tonicHeal: 12,
  throwTinDamage: 7,
  revealEatAt: 10, // fish count that reveals the joke button
  revealShopAt: 30, // fish count that reveals the shop
};

// Player stats before any gear. Weapon overrides attack/attackCdMs; armour adds
// maxHp/defense. Movement is snappy; attacks have a wind-down.
export const PLAYER_BASE = {
  maxHp: 20,
  attack: 2,
  defense: 0,
  moveCdMs: 120,
  attackCdMs: 520,
};

// Shop = gear, consumables, automation ONLY. Never core unlocks (those are
// story rewards). Effects are declarative; state.buyItem applies them.
//   cost:        { fish?, tins? }
//   repeatable:  can be bought many times
//   once:        one-time purchase (tracked in state.bought)
//   requiresFlag: only offered once this unlock flag is set
export const SHOP = [
  {
    id: "bait",
    name: "Fresh bait",
    desc: "The fish come quicker. +0.5 fish/sec.",
    cost: { fish: 15 },
    repeatable: true,
    effect: { fishRate: 0.5 },
  },
  {
    id: "harpoon",
    name: "Wooden harpoon",
    desc: "Pointy. Good for the pier. (weapon)",
    cost: { fish: 40 },
    once: true,
    effect: { weapon: { id: "harpoon", name: "wooden harpoon", attack: 4, attackCdMs: 420 } },
  },
  {
    id: "waders",
    name: "Oilskin waders",
    desc: "Turns aside a nip or two. +10 HP, +2 defence. (armour)",
    cost: { fish: 90 },
    once: true,
    effect: { armour: { id: "waders", name: "oilskin waders", maxHp: 10, defense: 2 } },
  },
  {
    id: "net",
    name: "A bigger net",
    desc: "Haul more at once. +2 fish/sec.",
    cost: { fish: 120 },
    repeatable: true,
    effect: { fishRate: 2 },
  },
  {
    id: "tonic",
    name: "Brine tonic",
    desc: "A swig mends you mid-fight. Heals in combat.",
    cost: { fish: 25 },
    repeatable: true,
    effect: { consumable: { tonic: 1 } },
  },
  {
    id: "chip",
    name: "A single soggy chip",
    desc: "Does nothing. It is, however, a chip.",
    cost: { fish: 1 },
    repeatable: true,
    effect: {},
  },
  // Post-Cannery: automation and the first tin-priced gear.
  {
    id: "autocanner",
    name: "Automatic Canner",
    desc: "A wheezing contraption cans fish for you. +1 can/sec.",
    cost: { fish: 200 },
    repeatable: true,
    requiresFlag: "canneryUnlocked",
    effect: { autoCanRate: 1 },
  },
  {
    id: "gaff",
    name: "Steel gaff",
    desc: "Heavier. Bites deeper. (weapon)",
    cost: { tins: 8 },
    once: true,
    requiresFlag: "canneryUnlocked",
    effect: { weapon: { id: "gaff", name: "steel gaff", attack: 8, attackCdMs: 360 } },
  },
];

// Enemy archetypes for the arena.
export const ENEMIES = {
  crab: { name: "a crab", glyph: "c", hp: 10, attack: 3, defense: 2, moveCdMs: 520, attackCdMs: 900 },
  gull: { name: "a gull", glyph: ">", hp: 6, attack: 4, defense: 0, moveCdMs: 230, attackCdMs: 700, erratic: true },
  sardine: { name: "a sardine", glyph: "~", hp: 3, attack: 2, defense: 0, moveCdMs: 300, attackCdMs: 650 },
  seal: { name: "the Harbour Seal", glyph: "S", hp: 34, attack: 6, defense: 2, moveCdMs: 360, attackCdMs: 820 },
};

// First adventure area: a linear run of waves ending in the seal.
export const DOCKS = {
  id: "docks",
  name: "The Docks",
  width: 21,
  height: 11,
  playerStart: { x: 10, y: 9 },
  waves: [
    [{ type: "crab", x: 5, y: 2 }, { type: "crab", x: 15, y: 2 }],
    [{ type: "gull", x: 3, y: 3 }, { type: "gull", x: 17, y: 3 }, { type: "sardine", x: 10, y: 1 }],
    [
      { type: "sardine", x: 4, y: 2 },
      { type: "sardine", x: 8, y: 1 },
      { type: "sardine", x: 12, y: 1 },
      { type: "sardine", x: 16, y: 2 },
    ],
    [{ type: "seal", x: 10, y: 2 }],
  ],
  reward: { fish: 150, unlockFlag: "canneryUnlocked", clearsFlag: "docksCleared", found: "bottle" },
};

// Found items from quests (the diegetic core unlocks).
export const FOUND = {
  bottle: {
    title: "A message in a bottle",
    text:
      "Bobbing in the reek is a bottle. Inside, brittle and water-stained: " +
      "“DEED — the Old Cannery, and all the tins therein. Yours now, " +
      "if you'll have the burden.”",
  },
};

// Rotating flavour lines under the counter.
export const FLAVOUR = [
  "The sea does its usual impression of the sea.",
  "A fish. Then another. The system works.",
  "Somewhere, a gull is judging you.",
  "The tide comes in. Later, the tide will go out.",
  "You have never felt more like a person who has fish.",
  "The horizon is where the sea keeps its edges.",
  "The bucket is patient. The bucket has always been patient.",
];

// Escalating messages for the "Eat all your fish" joke button.
export const EAT_MESSAGES = [
  "You eat all your fish. Raw. Every one.",
  "You eat all your fish again. The gull saw.",
  "You eat all your fish. This is a choice you keep making.",
  "You eat all your fish. A dentist, somewhere, shudders.",
  "There were no fish to eat. You mime it anyway.",
];

// Short story beats shown in the main panel.
export const STORY = {
  intro: "You have a bucket. The sea has fish. It seems like the start of something.",
  shopReveal: "A market has appeared at the waterline. Perhaps it was always there.",
  pierPrompt:
    "You have a weapon now. You could walk to the end of the pier and see what wants a fight.",
  canneryReveal:
    "The Old Cannery is yours. You can press fish into tins by hand — ten fish to a tin.",
};

// Secret: clicking the credits cycles these whispers.
export const CREDIT_WHISPERS = [
  "You hear the tin. It is empty. It is always empty.",
  "There is a bigger sea beneath this one.",
  "The seal remembers you. It has not met you yet.",
  "Keep counting. It helps. It doesn't, but it helps.",
];
