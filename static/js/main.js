// Orchestrator: DOM wiring, the game loop, progressive reveal, and combat.
// Game rules live in the pure modules; this file owns timing, RNG and the DOM.

import {
  tick,
  canFish,
  eatAllFish,
  buyItem,
  walkPier,
  applyReward,
  afterCombat,
} from "./state.js";
import { load, save, clear } from "./save.js";
import { deriveStats, createArena, stepArena } from "./combat.js";
import { format } from "./format.js";
import {
  CONFIG,
  DOCKS,
  STORY,
  FLAVOUR,
  EAT_MESSAGES,
  FOUND,
  CREDIT_WHISPERS,
} from "./content.js";
import { show, hide, setText, renderShop, renderArenaInto, createInput } from "./ui.js";

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
  story: el("story"),
  whisper: el("whisper"),
  tabSea: el("tab-sea"),
  tabShop: el("tab-shop"),
  tabAdventure: el("tab-adventure"),
  panelSea: el("panel-sea"),
  panelShop: el("panel-shop"),
  panelAdventure: el("panel-adventure"),
  eatBtn: el("eat-btn"),
  canBtn: el("can-btn"),
  pierBtn: el("pier-btn"),
  shopList: el("shop-list"),
  adventureIntro: el("adventure-intro"),
  adventureDesc: el("adventure-desc"),
  enterBtn: el("enter-btn"),
  arenaWrap: el("arena-wrap"),
  arena: el("arena"),
  playerHp: el("player-hp"),
  playerMaxHp: el("player-maxhp"),
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

function currentStory() {
  const f = state.flags;
  if (f.canneryUnlocked) return STORY.canneryReveal;
  if (f.pierPrompt && !f.adventureUnlocked) return STORY.pierPrompt;
  if (f.shopRevealed) return STORY.shopReveal;
  return STORY.intro;
}

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

  const showPier = f.pierPrompt && !f.adventureUnlocked;
  refs.pierBtn.classList.toggle("hidden", !showPier);

  setText(refs.story, currentStory());

  if (activePanel === "shop") renderShop(refs.shopList, state, onBuy);
}

// --- Actions ----------------------------------------------------------------

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

refs.pierBtn.addEventListener("click", () => {
  state = walkPier(state);
  save(state);
  refreshCore();
  setPanel("adventure");
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
  for (const ev of events) {
    if (ev.type === "death") return `${ev.name} is done for.`;
    if (ev.type === "wave") return "Something worse arrives.";
    if (ev.type === "heal") return "You drink the brine tonic.";
    if (ev.type === "throw") return "You hurl a tin.";
    if (ev.type === "noTins") return "No tins left to throw.";
    if (ev.type === "block") return `You turn aside ${ev.name}.`;
    if (ev.type === "hit" && ev.target === "player") return `${ev.name} gets you for ${ev.dmg}.`;
  }
  return null;
}

function updateCombatHud() {
  const p = arena.player;
  setText(refs.playerHp, Math.max(0, Math.ceil(p.hp)));
  setText(refs.playerMaxHp, p.maxHp);
  setText(refs.combatTins, arena.resources.tins - arena.used.tins);
  setText(refs.combatTonics, arena.resources.tonics - arena.used.tonics);
}

let lastFrame = 0;
function combatFrame(now) {
  if (!combatActive) return;
  const dt = Math.min(50, now - lastFrame);
  lastFrame = now;

  const result = stepArena(arena, dt, input.snapshot());
  arena = result.arena;
  renderArenaInto(refs.arena, arena);
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
