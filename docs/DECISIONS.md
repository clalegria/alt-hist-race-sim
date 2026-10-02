# Open decisions

Questions waiting on the author. Confirm before implementing — do not assume. When one is
settled, **delete it here**: the outcome goes into `docs/ROADMAP.md` if it is work still to
do, or `.claude/rules/` once it is built. Why a constant has the value it has is not a
decision; it lives in the rule file for that constant.

## The advanced era and game mode

Their open questions — the market, the run settings, `adaptability`, engine deals — are
listed in `docs/design/era-advanced.md`, not here.

## The app shell

Its open questions — the router, how events surface, team URLs — are listed in
`docs/design/app-shell.md`, not here.

## Should the fitter and tuner move drivers?

`pnpm fit` and `pnpm tune` fit cars; drivers move only behind `--drivers`, off by default
(`tools/calibrate/src/targets.ts`). Whether driver ratings should ever be fitted, rather
than only authored by hand, is open.

## What does a saved or shared run replay against?

A recipe (seed, year, settings, grid edits) reproduces a run only on the same data and
engine, and the data moves two ways: the author retunes it between builds, and a reader
edits it in the ratings editor. Blocks the Share link's format (*routing and the app
shell*) and the editor's export. The options are not exclusive:

- **Stamp a hash** of the data and engine in every link and save; warn on a mismatch.
- **Keep old builds deployed** at versioned paths, so an old link opens on the build
  that made it.
- **Save the results, not just the recipe**, so a save file survives any change.
  `JSON.stringify(world)` is already a complete snapshot.
- **A reader's edits travel as a diff** against the authored data they were made on
  (a named *scenario*): inside the link when small, in the save file otherwise.
