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

- **Deceptive minimalism.** Start with almost nothing on screen; reveal tabs/actions via
  unlock flags as the player progresses.
- **Story unlocks vs shop.** Core systems/zones are **earned through the storyline** as
  found items (e.g. the first quest drops a *message in a bottle* holding the **Deed to
  the Old Cannery**, which unlocks tin-making). The **shop only sells gear, consumables,
  and automation** — never core unlocks.
- **Two resources.** *Fish* accrue passively (~1/sec). *Tins* are the premium currency,
  made **by hand** first via a **"Can (10) fish"** button (−10 fish → +1 tin); an
  *Automatic Canner* (shop, post-unlock) automates it later.
- **Active combat.** A real-time top-down ASCII arena you actually play (move / attack /
  block / throw tins), not a spectated HP bar.

## Architecture

Static site; ES modules; no bundler. Strict separation keeps logic testable.

```
index.html                 # single page; panels shown/hidden by unlock state
static/css/style.css
static/js/
  main.js                  # orchestrator: DOM wiring, game loop, reveal logic, autosave
  state.js                 # PURE core: newGame, tick, canFish, buyItem, equip,
                           #   applyReward (story unlocks), derived rates, migrate
  content.js               # DATA: shop items, enemies, areas, quest rewards, text
  combat.js                # PURE arena engine: deriveStats, stepArena(arena, dt, input)
  save.js                  # ONLY localStorage access: load/save/clear + versioned migrate
  format.js                # number formatting (1.2k, 1.5M, …)
  ui.js                    # render helpers + arena grid renderer + key input sampling
static/js/__tests__/       # Vitest specs
```

- **Pure modules** (`state.js`, `combat.js`, `format.js`, `content.js`): no DOM, no
  `localStorage`, no `Date`/`Math.random` except via an injected seed. Unit-tested.
- **Impure** (`main.js`, `ui.js`): own the DOM, timing, the game loop, and RNG seeds.
- `save.js` is the **only** module that touches `localStorage`.

## Combat engine

`stepArena(arena, dtMs, input) -> { arena, events }` advances all entity cooldowns,
resolves grid movement/collision, attacks, directional blocks, thrown-tin projectiles,
and enemy AI, and returns an `events` list (hits, deaths, `win`/`lose`). Deterministic
given `arena` + `input` + seed → unit-testable. `main.js` samples held keys and calls it
on a fixed timestep; `ui.js` renders the grid to a `<pre>`.

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
