// Orchestrator: DOM wiring, the game loop, progressive reveal, and combat.
// Game rules live in the pure modules; this file owns timing, RNG and the DOM.

import {
  tick,
  canFish,
  eatAllFish,
  buyItem,
  triggerDiscovery,
  applyReward,
  afterCombat,
} from "./state.js";
import { load, save, clear } from "./save.js";
import { deriveStats, createArena, stepArena } from "./combat.js";
import { format } from "./format.js";
import {
  CONFIG,
  DOCKS,
  DISCOVERIES,
  CLUES,
  FLAVOUR,
  EAT_MESSAGES,
  FOUND,
  CREDIT_WHISPERS,
} from "./content.js";
import {
  show,
  hide,
  setText,
  renderShop,
  renderArenaInto,
  setupArenaGrid,
  spawnFx,
  createInput,
} from "./ui.js";

const IDLE_MS = 200;
const FLAVOUR_MS = 9000;
const AUTOSAVE_MS = 2500;

let state = load();
const input = createInput();

const el = (id) => document.getElementById(id);
const refs = {
  fish: el("fish"),
  tins: el("tins"),
  tinsWrap: el("tins-wrap"),
  flavour: el("flavour"),
  fishWord: el("fish-word"),
  tideBottle: el("tide-bottle"),
  pierClue: el("pier-clue"),
  whisper: el("whisper"),
  tabSea: el("tab-sea"),
  tabShop: el("tab-shop"),
  tabAdventure: el("tab-adventure"),
  panelSea: el("panel-sea"),
  panelShop: el("panel-shop"),
  panelAdventure: el("panel-adventure"),
  eatBtn: el("eat-btn"),
  canBtn: el("can-btn"),
  shopList: el("shop-list"),
  adventureIntro: el("adventure-intro"),
  adventureDesc: el("adventure-desc"),
  enterBtn: el("enter-btn"),
  arenaWrap: el("arena-wrap"),
  arenaStage: el("arena-stage"),
  arena: el("arena"),
  arenaFx: el("arena-fx"),
  playerHp: el("player-hp"),
  playerMaxHp: el("player-maxhp"),
  playerHpFill: el("player-hpfill"),
  targetHpbar: el("target-hpbar"),
  targetHpFill: el("target-hpfill"),
  targetText: el("target-text"),
  combatTins: el("combat-tins"),
  combatTonics: el("combat-tonics"),
  combatLog: el("combat-log"),
  resetBtn: el("reset-btn"),
  credits: el("credits"),
};

let activePanel = "sea";
let arena = null;
let combatActive = false;

// --- Panels / tabs ----------------------------------------------------------

function setPanel(name) {
  activePanel = name;
  const map = { sea: refs.panelSea, shop: refs.panelShop, adventure: refs.panelAdventure };
  const tabs = { sea: refs.tabSea, shop: refs.tabShop, adventure: refs.tabAdventure };
  for (const [key, panel] of Object.entries(map)) {
    panel.classList.toggle("hidden", key !== name);
    tabs[key].classList.toggle("active", key === name);
  }
  if (name === "shop") renderShop(refs.shopList, state, onBuy);
}

for (const [name, tab] of [["sea", refs.tabSea], ["shop", refs.tabShop], ["adventure", refs.tabAdventure]]) {
  tab.addEventListener("click", () => setPanel(name));
}

// --- Reveal / core refresh --------------------------------------------------

function refreshCore() {
  const f = state.flags;
  setText(refs.fish, format(state.fish));
  refs.tinsWrap.classList.toggle("hidden", !f.canneryUnlocked);
  if (f.canneryUnlocked) setText(refs.tins, format(state.tins));

  refs.eatBtn.classList.toggle("hidden", !f.eatRevealed);
  refs.tabShop.classList.toggle("hidden", !f.shopRevealed);
  refs.tabAdventure.classList.toggle("hidden", !f.adventureUnlocked);

  refs.canBtn.classList.toggle("hidden", !f.canneryUnlocked);
  refs.canBtn.disabled = state.fish < CONFIG.canCostFish;

  // The bobbing bottle: appears once there's something to notice, until taken.
  const showBottle = state.fish >= CONFIG.bottleNoticeAt && !f.shopRevealed;
  refs.tideBottle.classList.toggle("hidden", !showBottle);
  if (showBottle && !refs.tideBottle.textContent) setText(refs.tideBottle, CLUES.bottle);

  // The pier clue: appears once you're armed and haven't found the way yet.
  const showPier = !!state.weapon && !f.adventureUnlocked;
  refs.pierClue.classList.toggle("hidden", !showPier);
  if (showPier && !refs.pierClue.textContent) setText(refs.pierClue, CLUES.pier);

  if (activePanel === "shop") renderShop(refs.shopList, state, onBuy);
}

// --- Discovery + actions ----------------------------------------------------

// Fire a discovery; on first trigger, whisper its oblique note.
function discover(id) {
  const before = state;
  state = triggerDiscovery(state, id);
  if (state !== before) {
    setText(refs.whisper, DISCOVERIES[id].note);
    save(state);
    refreshCore();
  }
}

refs.fishWord.addEventListener("click", () => discover("theEat"));
refs.tideBottle.addEventListener("click", () => discover("market"));
refs.pierClue.addEventListener("click", () => {
  discover("thePier");
  if (state.flags.adventureUnlocked) setPanel("adventure");
});

function onBuy(id) {
  const before = state;
  state = buyItem(state, id);
  if (state !== before) {
    save(state);
    refreshCore();
    if (activePanel === "shop") renderShop(refs.shopList, state, onBuy);
  }
}

refs.eatBtn.addEventListener("click", () => {
  state = eatAllFish(state);
  const i = Math.min(state.stats.eats - 1, EAT_MESSAGES.length - 1);
  setText(refs.whisper, EAT_MESSAGES[Math.max(0, i)]);
  save(state);
  refreshCore();
});

refs.canBtn.addEventListener("click", () => {
  const before = state;
  state = canFish(state);
  if (state !== before) {
    save(state);
    refreshCore();
  }
});

refs.resetBtn.addEventListener("click", () => {
  if (!confirm("Start over? This empties your bucket and your tins.")) return;
  clear();
  location.reload();
});

// Secret: clicking the credits cycles whispers.
let creditIdx = 0;
refs.credits.addEventListener("click", () => {
  setText(refs.whisper, CREDIT_WHISPERS[creditIdx % CREDIT_WHISPERS.length]);
  creditIdx += 1;
});

// Secret: type "salmon" anywhere out of combat.
let typed = "";
window.addEventListener("keydown", (e) => {
  if (combatActive || e.key.length !== 1) return;
  typed = (typed + e.key.toLowerCase()).slice(-6);
  if (typed === "salmon") {
    setText(refs.whisper, "A salmon! …No. There are no salmon here. There never were.");
  }
});

// --- Combat -----------------------------------------------------------------

function logFor(events) {
  // Priority: the punchiest event this frame wins the log line.
  for (const ev of events) if (ev.type === "death") return `${ev.name} is done for.`;
  for (const ev of events) {
    if (ev.type === "wave") return "Something worse arrives.";
    if (ev.type === "heal") return "You drink the brine tonic.";
    if (ev.type === "noTins") return "No tins left to throw.";
    if (ev.type === "blocked") return `You turn aside ${ev.name}.`;
    if (ev.type === "miss") return `You slip past ${ev.name}.`;
    if (ev.type === "windup") return "Something winds up to strike…";
    if (ev.type === "hit" && ev.target === "player") return `${ev.name} gets you for ${ev.dmg}.`;
  }
  return null;
}

// The enemy the player is aiming at (faced tile), else the nearest one.
function currentTarget() {
  const p = arena.player;
  const faced = arena.enemies.find((e) => e.x === p.x + p.facing.dx && e.y === p.y + p.facing.dy);
  if (faced) return faced;
  let best = null;
  let bestD = Infinity;
  for (const e of arena.enemies) {
    const d = Math.abs(e.x - p.x) + Math.abs(e.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

function updateCombatHud() {
  const p = arena.player;
  setText(refs.playerHp, Math.max(0, Math.ceil(p.hp)));
  setText(refs.playerMaxHp, p.maxHp);
  refs.playerHpFill.style.width = `${Math.max(0, (p.hp / p.maxHp) * 100)}%`;
  setText(refs.combatTins, arena.resources.tins - arena.used.tins);
  setText(refs.combatTonics, arena.resources.tonics - arena.used.tonics);

  const t = currentTarget();
  if (t) {
    show(refs.targetHpbar);
    refs.targetHpFill.style.width = `${Math.max(0, (t.hp / t.maxHp) * 100)}%`;
    setText(refs.targetText, `${t.name} ${Math.max(0, Math.ceil(t.hp))}/${t.maxHp}`);
  } else {
    hide(refs.targetHpbar);
  }
}

let lastFrame = 0;
function combatFrame(now) {
  if (!combatActive) return;
  const dt = Math.min(50, now - lastFrame);
  lastFrame = now;

  const result = stepArena(arena, dt, input.snapshot());
  arena = result.arena;
  renderArenaInto(refs.arena, arena);
  const playerHit = spawnFx(refs.arenaFx, arena, result.events);
  if (playerHit) {
    refs.arenaStage.classList.remove("shake");
    void refs.arenaStage.offsetWidth;
    refs.arenaStage.classList.add("shake");
  }
  updateCombatHud();
  const line = logFor(result.events);
  if (line) setText(refs.combatLog, line);

  if (arena.status === "fighting") {
    requestAnimationFrame(combatFrame);
  } else {
    endCombat(arena.status);
  }
}

function startCombat() {
  const stats = deriveStats({ weapon: state.weapon, armour: state.armour });
  const resources = { tins: Math.floor(state.tins), tonics: state.inv.tonic || 0 };
  const seed = (Date.now() & 0xffffffff) || 1;
  arena = createArena(DOCKS, stats, resources, seed);

  hide(refs.adventureIntro);
  show(refs.arenaWrap);
  setText(refs.combatLog, "The planks creak underfoot.");
  refs.arenaFx.textContent = "";
  setupArenaGrid(refs.arenaFx, arena);
  refs.arenaFx._w = arena.width;
  renderArenaInto(refs.arena, arena);
  updateCombatHud();

  combatActive = true;
  input.setActive(true);
  lastFrame = performance.now();
  requestAnimationFrame(combatFrame);
}

function endCombat(status) {
  combatActive = false;
  input.setActive(false);

  state = afterCombat(state, { tinsUsed: arena.used.tins, tonicsUsed: arena.used.tonics });

  let firstClear = false;
  if (status === "won") {
    firstClear = !state.flags.docksCleared;
    if (firstClear) {
      state = applyReward(state, DOCKS.reward);
      const found = FOUND[DOCKS.reward.found];
      setText(refs.whisper, found.text);
      setText(refs.combatLog, `You win. ${found.title}.`);
    } else {
      setText(refs.combatLog, "The docks are quiet again.");
    }
  } else {
    setText(refs.combatLog, "You come to on the pier, soaked and sore.");
  }

  save(state);
  show(refs.adventureIntro);
  hide(refs.arenaWrap);
  setText(
    refs.adventureDesc,
    state.flags.docksCleared
      ? "The docks are quiet now. You could walk them again."
      : "The planks creak. Something skitters at the far end.",
  );
  refs.enterBtn.textContent = state.flags.docksCleared ? "Return to The Docks" : "Enter The Docks";
  refreshCore();

  // On the first win, surface the discovery on the main panel.
  if (firstClear) setPanel("sea");
}

refs.enterBtn.addEventListener("click", startCombat);

// --- Loops ------------------------------------------------------------------

let lastIdle = performance.now();
let sinceSave = 0;
setInterval(() => {
  const now = performance.now();
  const dt = (now - lastIdle) / 1000;
  lastIdle = now;

  state = tick(state, dt);
  refreshCore();

  sinceSave += IDLE_MS;
  if (sinceSave >= AUTOSAVE_MS) {
    save(state);
    sinceSave = 0;
  }
}, IDLE_MS);

// Rotating flavour line.
function rotateFlavour() {
  const line = FLAVOUR[Math.floor(Math.random() * FLAVOUR.length)];
  setText(refs.flavour, line);
  refs.flavour.classList.remove("fade-in");
  void refs.flavour.offsetWidth;
  refs.flavour.classList.add("fade-in");
}
setInterval(rotateFlavour, FLAVOUR_MS);

// --- Boot -------------------------------------------------------------------

setPanel("sea");
refreshCore();
rotateFlavour();
