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
`{ kind: "varied", spread }` or `{ kind: "random" }`. The setting plumbing every what-if
shares is `.claude/rules/web-setup.md`. The historical answer is *As it was* on a
season's screen, as its other settings say, and the notes follow `unit` too (`COPY` in
`CarPerformanceSetting`), the era's saying "every season".

- **Chassis only.** An engine is shared by its customers, so rolling one would move
  several teams at once.
- **Varied** (`variedChassis` in `packages/data/src/chassis.ts`): one whole-number offset
  per team, uniform in [−spread, spread], on all four chassis ratings, each clamped to
  `CHASSIS_STEP_RANGE`. The spreads are `CAR_VARIATION_SPREADS` (±2, 5, 10, 20, 30); the
  control opens on ±10 and remembers a spread while the screen is open. Every year of an
  era is re-rolled off **that year's authored car**; *last year's car* (a walk) is not
  built — `docs/design/run-settings.md`.
- **Random** (`randomChassis`): each chassis rating drawn uniformly between that season's
  weakest and strongest value of it, each rating on its own.

## Its own stream

`rolledChassisOf(season, settings, seed)` in `lib/run-settings.ts` is the one place the
setting reaches the cars, as `driverPoolOf` is for drivers. It draws from
`createRng(deriveSeed(seed, CAR_PERFORMANCE_STREAM))`, never the race stream, so
Historical draws nothing and adding the roll shifted no race. `deriveSeed(seed, key)` in
the engine's rng module (FNV-1a over the key, mixed into the seed through splitmix32's
finaliser) is the start of the substreams `docs/design/era-advanced.md` §2 proposes.

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
spread, the clamp, Random inside each rating's range); `run-settings.test.ts` the parse,
the line and the stream; `store/era.test.ts` every year rolled from its own seed, no
edit on a rolled grid, the restarts, a kept rule on rolled cars, jumping equal to
stepping; `store/season.test.ts` the same roll in a standalone season, kept through a new
grid and re-rolled by a restart or the year next door. The popover's two figures sit behind a Radix portal, out of reach without
jsdom (`web-testing.md`): `pnpm screenshots` opens one on a ±20 era (`era-grid-team`).
