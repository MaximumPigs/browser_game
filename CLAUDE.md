# CLAUDE.md

Guidance for Claude Code (and humans) working in this repository.

## Project overview

`browser_game` is a **text-based / incremental (idle/clicker) game that runs in the
browser**. The vibe is intentionally simple and hackable — favor small, readable
changes over heavy abstraction.

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
npm test            # configure a runner (e.g. Vitest/Jest) in package.json
```

- Backend: **pytest**, tests in `tests/`.
- Frontend: a JS test runner for pure game-logic modules (keep logic separable from
  the DOM so it can be unit-tested). The test runner is dev-only and does **not** add
  a build step to the shipped game.

Run the relevant test suite after changes and report real results — if something
fails or was skipped, say so.

## Notes for Claude

- This is a "vibe coded" project: bias toward shipping a working, simple change.
- Don't add dependencies or tooling that conflict with the no-build-step, vanilla-JS
  approach without checking first.
- Keep game progress format backward-compatible (or migrate it) so existing
  `localStorage` saves don't break.
