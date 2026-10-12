---
paths:
  - "tools/screenshots/**"
---

# Screenshots

`pnpm screenshots` renders the app's screens to PNGs in `tools/screenshots/out/` (emptied
each run) for Claude to Read. How it works is in the headers of `src/main.ts`,
`src/server.ts` and `src/steps.ts`.

- **It is how Claude sees the UI**: never the author's own Chrome, and no browser MCP
  without asking first.
- **Capture only what a change touched**, one variant unless the change is about width
  or theme (`CLAUDE.md`). An unknown step name lists them all.
- **Keep the privacy rules in `main.ts`**: Playwright's bundled Chromium only (never a
  `channel`), a throwaway context per variant, and every non-localhost request aborted.
- **Never point it at a dev server already running**: `startDevServer` starts this
  checkout's own, which `pnpm tunnel` shares. Another may be serving another worktree.
- **A step is reached from the one before it**, by role and visible text, never a CSS
  class: the styling is what the pictures check.
- A page error, a console error or Vite's error overlay fails the run.
- **Reading the pictures**: the checkerboard stops one viewport down in a full-page shot
  (a fixed layer, painted once), which is not a bug; Read shrinks a tall PNG, so a long
  page loses fine detail.
