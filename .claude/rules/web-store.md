---
paths:
  - "apps/web/src/store/**"
  - "apps/web/src/lib/seasons.ts"
  - "apps/web/src/lib/preferences.ts"
  - "apps/web/src/lib/seed.ts"
---

# Web app — the world and the store

What a season is built from, and what is kept about one. The screens around it, the
reveal cursor and how any of it is tested are in `.claude/rules/web-app.md`, which
loads alongside this file.

**Driver ability is a simulation input, not a display filter.** `world.ratingMode` is
`"peak"` (authored peaks, the default and the calibrated one) or `"aged"` (each
driver's ability in that season, via the engine's curve). `RatingModeToggle` renders
**only on the grid stage** — past it the reader has seen results the other field would
never have produced — and `setRatingMode` re-runs the year *from the same seed*, so
the two modes are the same dice thrown at different drivers.

**And only in a standalone season.** An era is pinned to `ERA_RATING_MODE` (`"aged"`),
with no switch anywhere in the run: "at their peak" answers a question about *one*
season — what if these people met at the best they ever were — while an era's whole
subject is the ageing curve, drivers arriving raw, coming good and falling away. Peak
ratings across twenty years would freeze everyone at one age and delete that. Three
places enforce it, and all three are needed: `startEra`/`simulateEra` build with the
constant rather than the remembered mode, `setRatingMode` returns early on an era
screen — **without remembering**, since the preference seeds the next *standalone*
season and would otherwise reach a screen the reader never connected it to — and
`SeasonScreen` passes `canChooseAbility={run === undefined}` so the control is not
drawn. A control that fires into a no-op is how the choice comes back by accident.

The choice **sticks**, via `lib/preferences.ts` (localStorage, guarded exactly as
`theme.ts` guards it — storage is absent under Vitest and throws in private
browsing). Two levels, and the split is the point: the *world* owns the mode it was
built with, so a finished season keeps reporting the ratings it actually raced; the
*preference* only seeds the next one. `startSeason` reads it, `setRatingMode` writes
it, `restartSeason` carries the world's own. `simulate` deliberately ignores it — it
is the entry point whose output must depend only on its arguments, and tests would
otherwise be order-dependent on whatever was last remembered.

**The grid is a simulation input too, in two halves.** `world.lineup` is the reader's
own driver allocation and `world.engines` their own engine supply — each **null for the
season as it was entered**, null rather than a copy of the authored one, so "was this
edited?" is a property of the world instead of a comparison somebody has to remember to
make. `createWorld` normalises an edit that lands back on the authored grid to null, so
undoing your last swap stops the notices.

Two fields rather than one because they are two questions — who drives the car, and
what is in the back of it — and either can be changed without the other. **One store
action, though**: `setGrid(lineup, engines)` applies both, because the editor applies
one draft and a reader who moved a driver *and* changed a supplier asked a single
question. Simulating a season in between would answer one nobody asked.

`setGrid` mirrors `setRatingMode` exactly: **grid stage only**, re-runs the year *from
the same seed*, and `restartSeason` carries it — an edited grid is something the reader
chose, like the ability mode. Unlike the ability mode it is **not** remembered in
localStorage: a lineup and a set of engine deals belong to the year they were drawn
for, so starting a season from the menu gets the real grid back.

**One store, one plain object.** `store/season.ts` holds a single `World`
(`{ seed, year, points, ratingMode, rngState, field, lineup, engines, season }`) — one
per season screen, none before one is started. `field` is the grid exactly as raced,
and is no longer derivable from the seed files: who is in it depends on `lineup`, what
they drive on `engines`, and their ratings on `ratingMode`. `points` is the year's
championship scale, off its seed file, for the same reason: it is the record of what
the season was actually scored on. Every table takes it — `championshipStandings`,
`constructorStandings`, the clinch functions, `pointsFor`, `driverRounds` and
`teamRounds` all require it, and `RaceClassification`, `StandingsTable` and
`SeasonCalendar` take it as a prop. Nothing anywhere assumes a scale.

**No `Rng` in the world** — it holds a closure and cannot be serialized. What is
stored is its numeric `getState()` snapshot, which `createRngFromState` turns back
into a generator positioned exactly where the season ended. `JSON.stringify(world)` is
therefore already a complete save file, and tests assert both the round trip and that
no function or class instance has crept in.

View state that says nothing about the simulation — which race row is expanded, the
start-again confirming flag, the grid editor's **draft** lineup and draft engines —
stays in component `useState`. The rule is that *simulation* state lives in the one
store, not that React may never hold anything. A draft becomes simulation state at the
moment Apply hands it to `setGrid`, and not before: applying re-runs fourteen races, and
a reader halfway through moving four drivers has not yet asked a question worth
answering. The two drafts open and close together, so one `null` answers for both.

While the editor is open, `App` takes the **forward buttons away** — `GridStage`
raises `onEditingChange` and `Actions` shows a note instead. Stepping on mid-edit
would discard the draft silently *and* reveal a season run on the grid the reader was
in the middle of replacing.

**Standings are derived in the component, not stored:** `championshipStandings` and
`constructorStandings` run in a `useMemo` off `world.season`. Mid-season standings
need no special support — `{ races: races.slice(0, n) }` *is* the table after round n.

A fresh random seed is drawn each time a season is started, from the picker and by
Start again. That is **not** a violation of the no-`Math.random()` rule: choosing
*which* seed to run happens before any generator exists, so it lives in `lib/seed.ts`
and never in `packages/engine`.
