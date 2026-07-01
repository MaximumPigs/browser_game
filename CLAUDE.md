# CLAUDE.md

Guidance for Claude Code (and humans) working in this repository.

## Project overview

**Fish Box** is a [Candy Box]–style incremental game themed around **tinned / pickled
fish**. It presents as a trivially simple text counter, then progressively reveals depth:
a shop, an **active real-time top-down ASCII arena**, gear, a story, and secrets. Tone is
**absurd and funny, with hidden features**.

- **Frontend:** vanilla JavaScript, HTML, CSS — **no framework, no build step** (ES
  modules loaded directly).
- **Backend:** none. Pure client-side; progress saved in `localStorage`.
- **Hosting:** served as static files via **GitHub Pages** (workflow in
  `.github/workflows/pages.yml`). Use **relative** asset paths so it works from the
  project subpath.

[Candy Box]: https://en.wikipedia.org/wiki/Candy_Box!

## Design pillars

- **Deceptive minimalism.** Start with almost nothing on screen; reveal tabs/actions as
  the player progresses.
- **Cryptic, discovery-driven progression.** Progress by **noticing and experimenting**,
  not by being told — no signposted prompts. A pure `DISCOVERIES` table + `triggerDiscovery`
  (idempotent) flip unlock flags from varied triggers wired in `main.js` (clicking the
  bobbing bottle → the shop; clicking the word "fish" → the eat joke; following the pier
  once armed → the Docks). Unlocks arrive as **cryptic found objects**, never "You
  unlocked X!". Keep it *fair*: discoverable things have subtle affordance (a `.clue` that
  underlines on hover; a bottle that visibly bobs). The **shop only sells gear,
  consumables, automation** — never core unlocks.
- **Two resources.** *Fish* accrue passively (~1/sec). *Tins* are the premium currency,
  made **by hand** first via a **"Can (10) fish"** button (−10 fish → +1 tin); an
  *Automatic Canner* (shop, post-unlock) automates it later.
- **Active, legible combat.** A real-time top-down ASCII arena you actually play. Every
  state is visible: a **directional player glyph** (▲▶▼◀) + an aim highlight, enemy
  attacks that **telegraph** (a pulsing target tile) before they land so blocking/dodging
  is reactive, and animated feedback (swing, floating damage, hit-flash, shake, HP bars).

## Architecture

Static site; ES modules; no bundler. Strict separation keeps logic testable.

```
index.html                 # single page; panels shown/hidden by unlock state
static/css/style.css
static/js/
  main.js                  # orchestrator: DOM wiring, game loop, reveal logic, autosave
  state.js                 # PURE core: newGame, tick, canFish, buyItem, triggerDiscovery
                           #   (cryptic unlocks), applyReward, derived rates, migrate
  content.js               # DATA: shop items, enemies, areas, DISCOVERIES, CLUES, FOUND, text
  combat.js                # PURE arena engine: deriveStats, stepArena (telegraphed), arenaCells
  save.js                  # ONLY localStorage access: load/save/clear + versioned migrate
  format.js                # number formatting (1.2k, 1.5M, …)
  ui.js                    # styled cell renderer + FX overlay + shop render + key sampling
static/js/__tests__/       # Vitest specs
```

- **Pure modules** (`state.js`, `combat.js`, `format.js`, `content.js`): no DOM, no
  `localStorage`, no `Date`/`Math.random` except via an injected seed. Unit-tested.
- **Impure** (`main.js`, `ui.js`): own the DOM, timing, the game loop, and RNG seeds.
- `save.js` is the **only** module that touches `localStorage`.

## Combat engine

`stepArena(arena, dtMs, input) -> { arena, events }` advances cooldowns, resolves grid
movement/collision, the player's (instant) attack, thrown-tin projectiles, and enemy AI.
Enemy attacks use a **cooldown → wind-up → strike** model: a committing enemy enters a
`windup` (its `target` tile telegraphs) before the hit resolves *against whoever occupies
that tile at strike time* — so **blocking** (directional) or **dodging** (stepping off the
tile) are real, reactive counters. Events (`windup`, `strike`, `hit`, `blocked`, `miss`,
`death`, `win`/`lose`) drive the UI. Deterministic given `arena` + `input` + seed →
unit-tested. Pure **`arenaCells(arena)`** returns the render grid (kinds + `aim`/
`telegraph`/facing glyph); `ui.js` maps it to styled `<span>` cells with animation
classes, and `spawnFx` overlays transient hit/strike/block effects. `main.js` samples
held keys and calls `stepArena` on a fixed timestep.

## Running & testing

```bash
npm run serve   # static dev server (python3 -m http.server 8000)
npm install && npm test   # Vitest (pure logic)
```

## Notes for Claude

- Keep new game logic **pure and tested**; keep DOM/timing/RNG in `main.js`/`ui.js`.
- Core progression = **story rewards**, not shop purchases. The shop is gear/consumables/
  automation only.
- Keep `localStorage` access inside `save.js`, and keep saves versioned + migrated.
- Use **relative** asset paths (GitHub Pages serves from a subpath).
- Out of scope for now (later phases): the Smokehouse/forge & enchanting, zones beyond
  The Docks, spells/recipes, achievements, multiple endings, offline progress, save
  import/export.
