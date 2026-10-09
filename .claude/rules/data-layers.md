---
paths:
  - "packages/data/src/buildField.ts"
  - "packages/data/src/lineup.ts"
  - "packages/data/src/carryOver.ts"
  - "packages/data/src/keptGrid.ts"
  - "packages/data/src/arrange.ts"
  - "packages/data/src/people.ts"
  - "packages/data/src/engines.ts"
  - "packages/data/src/development.ts"
  - "packages/data/src/rating.ts"
---

# The layer over the seed data

These modules turn authored JSON into something else: a race field, a reallocated grid,
a headline number. The JSON's own shape and how a season is discovered are in
`.claude/rules/seed-data.md`, which loads alongside this file.

They are here rather than in `@alt-hist/engine` because **the engine may not read
data**, and rather than in `apps/web` because more than one consumer needs each of them.

- `buildField(season, pool, mode, teams, makers)` is the seam between authored data and
  the engine's runtime model. **`season` is required** — a field built from whichever
  year happened to be the default is the bug this seam exists to prevent.
  - It stamps each entrant with `driverCountry` (the driver's `nationality`),
    `teamCountry` (the team's `base` *for that season*, via `teamIdentityIn` — or under
    a trailing `keptFrom`, at its first season of the run, `firstYearInRun`) and
    `engineCountry` (the manufacturer's `base`), which is how home advantage reaches the
    engine without the engine reading this package. A team or engine missing from its
    pool gets no country and is never at home.
  - It stamps `engineId`, the season's `engine` ratings and any `developmentTrend`.
    **It does not blend** — `powertrain()` in the engine owns that, so the number raced
    and the number the grid page shows come from one place. Hence the entrant carries
    `chassis`, not `car`.
  - `mode` is `"aged"` (the default) or `"peak"`; see "Peak vs aged" in `CLAUDE.md`.
    `"aged"` calls the engine's `ratingsForSeason`, so this
    package depends on the engine at runtime — one-directionally, which is the
    invariant that matters.
- **A run setting reaches driver ratings through the pool**, never a flag: `buildField`,
  `arrangeLineup`, `carryOverLineup` and `reserveDrivers` all take one.
  `withoutCareerEvents(driver)` drops `stepDown` and `offSeasons`, so the curve runs
  plain; `driversWithoutCareerEvents()` is the whole pool without them, memoised (one
  array, for React dependencies) and built lazily, because this module and `index.ts`
  import each other. The web app picks the pool in `driverPoolOf` (`lib/run-settings.ts`).
- `engines.ts` is the supply layer over a season seed, and mirrors `lineup.ts`
  deliberately: a `SeasonEngines` is `Record<teamId, engineId>` with the same keys as
  the season it overrides, and `applyEngines(season, engines)` hands back a
  `SeasonSeed` that `buildField` consumes unchanged.
  - `authoredEngines`, `isAuthoredEngines`, `engineChanges` and `availableEngines`
    round it out. `availableEngines` orders the season's table by `engines.json` so a
    picker does not reshuffle itself between years; `engineSpecOf` is the lookup.
  - **A team can only be given an engine the season has.** `applyEngines` re-validates
    rather than trusting, because an override can arrive from a save file.
  - An `EngineChange` is `{ teamId, from, to }`, always both halves: a car has exactly
    one engine, so fitting one always removes another.
- `chassis.ts` is the same shape again for the grid editor's chassis what-if: a
  `SeasonChassis` is `Record<teamId, ChassisSpec>`, **absolute ratings, not offsets**, so
  a check is a range check; `applyChassis` validates whole numbers 0–100 (the seed
  data's own range). It never touches the authored data.
  - `stepChassis(chassis, teamId, ±1, key?)` moves one rating, or all four without a
    key, each clamped to `CHASSIS_STEP_RANGE` (1–100) on its own, and hands back the
    same object when nothing moved. `canStepChassis` says whether a step could move.
  - `authoredChassis`, `isAuthoredChassis` and `chassisChanges` (`{ teamId, from, to }`)
    mirror the engine functions.
  - `variedChassis` and `randomChassis` are *Chassis performance*'s rolls
    (`.claude/rules/car-performance.md`); `clamped` is the 1–100 clamp both rolls share.
- `engines.ts` also holds the engine what-ifs: a `SeasonEngineRatings` is
  `Record<engineId, EngineSpec>` over the season's menu, so a re-rating moves every team
  running that engine; `applyEngineRatings` validates it, and `variedEngines` /
  `randomEngines` are *Engine performance*'s rolls. `withFirstEngines(season, keptFrom)`
  is *Engine supplier changes: No*: each team on its first season in the run's engine
  (`firstYearInRun`'s rule), any the year does not rate added at its latest authored
  values (`latestEngineSpec`, which `keptGrid.ts` shares).
- `development.ts` is *In-season development*'s layer: `SeasonTrends`, `randomTrends`,
  `flatTrends`, `withTrends` (`.claude/rules/car-development.md`).
- `rating.ts` holds the display-only overall (`driverOverall`, `carOverall`). The
  weights are `DRIVER_WEIGHTS` / `CAR_WEIGHTS` there, move by hand, and carry their
  reasoning in the doc comments above them — read those, not a copy here. Both put most
  of the number on `racing`, the one rating the race score reads directly.
  - `qualifying` reaches a result only through the grid bonus, so `gridAdvantagePole`
    moves what a qualifying point is worth in direct proportion.
  - The car's reliability weight sits *above* qualifying, which
    `apps/web/src/lib/rating.test.ts` asserts.
  - It sits here, not in the web app, because the progression tool needs the same
    number and two copies would be two answers. `apps/web/src/lib/rating.ts`
    re-exports it.
  - `carOverall(chassis, engine)` takes a **chassis** and runs it through the engine's
    own `powertrain()` before weighting; omit the engine and it is the bare chassis. It
    never weights the engine itself — a second copy of the blend would be a second answer.
  - **`compareByRating` is the ranking rule** (glossary in `CLAUDE.md`): overall, then
    racing, best first. It returns 0 for two rows level on both, so the caller composes
    its own last word — the name in a list, the team or driver id in `arrange.ts`, last
    season's seat order in `carryOver.ts`. `carRacing(chassis, engine)` is the car half,
    the blend **unrounded** — rounding is what made the tie. `apps/web/src/lib/sort.ts`
    applies it on screen; see `.claude/rules/web-lists.md`.
- `lineup.ts` is the seat-allocation layer over a season seed: a `SeasonLineup` is
  `Record<teamId, driverIds>` with the same keys and seat counts as the season it
  overrides, and `applyLineup(season, lineup)` hands back a `SeasonSeed` that
  `buildField` consumes unchanged.
  - **Seat counts are never representable as changing.** `exchangePicks(lineup, a, b)`
    is the one primitive: whatever `a` holds goes to `b`'s seat and vice versa, so every
    operation preserves each team's seat count and the field size — which the starting
    limit and the DNQ arithmetic depend on. `swapDrivers(lineup, a, b)` is its
    driver-only face: it throws unless one of the two holds a seat, and a driver swapped
    with themselves is a no-op. `applyLineup` re-validates, because a lineup can arrive
    from a save file.
  - **Two shapes, and the difference is load-bearing.** A `SeasonLineup` has a driver
    in every seat and is what a world is run on and saved with; a `LineupDraft` may
    hold a `null` — an empty seat — and only the editor produces one. A `SeasonLineup`
    *is* a `LineupDraft` structurally, so there is one of each function, not two.
    **`filledLineup(draft)` is the single gate**: it returns a `SeasonLineup` or `null`,
    so a grid with a hole cannot be applied. `applyDraft` only builds a *preview* (open
    seats not entered) and must never stand in for `applyLineup`, whose exact seat-count
    check is what catches a save file that shrank.
  - A seat is addressed by `SeatRef` (`teamId` + zero-based `seat`); a `GridPick` is
    either a driver or a seat, which is what lets the editor hold an empty one.
    `emptySeats`, `driverAt` and `seatRefOf` read them back.
  - `authoredLineup`, `isAuthoredLineup`, `reserveDrivers` (alphabetical, everyone in
    the pool without a seat) and `lineupChanges` round it out. A `SeatChange` has
    `in.length === out.length` and `open` 0 on any *applied* grid — every arrival
    displaced someone — and the UI relies on it to print "X for Y". Mid-edit `open`
    counts empty seats and `out` runs longer, printing "Y out, seat empty".
- `arrange.ts` reseats the whole grid by **rule** — fastest drivers in fastest cars,
  fastest in slowest, or shuffled. It moves drivers only and has **no eligibility rule
  of its own**: who may come out of the pool is `matchesFilters` against the reserve
  list's filters, which travel inside the `GridArrangement`.
  `.claude/rules/grid-arrangements.md` has all of it.
- `people.ts` holds ages (`ratedAge`: peak age under `peak`, season age under `aged`)
  and the pool filters (`DriverFilters`, `defaultDriverFilters`, `matchesFilters`,
  `filterDrivers`). Nothing in it reaches the simulation — a filtered driver is hidden,
  not barred. It is here so `arrange.ts` and the list share one `matchesFilters`;
  `apps/web/src/lib/people.ts` re-exports it. What a filter means on screen is
  `.claude/rules/web-lists.md`.
- `carryOver.ts` is the editor's other bulk operation: **last season's drivers over
  this season's grid**. It moves people and nothing else — teams, seat counts and
  engines untouched — and a rename is invisible because a team is its id. Per driver:
  (1) their seat last season if this season has that team, (2) a car at the team they
  already drive for, (3) nothing. Nobody holds two seats, so (1) beating (2) is what
  makes cars fall vacant, and those holes are the point: the reader must fill them
  before the grid can be applied. A team that lost a car keeps the strongest of last
  year's drivers by `compareByRating`, last season's seat order settling a dead heat;
  one that gained a car fills the rest under (2). `CARRY_OVER_AGES` (16–55, against
  real age in the season, never peak age) is the one judgement in the file — a driver
  outside it is not carried, but can still be placed by hand.
- `keptGrid.ts` builds a year under *Keep the first season's teams* — the start
  year's teams on this year's cars, ghost entries, last year's drivers carried and empty
  seats signed. It shares `strongestOf` with `carryOver.ts` and `teamsByCar` / `byOverall`
  with `arrange.ts`. `.claude/rules/teams-and-seats.md`.
