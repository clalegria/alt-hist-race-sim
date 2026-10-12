---
paths:
  - "apps/web/src/store/**"
  - "apps/web/src/lib/seasons.ts"
  - "apps/web/src/lib/preferences.ts"
  - "apps/web/src/lib/seed.ts"
  - "apps/web/src/main.tsx"
---

# The store and the saved run

`store/season.ts` (the `World` and `Run`), `store/recipe.ts` and `store/persist.ts`
(the run kept through a reload). Each field's and action's reasoning is its doc comment.

## The world
- **Simulation state in the store, view state in `useState`**: an open row, a dialog's
  question and the grid editor's drafts are component state. A draft becomes simulation
  state only when Apply hands it to `setGrid`.
- **A reader's input is recorded on the `World` it shaped**, null when unchanged, the
  way `lineup` is; never a second record beside the run. `createWorld` normalises an
  edit that lands back on the baseline to null.
- **Baseline, not edit**: what a setting does to a year's grid (a roll, kept seats, a
  reseat) is the year's baseline, built in `baselineSeason` and re-derived by
  `enteredSeason` (`lib/seasons.ts`) through the same `withRunCars` order. Edits and
  "was this edited?" are measured from it; a new baseline step goes in both.
- **Settings reach the simulation in one place each**: constants through `runConstants`,
  driver ratings through `driverPoolOf`, cars through `rolledChassisOf`,
  `rolledEnginesOf` and `trendsOf`. Never a second path.
- **What one year of an era cannot see of the run** goes in `EraInputs`: recorded on the
  world, passed on by every in-place rebuild (`eraInputsOf`), built by `nextEraWorld`.
- **Every points table takes `world.points`**: never assume a scale or re-read the seed
  file's.
- **New randomness comes from the world's seed**, on its own `deriveSeed` stream
  (`car-performance.md`). `Math.random()` only picks a seed (`randomSeed` in
  `lib/seed.ts`); an era's next seed is `nextSeed`, never `randomSeed`.

## Preferences
- The randomness level, ability mode, run settings and year are **remembered to seed
  the next run** (`lib/preferences.ts`); the world keeps what it was built with. A grid
  edit is never remembered: it belongs to its year's entry list.
- `simulate` and `simulateEra` never read preferences: tests rely on their output
  depending only on their arguments.

## The saved run
- **The store module never touches storage.** `persist.ts` saves on one subscription,
  started from `main.tsx` before the router; `lib/preferences.ts` and `persist.ts`
  guard every access (absent under Vitest, throws in private browsing).
- **Only the recipe is stored, never worlds** (a long era outgrows `localStorage`).
  Every `World` field is either a `createWorld` argument the recipe records, or
  re-derived on rebuild from the seed, the settings or the world before (`rebuild`).
  A new field is one or the other; a new recorded one is checked in `runFromRecipe`
  (untrusted input) and bumps `RECIPE_VERSION`.
- **Seeds are stored per world**, never re-derived with `nextSeed`: a mid-era restart
  draws one nothing earlier could reproduce.
- **A refused run is by design.** The fingerprint refuses any run this build replays
  to a different world, a retuned rating included. Never make a stale recipe resume.
- One slot for the current run; share links and save files are separate features.
