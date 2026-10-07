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
`"peak"` (authored peaks, and the default) or `"aged"` (each
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
`SeasonPage` passes `canChooseAbility={run === undefined}` so the control is not
drawn. A control that fires into a no-op is how the choice comes back by accident.

**`switchSeasonYear(year)` is the grid's shortcut to the season next door.** It is
`startSeason` in every respect but where the settings come from: the ability mode and
the randomness level are taken off the *world on screen* rather than off the remembered
preferences, so stepping through a decade keeps the rules the reader chose for the
first of them. The grid does not carry — a lineup and a set of supply deals belong to
the entry list they were drawn for — and the dice are fresh. Standalone seasons only,
and only on the grid stage, guarded exactly as `setGrid` and `setRatingMode` are. It
writes the year through `rememberSeasonYear`, since it is the same choice the picker
makes.

The choice **sticks**, via `lib/preferences.ts` (localStorage, guarded exactly as
`theme.ts` guards it — storage is absent under Vitest and throws in private
browsing). Two levels, and the split is the point: the *world* owns the mode it was
built with, so a finished season keeps reporting the ratings it actually raced; the
*preference* only seeds the next one. `startSeason` reads it, `setRatingMode` writes
it, `restartSeason` carries the world's own. `simulate` deliberately ignores it — it
is the entry point whose output must depend only on its arguments, and tests would
otherwise be order-dependent on whatever was last remembered.

**The grid is a simulation input too, in three parts.** `world.lineup` is the reader's
own driver allocation, `world.engines` their own engine supply and `world.chassis` their
own chassis ratings — each **null for the season as it was entered**, null rather than a
copy of the authored one, so "was this edited?" is a property of the world instead of a
comparison somebody has to remember to make. `createWorld` normalises an edit that lands
back on the authored grid to null, so undoing your last swap stops the notices.

Separate fields because they are separate questions — who drives the car, what is in the
back of it, how good the car is — and any can be changed without the others. **One store
action, though**: `setGrid(lineup, engines, arrangement?, chassis?)` applies them all,
because the editor applies one draft and a reader who moved a driver *and* changed a
supplier asked a single question. Simulating a season in between would answer one nobody
asked. `chassis` is last (in `createWorld` too) only so earlier callers stay unchanged.

A third field rides with them: `world.arrangement`, the bulk rule the grid was arranged
by, which `setGrid` takes as its optional third argument. It is a record of *how* the
lineup came to be rather than a second copy of it, and it is the one part of an edited
grid that is re-derived rather than carried — see
`.claude/rules/grid-arrangements-app.md`, which loads on this file.

`setGrid` mirrors `setRatingMode` exactly: **grid stage only**, re-runs the year *from
the same seed*, and `restartSeason` carries it — an edited grid is something the reader
chose, like the ability mode. Unlike the ability mode it is **not** remembered in
localStorage: a lineup and a set of engine deals belong to the year they were drawn
for, so starting a season from the menu gets the real grid back.

**Randomness is chosen once and never again.** `world.randomness` is a level 1–5 —
the setup screen opens on `STARTING_RANDOMNESS_LEVEL` (2), which is the app's opening
offer and deliberately not the engine's `DEFAULT_RANDOMNESS_LEVEL` (1, the level the
harnesses measure at) — picked on the setup screen of *both* modes — `SeasonPicker`
holds it in component state seeded from `readRandomness()` and hands it to `onStart`,
which is why `startSeason`/`startEra` take it as an argument rather than reading storage
themselves. It reaches the model as `withRandomness(level)`, a derived copy of the
constants; at `UNSCALED_RANDOMNESS_LEVEL` it *is* `RACE_CONSTANTS`, untouched. Nothing on a season screen
changes it — `setRatingMode`, `setGrid` and `restartSeason` all carry it forward, and an
era carries `last.randomness` into every following year, so a run is one championship
under one set of rules. **`world.settings`** (`RunSettings`, `lib/run-settings.ts`) is
chosen, carried and remembered exactly the same way, through every action that rebuilds
a year and into every year of an era; `createWorld` takes it last, and races on
`runConstants(entered, randomness, settings)` — the one place settings reach the constants; the
drivers come from `driverPoolOf(settings)`, the one place they reach the ratings, which
`arrangedLineup` and the grid editor (`GridStage`'s `pool`) read too. **`namesKeptFrom`**
is the era's first year under *Team names: Keep the first*, else null: one year of an era
cannot know where the era began, so `createWorld` takes it after `settings` (defaulting to
its own year, right for a first year) and every action that rebuilds a year passes the
world's own on; `nextEraWorld` passes `last.namesKeptFrom`. The grid stage states
the level (`RandomnessNote`) and any non-historical setting beneath it, and offers no
control; the season summary and the roll of honour carry it as one small line
(`SimulationSettings`), which is written as a *list* of settings because more are coming
— adding one is a line in `settingsOf`, not a rewrite of the copy on two screens. Remembered in localStorage beside the ability mode, both being answers the
*next* run is simulated against rather than ways of reading a table.

**One store, one plain object.** `store/season.ts` holds a single `World`
(`{ seed, year, points, ratingMode, randomness, settings, namesKeptFrom, rngState, field,
lineup, engines, chassis, arrangement, season }`) — one
per season screen, none before one is started. `field` is the grid exactly as raced,
and is no longer derivable from the seed files: who is in it depends on `lineup`, what
they drive on `engines` and `chassis`, and their ratings on `ratingMode`. `points` is the year's
championship scale, off its seed file unless `settings.points` names one for the whole
run, for the same reason: it is the record of what
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
question a dialog is asking, the grid editor's **drafts** of lineup, engines and chassis —
stays in component `useState`. The rule is that *simulation* state lives in the one
store, not that React may never hold anything. A draft becomes simulation state at the
moment Apply hands it to `setGrid`, and not before: applying re-runs fourteen races, and
a reader halfway through moving four drivers has not yet asked a question worth
answering. The drafts open and close together, so one `null` answers for all of them.

While the editor is open, the run bar takes the **forward buttons away** — `GridStage`
raises `onEditingChange`, the grid page passes it up through `GridEditingContext`, and
`RunActions` shows a note instead. Stepping on mid-edit
would discard the draft silently *and* reveal a season run on the grid the reader was
in the middle of replacing.

**Standings are derived in the component, not stored:** `championshipStandings` and
`constructorStandings` run in a `useMemo` off `world.season`. Mid-season standings
need no special support — `{ races: races.slice(0, n) }` *is* the table after round n.

A fresh random seed is drawn each time a season is started, from the picker and by
either restart. That is **not** a violation of the no-`Math.random()` rule: choosing
*which* seed to run happens before any generator exists, so it lives in `lib/seed.ts`
and never in `packages/engine`.
