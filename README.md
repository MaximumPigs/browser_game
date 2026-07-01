# Fish Box

A [Candy Box](https://en.wikipedia.org/wiki/Candy_Box!)–style incremental game about
tinned, pickled fish. It looks trivially simple at first — a number ticking up — then
quietly opens into a shop, an active top-down ASCII arena, gear, a story, and secrets.

Working title; expect it to change.

## Play

- **Live (GitHub Pages):** published from `main` — see the repo's **Pages** settings /
  the deployment link. _(One-time setup: **Settings → Pages → Source = GitHub Actions**.)_
- **Locally:** it's a static site (no build step). Serve the folder and open it:
  ```bash
  npm run serve      # python3 -m http.server 8000
  # then open http://localhost:8000
  ```

## Combat controls

Move **WASD / arrows** · attack **Space / J** · block **K / Shift** · throw tin **L** ·
drink tonic **H**.

## Develop

Pure game logic lives in small ES modules and is unit-tested with Vitest:

```bash
npm install
npm test
```

See [CLAUDE.md](CLAUDE.md) for architecture and design notes.
