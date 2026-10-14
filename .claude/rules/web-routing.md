---
paths:
  - "apps/web/src/routes/**"
  - "apps/web/src/router.ts"
  - "apps/web/src/run-routes.tsx"
  - "apps/web/src/App.tsx"
  - "apps/web/src/lib/areas.ts"
  - "apps/web/src/lib/run-places.ts"
  - "apps/web/src/lib/reveal.ts"
  - "apps/web/src/lib/run-bar.ts"
  - "apps/web/src/components/NotReached.tsx"
  - "apps/web/src/components/TopNav.tsx"
  - "apps/web/src/components/RunBar.tsx"
  - "apps/web/src/components/RunDialogs.tsx"
  - "apps/web/src/components/ResumeRun.tsx"
  - "apps/web/src/routes.test.tsx"
  - "apps/web/src/test-router.tsx"
---

# Routing, the gate and the run bar

Which URL shows what, what a page may read of the run, and how a run is moved, entered
and left.

## Routes
- **Route names are public once *publish it* ships**: add routes, never rename them.
- **A file in `src/routes/` is a route** and exports `Route` alone; what the run's
  routes share lives in `run-routes.tsx`. Route files stay thin wiring.
- **`routeTree.gen.ts` is generated**: committed, excluded from Biome, never edited.
  After adding, renaming or deleting a route file, run `pnpm dev` or `pnpm build`.
- **A new page inside `/run` resolves twice**: `guardRunPage` in `beforeLoad` and
  `RunPlacePage` in render, since the store can move under a page with no navigation.
- **The top nav is one `<nav aria-label="Main">` at every width**: below `md`, ☰ shows it
  in the page's flow (no portal, so static tests see every entry); a new pathname closes it.

## The gate
- **Params are untrusted; `resolveRunPage` is the only door.** A page reads the run
  through what it returns (`revealed(run)`, a `RevealedWorld`), never the store's `Run`.
  The type is the guard: a raw `World` fails `pnpm typecheck`.
- **A season's length is `season.rounds`**, never `races.length`, which stops at the
  cursor.

## The run bar
- **Pages read, the run bar acts.** A page never advances or edits the run (the
  cursor's own grid excepted), so a read-only run later is these pages with the bar's
  actions hidden. `SeasonPage` and `RunFrame` take actions as props and never use the
  router to act.
- **`runBarFor` and `runActionsFor` (`lib/run-bar.ts`) decide** what is offered and
  where; `RunBar` only draws them. A new action starts there.
- **Forward pushes a history entry; a restart replaces it** (the page left belongs to
  results that no longer exist).
- **Navigation never discards a run.** Only an explicit way out does (*Exit run*,
  confirming Back past the run's first page, Start over a run), and it asks only when
  the run is not `isUntouched`.
- **One dialog for everything that throws work away**: `RunConfirmDialog`, worded in
  `RUN_CONFIRM_COPY`. A new destructive action uses it.
- Start always **pushes** the run's first page: the Back-past-start blocker
  (`isBackPastStart`) depends on the setup page being the entry behind it.
