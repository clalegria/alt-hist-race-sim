---
paths:
  - "tools/screenshots/**"
---

# Screenshots

`pnpm screenshots` renders the app's main screens to PNGs in `tools/screenshots/out/`
(gitignored, emptied each run), for Claude to open with Read. It is how Claude sees the
UI: **never the author's own Chrome**, and no browser MCP without asking first.

## How it works

- **Server** (`src/server.ts`): reuses a dev server already on :5173 if it serves this
  app, otherwise starts Vite with `node` directly (not `pnpm dev`, whose child survives
  a kill on Windows) and stops it at the end.
- **Privacy**: Playwright's bundled Chromium headless shell (never `channel: "chrome"`),
  a fresh context per variant with no user-data dir, and every request for a host other
  than localhost aborted. `start` runs `playwright install --only-shell chromium` first,
  which downloads into Playwright's own cache once and is a no-op after.
- **Variants**: desktop 1440×900 and phone 390×844, light and dark, full-page. The theme
  is the app's own localStorage choice (`apps/web/src/lib/theme.ts`), not
  `prefers-color-scheme`, so an init script writes it.
- **Same run every time**: the app draws seeds from `Math.random()` and has no seed box,
  so the init script replaces the page's `Math.random` with a seeded generator.
  `RANDOM_SEED` in `src/main.ts`; the year is `YEAR` in `src/steps.ts`.
- **Steps** (`src/steps.ts`): one named step per screen, reached by clicking on from the
  previous one, with role and text locators, never CSS classes. Each context starts
  with empty storage, so a run exists only once a step has started one. Some steps are `page.goBack()`, which walks
  browser history through a run and raises the exit dialog past its start — the one
  place the blocker runs in a real browser. Once the Share link lands each `reach` can
  become a `page.goto()` of one and the runner does not change.
- Output is `NN-<step>-<desktop|phone>-<light|dark>.png`. A page error, a console error
  or Vite's error overlay makes the run fail.

## Reading the pictures

- The checkerboard stops one viewport down in a full-page shot: it is a `position:
  fixed` layer, painted once. Not a bug.
- Read shrinks a tall PNG to fit, so a long summary loses fine detail.
