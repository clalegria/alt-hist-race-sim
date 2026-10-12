# The in-app ratings editor, and keeping a run

## The editor

Turns on the `edit-ratings` card. **A player feature first**: someone who disagrees with a
rating changes it and runs their own what-if. Drivers, teams/chassis, engines, and circuits
once *circuit character* lands. The grid editor's `stepChassis` re-rates one run; this
changes the data itself.

- DECIDED: **the driver screen is the career curve**, as a table and a chart: age along
  the bottom, ratings up the side, the authored peak marked (`pnpm progression` in the UI,
  on `StandingsEvolution.tsx`'s charting).
- DECIDED: **it edits the curve, not the year**: the `peak` block and career shape
  (`peakSeasons`, `developmentSpeed`, `declineSpeed`, `stepDown`), showing the derived
  rating per season. No per-year edit solved back to a curve. Teams, engines and circuits
  are per season already.
- DECIDED: edits apply to the user's run and survive the sitting, through file export and
  import first; Dexie over IndexedDB later. An imported file is untrusted input: validate it.
- DECIDED: **export in the authored seed format** (`drivers.json`, `teams.json`,
  `engines.json`, `seasons/<year>.json`), so a user's tuning can be sent in as data.
  OPEN: always on, or behind a flag.
- OPEN: what a run on edited data replays against (`docs/DECISIONS.md`).

## Four ways to keep or pass on a run

| | Carries | Survives a new build? | When |
|---|---|---|---|
| **Save file** | recipe and every world | yes | with the editor |
| **Read-only view** | a snapshot, no Continue | yes | after save files |
| **Share link** | recipe and how far through | no, replays | someday |
| **Account / other device** | a save file, uploaded | yes | a backend phase |

- A snapshot can be continued: each world carries its `rngState`.
- The read-only view is the run's pages with the run bar's actions hidden, which holds only
  while pages never act on the run (`web-routing.md`).
- **Share link**: a Share button beside Continue; `/share?…` is an entry-only route that
  rebuilds the run from the recipe (`web-store.md`) and cursor, then redirects. Its
  format waits on the replay decision. A game-mode run (seed plus decision log) can
  outgrow a URL, so it shares as a save file.
- Backend, only if a later phase needs one: Hono + SQLite/Postgres + Drizzle.
