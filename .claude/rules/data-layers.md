---
paths:
  - "packages/data/src/buildField.ts"
  - "packages/data/src/lineup.ts"
  - "packages/data/src/carryOver.ts"
  - "packages/data/src/arrange.ts"
  - "packages/data/src/people.ts"
  - "packages/data/src/engines.ts"
  - "packages/data/src/rating.ts"
---

# The layer over the seed data

Four modules turn authored JSON into something else: a race field, a reallocated grid,
a headline number. The JSON's own shape, how a season is discovered and the rules about
tuning it are in `.claude/rules/seed-data.md`, which loads alongside this file.

They are here rather than in `@alt-hist/engine` because **the engine may not read
data**, and rather than in `apps/web` because more than one consumer needs each of them.

- `buildField(season, pool, mode, teams)` is the seam between authored data and the
  engine's runtime model. **`season` is required** — a field built from whichever year
  happened to be the default is the bug this seam exists to prevent. It lives here
  rather than in either package: the engine may not read data, and every consumer that
  wants to run a race needs exactly this mapping.
  - It stamps each entrant with `driverCountry` (the driver's `nationality`) and
    `teamCountry` (the team's `base`), which is how home advantage reaches the engine
    without the engine ever reading this package. A team missing from the pool gets no
    `teamCountry` and races everywhere as a visitor.
  - It stamps `engineId` and the season's `engine` ratings the same way. **It does not
    blend them** — `powertrain()` in the engine package owns that, so the number the
    race is run on and the number the grid page shows come from one place. The entrant
    therefore carries `chassis`, not `car`: the blend has not happened yet.
  - `mode` is `"peak"` (default) or `"aged"`. **Peak is the default and must stay
    that way** — it feeds authored peaks straight in, which is the simplest claim a
    grid can make about a driver. `"aged"` calls the engine's ageing curve for the
    season's year, and is what the harnesses run.
  - This package now calls **into** the engine at runtime (`ratingsForSeason`), so
    the dependency is no longer type-only. Still one-directional: the engine imports
    nothing from here, and that is the invariant that matters.
- `engines.ts` is the supply layer over a season seed, and mirrors `lineup.ts`
  deliberately: a `SeasonEngines` is `Record<teamId, engineId>` with the same keys as
  the season it overrides, and `applyEngines(season, engines)` hands back a
  `SeasonSeed` that `buildField` consumes unchanged.
  - `authoredEngines`, `isAuthoredEngines`, `engineChanges` and `availableEngines`
    round it out. `availableEngines` orders the season's table by `engines.json` so a
    picker does not reshuffle itself between years; `engineSpecOf` is the lookup.
  - **A team can only be given an engine the season has.** `applyEngines` re-validates
    rather than trusting, because an override can arrive from a save file — the same
    reason `applyLineup` does.
  - An `EngineChange` is `{ teamId, from, to }`, always both halves: a car has exactly
    one engine, so fitting one always removes another. Swapping one changes the car
    without touching the chassis, which is the distinction the two names exist for.
- `rating.ts` holds the display-only overall rating (`driverOverall`, `carOverall`).
  Both weightings put most of the number on `racing`, the one rating the race score
  reads directly: drivers 0.70 / qualifying 0.14 / composure 0.07 / consistency 0.05 /
  wetWeather 0.04 / adaptability 0; cars 0.76 / qualifying 0.10 / reliability 0.11 /
  consistency 0.03. `wetWeather` is small because only ~15% of rounds are wet, not
  because a wet race cares little about it; `qualifying` reaches a result only through
  grid position, which is a narrow channel but much the widest of the supporting four,
  and the whole of it is the grid bonus — so `gridAdvantagePole` moves what a
  qualifying point is worth in direct proportion.
  - **`racing` is pitched for the field, not for the front.** What it is worth depends
    on where on the grid you stand: it is most of a backmarker's worth, where nothing
    else has room to matter, and much less of a title contender's, where the supporting
    four decide championships between drivers whose pace is level. One weight serves
    both, and it is weighted by headcount — a grid is mostly midfield and back.
  It sits here, not in the web app, because the progression tool needs the same
  number and two copies of those weights would be two answers to "how good is this
  driver". `apps/web/src/lib/rating.ts` re-exports it.
  - **The car's reliability weight is a compromise no era agrees with, and knowingly
    errs low.** Reliability touches no score — it decides whether the car finishes — so
    what a reliability point is worth tracks the season's `retirementFactor`, and that
    spans a wide range across 1950-2026 while this formula does not vary by season. It
    is pitched under the middle of that range because a grid page is read as "how quick
    is this car", and because the error is far more visible in a low-attrition season,
    where results track pace closely, than in a high-attrition one, where they are
    scattered anyway. In the attrition eras reliability is worth more than 0.11 and the
    overall does not say so. Reliability sits *above* qualifying, which is the ordering
    `rating.test.ts` asserts.
  - `carOverall(chassis, engine)` takes a **chassis** and runs it through the engine's
    own `powertrain()` before weighting, so the headline number describes the car that
    gets raced. Omit the engine and it is the bare chassis. It never weights the engine
    itself — with two blend ratios in play, a second copy would be twice as wrong.
  - **`compareByRating` is how drivers and teams are put in order, everywhere: overall
    first, racing second, best first.** An overall is a *rounded* weighted average, so two
    rows on 84 is ordinary rather than exotic, and racing is most of that weight and the
    one rating the race score reads directly — the racier of the two is the one the season
    will treat as quicker, and answering the tie alphabetically answers a question nobody
    reading a rating column is asking. It deliberately stops there, returning 0 for two
    rows level on both, so the caller composes its own last word: the name in a list, the
    team id or driver id in `arrange.ts`, last season's seat order in `carryOver.ts`.
    `carRacing(chassis, engine)` is the car half, the blend and **unrounded** — nothing
    prints it, and rounding is the thing that made the tie. `apps/web/src/lib/sort.ts`
    applies it to both lists on screen; see `.claude/rules/web-lists.md`.
- `lineup.ts` is the seat-allocation layer over a season seed: a `SeasonLineup` is
  `Record<teamId, driverIds>` with the same keys and the same seat counts as the
  season it overrides, and `applyLineup(season, lineup)` hands back a `SeasonSeed`
  that `buildField` consumes unchanged. It lives here because it is a transformation
  of seed data, and because the driver market will want the same shape.
  - **Seat counts are never representable as changing.** `exchangePicks(lineup, a, b)`
    is the one primitive: whatever `a` holds goes to `b`'s seat and whatever `b` holds
    goes to `a`'s, so every operation preserves each team's seat count and therefore
    the size of the field — which is what the starting limit and the DNQ arithmetic
    depend on. `swapDrivers(lineup, a, b)` is its driver-only face, kept
    because most callers only ever move people: it requires one of the two to hold a
    seat and throws otherwise, and a driver swapped with themselves is a no-op.
    `applyLineup` re-validates rather than trusting, because a lineup can arrive from
    a save file.
  - **Two shapes, and the difference is load-bearing.** A `SeasonLineup` has a driver
    in every seat and is what a world is run on and saved with; a `LineupDraft` may
    hold a `null` — a seat nobody is in yet — and only the editor produces one.
    A `SeasonLineup` *is* a `LineupDraft` structurally, so there is one of each
    function rather than two. **`filledLineup(draft)` is the single gate**: it returns
    a `SeasonLineup` or `null`, so a grid with a hole cannot be applied and no caller
    has to remember to check. `applyDraft` exists only to build a *preview* of a draft
    (open seats simply not entered) and must never stand in for `applyLineup`, whose
    exact seat-count check is what catches a save file that shrank.
  - A seat is addressed by `SeatRef` (`teamId` + zero-based `seat`); a `GridPick` is
    either a driver or a seat, which is what lets the editor hold an empty one.
    `emptySeats`, `driverAt` and `seatRefOf` read them back.
  - `authoredLineup`, `isAuthoredLineup`, `reserveDrivers` (alphabetical, everyone in
    the pool without a seat) and `lineupChanges` round it out. A `SeatChange` has
    `in.length === out.length` on any *applied* grid — seats are preserved, so every
    arrival displaced someone — and the UI relies on it to print "X for Y". Mid-edit
    it can carry an `open` count and a longer `out`, which prints "Y out, seat empty".
- `arrange.ts` is the editor's other bulk operation, and the fun one: the whole grid
  reseated by **rule** rather than by hand — fastest drivers in fastest cars, fastest in
  slowest, or shuffled. Like the carry-over it moves drivers and nothing else, and like
  the carry-over it has **no eligibility rule of its own**: who may be promoted out of
  the pool is `matchesFilters` against the filters the reader set on the grid editor's
  own "Without a drive" panel, which travel inside the `GridArrangement`.
  `.claude/rules/grid-arrangements.md` has all of it.
- `people.ts` is what makes that possible, and the reason it is here rather than in the
  web app: ages (`ratedAge`, a driver's *peak* age under `peak` mode and their season age
  under `aged`) and the pool filters (`DriverFilters`, `defaultDriverFilters`,
  `matchesFilters`, `filterDrivers`). Nothing in it is a rating and nothing reaches the
  simulation — a filtered driver is hidden from a list, not barred from a seat — but
  `arrange.ts` reads the same filters that list is narrowed by, and two copies would be
  two answers. `apps/web/src/lib/people.ts` re-exports it, exactly as `lib/rating.ts`
  re-exports the overall, so the app keeps one import path. What a filter *means* on
  screen, and what each one opens on, is `.claude/rules/web-lists.md`.
- `carryOver.ts` is the editor's one bulk operation: **last season's drivers over this
  season's grid**. Teams, seat counts and engines are untouched — it moves people and
  nothing else — and a rename is invisible by construction, because a team is its id.
  The rule, per driver, is (1) their seat last season if this season has that team,
  (2) a car at the team they already drive for, (3) nothing. Nobody holds two seats, so
  (1) beating (2) is what makes cars fall vacant, and those holes are the point: the
  reader has to say who drives them before the grid can be applied. A team that lost a
  car carries over the strongest of last year's drivers by `compareByRating`, last
  season's seat order settling a dead heat; one that
  gained a car fills the rest under (2). `CARRY_OVER_AGES` (16–55, read against real
  age in the season, never peak age) is the one judgement in the file — a driver
  outside it is not carried, and is not barred from being placed by hand.
