# CLAUDE.md

Guidance for Claude Code (and humans) working in this repository.

## Project overview

`browser_game` is a **chicken-farm themed incremental (idle/clicker) game that runs
in the browser**. You collect chickens by clicking and by buying upgrades (Better
Feed, Chicken Coop, Rooster, Big Barn) that boost per-click and per-second income.
The vibe is intentionally simple and hackable — favor small, readable changes over
heavy abstraction.

The upgrade catalogue lives in `UPGRADES` in `static/js/state.js`; add new content by
extending that array (cost/growth/effects are data-driven, and the shop UI renders
itself from it).

### Narrative layer (spoilers)

Under the wholesome surface, the game has a slow-burn creepypasta arc: it looks like
an ordinary clicker, then progressively and subtly turns dark. The intended payoff is
an **unreliable narrator** — *nothing about the farm actually changes*; every
distortion (rotting flavor text, corrupted art, the game seeming to "know" things) is
the **player character's descent into madness**. Keep that framing when writing new
content: the voice is the player's decaying perception, not a sentient farm.

- Progression is gated on `lifetime` (total chickens ever collected) — the deeper in,
  the further gone — computed into a stage by `stageFor()` in `static/js/narrative.js`.
- Story content (e.g. `TICKERS`) is **data keyed by the stage that adds it**; the
  visible ticker pool is **cumulative** (`tickerPool`), so earlier lines keep
  surfacing as new ones creep in. Stages with no new lines reuse what's unlocked.
- `narrative.js` is pure (no DOM/time/randomness — callers pass indices/elapsed in)
  and unit-tested. It also resolves stage-keyed **ASCII art** (`artFor`), **upgrade
  descriptions** (`describeUpgrade`), and the return message (`returnMessage`).
- **Stages 0–2** implemented:
  - **0** wholesome.
  - **1** (1,000 lifetime) slips in deniable off-key ticker lines about the *farmer*
    (memory, perception, compulsion, lost time) — never the farm.
  - **2** (10,000 lifetime) — first *visual* reaction: the chicken's eye `o → ●`,
    upgrade descriptions gain a darker second reading, and returning after an absence
    shows "while you were away, N went missing." The missing count is **imagined** —
    it never actually leaves the save (`state.lastSeen` drives the elapsed-time calc).
  - **3** (75,000 lifetime) — *it knows you*. Ticker lines address the player
    directly and, via `nightLine`/`idleLine`, react to the **real clock** and how long
    you've sat idle. The collect button **flickers** to verbs of compulsion. **Reset
    no longer truly resets**: a separate `browser_game.memory` store (`loadMemory`/
    `saveMemory`, which `clear()` deliberately leaves alone) keeps `peakLifetime` +
    `resets`, so the wiped farm greets the returning player and the **effective stage
    never drops** below the peak reached (`currentStage()` in `main.js`). It's the
    player's mind that can't start over, not the farm.
  - **4** (500,000 lifetime) — *the framing flips*. The art corrupts further (a
    second eye, broken legs via `ART[4]`), upgrade descriptions stop pretending to be
    about poultry, and the **chrome mutates**: the `🐔` counter label and cost buttons
    become `?` (`counterLabel`) and the browser tab title becomes "do you see them?"
    (`pageTitle`). Ticker reframes it — there were never chickens, only the number and
    a person alone with it. (The on-page `<h1>` stays cheerful on purpose.)
- **ASCII glitch**: from Stage 2, `glitchArt(art, offsets)` produces a one-frame
  misaligned chicken; `main.js` generates random offsets each time so it never repeats.

- **Frontend:** vanilla JavaScript, HTML, and CSS — **no framework, no build step**.
- **Backend:** Python with **Flask**, serving the static frontend and a small JSON API.
- **Game saves:** persisted **client-side in the browser via `localStorage`**. The
  backend does **not** store per-player progress.

> The repo is early-stage. When the structure below doesn't exist yet, create it as
> you go rather than inventing a different layout.

## Intended structure

```
browser_game/
├── app.py                 # Flask entry point (serves frontend + API)
├── requirements.txt       # Python dependencies (Flask, pytest, ...)
├── static/
│   ├── js/                # Vanilla JS game logic (modules, no bundler)
│   └── css/               # Stylesheets
├── templates/             # HTML served by Flask (or static/index.html)
├── tests/                 # pytest backend tests
└── static/js/__tests__/   # JS game-logic tests
```

## Tech & conventions

- **Frontend is plain JS.** Use ES modules (`<script type="module">`). Do **not**
  introduce React, TypeScript, a bundler, or npm framework dependencies — that
  contradicts the no-build-step choice. Keep DOM updates direct and simple.
- **Game state lives in the browser.** Read/write progress through a single
  `localStorage` save/load layer rather than scattering `localStorage` calls. Saves
  should be JSON-serializable and versioned so future changes can migrate old saves.
- **Backend is intentionally thin.** Flask serves files and exposes only the small
  API the game needs. Don't move core game logic server-side unless asked.
- Prefer small, focused functions. Match the surrounding style; keep comments sparse
  and meaningful.

## Running the game

```bash
# one-time setup
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# run the dev server
flask --app app run --debug
# then open http://127.0.0.1:5000
```

## Testing

Both layers are tested.

```bash
# Python backend tests
pytest

# JavaScript game-logic tests
npm install         # one-time: install Vitest
npm test            # run once
npm run test:watch  # watch mode while developing
```

- Backend: **pytest**, tests in `tests/`.
- Frontend: **Vitest** for pure game-logic modules, tests in `static/js/__tests__/`.
  Vitest runs ES modules natively, so it needs no Babel/bundler config. It is a
  dev-only dependency and does **not** add a build step to the shipped game — the
  browser loads the same plain JS modules directly.
- Keep game logic separable from the DOM (pure functions that take/return data) so it
  can be unit-tested without a browser.

Run the relevant test suite after changes and report real results — if something
fails or was skipped, say so.

## Notes for Claude

- This is a "vibe coded" project: bias toward shipping a working, simple change.
- Don't add dependencies or tooling that conflict with the no-build-step, vanilla-JS
  approach without checking first.
- Keep game progress format backward-compatible (or migrate it) so existing
  `localStorage` saves don't break.
