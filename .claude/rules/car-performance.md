---
paths:
  - "apps/web/src/components/CarPerformanceSetting.tsx"
  - "apps/web/src/components/EnginePerformanceSetting.tsx"
  - "apps/web/src/components/PerformanceSetting.tsx"
  - "apps/web/src/lib/run-settings.ts"
  - "apps/web/src/lib/seasons.ts"
  - "packages/data/src/chassis.ts"
  - "packages/data/src/engines.ts"
  - "packages/engine/src/rng/index.ts"
---

# Chassis and Engine performance — a run's own cars

Two run settings in the settings dialog's **Cars** group, on both screens, with the same
answers: *Historical* / *Random factor is added* / *Totally random*, stored as
`RunSettings.carPerformance` (*Chassis performance*) and `RunSettings.enginePerformance`
(*Engine performance*) — each null, `{ kind: "varied", spread, from }` or
`{ kind: "random" }`. The setting plumbing every what-if shares is
`.claude/rules/web-run-settings.md`. One control, `PerformanceSetting`, draws both;
`CarPerformanceSetting` and `EnginePerformanceSetting` bring the name, the *Each year starts from*
answers and the notes (`COPY`, following `unit`: the era's say "every year"). The notes
say what the reader sees, in rating points, not how a roll is drawn.

- **Random factor is added**, `"varied"`: one whole-number offset, uniform in
  [−spread, spread], on every rating, each clamped to `CHASSIS_STEP_RANGE`
  (`variedChassis` in `packages/data/src/chassis.ts`, four ratings per team;
  `variedEngines` in `engines.ts`, three per engine). The spreads are
  `CAR_VARIATION_SPREADS` (±2, 5, 10, 20, 30); the control opens on ±10 and remembers a
  spread while the screen is open. `from` is what the offset moves off
  (`CAR_VARIATION_BASES`, the era's *Each year starts from* row): `"real"`, **the real
  chassis / engine**, re-rolled each year; or `"last"`, **last year's** — a walk
  (below).
- **Totally random**, `"random"` (`randomChassis`, `randomEngines`): each rating drawn
  uniformly between that season's weakest and strongest value of it, on its own.
- **An engine is rolled per engine, not per team**: over the season's `engines` menu, so
  every team running one races the same roll. It is applied as a re-rated menu
  (`applyEngineRatings`), the shape `buildField` already reads.

## Their own streams

`rolledChassisOf(season, settings, seed, lastRaced)` and `rolledEnginesOf(...)` in
`lib/run-settings.ts` are the one place each setting reaches the cars, as `driverPoolOf`
is for drivers. Each draws from `createRng(deriveSeed(seed, key))` under its own key
(`CAR_PERFORMANCE_STREAM`, `ENGINE_PERFORMANCE_STREAM`), never the race stream, so
Historical draws nothing, and turning one on moves neither the other roll nor any race.
`deriveSeed(seed, key)` in the engine's rng module (FNV-1a over the key, mixed into the
seed through splitmix32's finaliser) is the start of the substreams
`docs/design/era-advanced.md` §2 proposes.

## Last year's: the walk

Era only: `seasonSettings` turns `"last"` into `"real"` for a standalone season, and its
screen draws no *Each year starts from* row (the component keeps the era's answer while open).

- Each team moves off the chassis it **raced** the year before in this run —
  `racedChassis(world)` in the store: the reader's `chassis`, else the roll, else the
  authored car. So a reader's chassis edit carries into the walk, the one way an edit
  crosses a year. Each engine moves off `racedEngineRatings(world)`: the roll, else the
  values the year entered with. A team or engine not in the year before moves off its
  own authored values, and so does everything in the run's first year.
- `variedChassis` / `variedEngines` take those as `from`, and draw the same numbers
  whatever `from` holds.
- `World.walkedFrom` and `World.engineWalkedFrom` record what they moved off (null unless
  walking, and in a first year), the `namesKeptFrom` pattern: `nextEraWorld` passes
  `racedChassis(last)` and `racedEngineRatings(last)` as `createWorld`'s `era.lastRaced`
  and `era.lastRacedEngines`, and every action that rebuilds a year in place (`setGrid`,
  `restartSeason`) passes the world's own on. `restartEra`
  passes null. The recipe does not store them: `rebuild` hands each world the one
  rebuilt before it.
- **The pull back to the pack.** Before its roll, a walked car's every rating moves
  `CAR_WALK_PULL` of the way towards that season's authored field average for it
  (`pulled` in `chassis.ts`; an engine towards its menu's average), rounded. Without it
  the grid spreads out for ever, the front and back teams stay put and ratings pile up
  against the clamp; with it a car's shape fades towards the field's too. The anchor is
  the field, not the team's real car, so history stays alternate. A car moving off its
  own authored values is not pulled, and the pull draws nothing.

## The baseline, not an edit

`createWorld` rolls once and keeps the results as `World.baselineChassis` and
`World.baselineEngineRatings` (null when Historical); never re-rolled on read, and the
recipe does not record them — the seed rebuilds them and the fingerprint checks them.
`withRunCars(season, world)` in `lib/seasons.ts` puts the run's own cars into a season —
kept engines, then the chassis roll, the engine roll and the development trends — and is
the one order both `createWorld` (`baselineSeason`) and `enteredSeason(world)` apply.
`enteredSeason` is the season *as the run entered it*, and everything that asks "was this
edited?" compares against it: `createWorld`'s normalising of `lineup`, `engines` and
`chassis` (so `isUntouched` holds on a rolled grid), the grid editor's Restore and
`untouched`, `chassisChanges` on the grid and the summary. A reader's `chassis` stays
absolute ratings over it.

- `setGrid` keeps the seed, so the rolls; **both restarts,
  `switchSeasonYear` and `setRunSettings` draw a new seed and so re-roll**, the settings
  carried and the reader's own chassis carrying as the ratings they are.
- The reseat under *Who drives where* is `baselineSeason`'s last step, so it ranks that
  year's rolled cars.
- The team popover reads *Real → this run*: `SeasonGrid`'s `historicalChassis`
  (authored, passed only when the run rolled its own) puts the authored rating muted
  before each chassis bar, and `historicalEngines` (`historicalEngineRatings(world)`)
  does the same for the engine panel, whose header then says so in place of "spec".

## Testing

`chassis.test.ts` and `engines.test.ts` check the rolls against synthetic seasons (one
offset within the spread, the clamp, Random inside each rating's range, a walk off `from`
pulled towards the average and a newcomer off its own values, every customer of an engine
alike);
`run-settings.test.ts` the parse, the line, the streams and the season dropping the walk;
`store/era.test.ts` (chassis) and `store/run-settings-era.test.ts` (engines) every year
rolled from its own seed, no edit on a rolled grid, the restarts, the walk, and jumping
equal to stepping; `recipe.test.ts` a walking era's round trip; `store/season.test.ts`
the roll in a standalone season. The popover's figures sit behind a Radix portal, out of
reach without jsdom (`web-testing.md`): `pnpm screenshots` opens one on a ±20 era
(`era-grid-team`).
