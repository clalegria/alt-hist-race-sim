---
paths:
  - "apps/web/src/components/CarPerformanceSetting.tsx"
  - "apps/web/src/lib/run-settings.ts"
  - "apps/web/src/lib/seasons.ts"
  - "packages/data/src/chassis.ts"
  - "packages/engine/src/rng/index.ts"
---

# Car performance — a run's own cars

A run setting in the setup card's **Cars** group, on both setup screens: *Historical* /
*Varied* / *Random*, stored as `RunSettings.carPerformance` — null,
`{ kind: "varied", spread, from }` or `{ kind: "random" }`. The setting plumbing every what-if
shares is `.claude/rules/web-setup.md`. The historical answer is *As it was* on a
season's screen, as its other settings say, and the notes follow `unit` too (`COPY` in
`CarPerformanceSetting`), the era's saying "every season".

- **Chassis only.** An engine is shared by its customers, so rolling one would move
  several teams at once.
- **Varied** (`variedChassis` in `packages/data/src/chassis.ts`): one whole-number offset
  per team, uniform in [−spread, spread], on all four chassis ratings, each clamped to
  `CHASSIS_STEP_RANGE`. The spreads are `CAR_VARIATION_SPREADS` (±2, 5, 10, 20, 30); the
  control opens on ±10 and remembers a spread while the screen is open. `from` is what
  the offset moves off (`CAR_VARIATION_BASES`, the era's *Varies from* row): `"real"`,
  **that year's authored car**, re-rolled each year; or `"last"`, **previous year's car** — a
  walk (below).
- **Random** (`randomChassis`): each chassis rating drawn uniformly between that season's
  weakest and strongest value of it, each rating on its own.

## Its own stream

`rolledChassisOf(season, settings, seed, lastRaced)` in `lib/run-settings.ts` is the one place the
setting reaches the cars, as `driverPoolOf` is for drivers. It draws from
`createRng(deriveSeed(seed, CAR_PERFORMANCE_STREAM))`, never the race stream, so
Historical draws nothing and adding the roll shifted no race. `deriveSeed(seed, key)` in
the engine's rng module (FNV-1a over the key, mixed into the seed through splitmix32's
finaliser) is the start of the substreams `docs/design/era-advanced.md` §2 proposes.

## Previous year's car: the walk

Era only: `seasonSettings` turns `"last"` into `"real"` for a standalone season, and its
screen draws no *Varies from* row (the component keeps the era's answer while open).

- Each team moves off the chassis it **raced** the year before in this run —
  `racedChassis(world)` in the store: the reader's `chassis`, else the roll, else the
  authored car. So a reader's chassis edit carries into the walk, the one way an edit
  crosses a year. A team that did not enter the year before moves off its own authored
  car, and so does every team in the run's first year.
- `variedChassis(season, spread, rng, from)` takes those cars as `from`, and draws the
  same numbers whatever `from` holds.
- `World.walkedFrom` records the cars it moved off (null unless walking, and in a first
  year), the `namesKeptFrom` pattern: `nextEraWorld` passes `racedChassis(last)` as
  `createWorld`'s `era.lastRaced`, and every action that rebuilds a year in place
  (`setGrid`, `setRatingMode`, `restartSeason`, `nextLineup`) passes the world's own on.
  `restartEra` passes null. The recipe does not store it: `rebuild` hands each world the
  one rebuilt before it.
- Plain walk, no pull back towards the authored car: at ±20 or ±30 ratings reach the
  clamp within a few years. Whether to revert to the mean is open in
  `docs/DECISIONS.md`.

## The baseline, not an edit

`createWorld` rolls once and keeps the result as `World.baselineChassis` (null when
Historical); it is never re-rolled on read, and the recipe does not record it — the seed
rebuilds it and the fingerprint checks it. `seasonWithChassis(year, baselineChassis)` in
`lib/seasons.ts` is the season *as the run entered it*, and everything that asks "was
this edited?" compares against it: `createWorld`'s normalising of `lineup`, `engines` and
`chassis` (so `isUntouched` holds on a rolled grid), the grid editor's Restore and
`untouched`, `chassisChanges` on the grid and the summary. A reader's `chassis` stays
absolute ratings over it.

- `setGrid` and `setRatingMode` keep the seed, so the roll; **both restarts and
  `switchSeasonYear` draw a new seed and so re-roll**, the setting carried and the
  reader's own chassis carrying as the ratings they are.
- `arrangedLineup` builds from the baseline season for its seed, so a bulk rule kept
  across an era ranks that year's rolled cars.
- The team popover reads *History → this run*: `SeasonGrid`'s `historicalChassis`
  (authored, passed only when the run rolled its own) puts the authored rating muted
  before each chassis bar. The engine panel is unchanged.

## Testing

`chassis.test.ts` checks the rolls against a synthetic season (one offset within the
spread, the clamp, Random inside each rating's range, a walk off `from` and a newcomer
off its own car); `run-settings.test.ts` the parse, the line, the stream and the season
dropping the walk; `store/era.test.ts` every year rolled from its own seed, no
edit on a rolled grid, the restarts, a kept rule on rolled cars, jumping equal to
stepping, and the walk's own block (the offset off the previous year's raced car, a newcomer, an
edit carried, `walkedFrom` kept through a new grid and a restart); `recipe.test.ts` a
walking era's round trip; `store/season.test.ts` the same roll in a standalone season, kept through a new
grid and re-rolled by a restart or the year next door. The popover's two figures sit behind a Radix portal, out of reach without
jsdom (`web-testing.md`): `pnpm screenshots` opens one on a ±20 era (`era-grid-team`).
