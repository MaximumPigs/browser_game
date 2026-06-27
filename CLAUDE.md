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
