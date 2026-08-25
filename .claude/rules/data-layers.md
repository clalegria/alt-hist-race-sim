---
paths:
  - "packages/data/src/buildField.ts"
  - "packages/data/src/lineup.ts"
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
    race is run on and the number the grid page shows come from one place.
  - `mode` is `"peak"` (default) or `"aged"`. **Peak is the default and must stay
    that way** — it feeds authored peaks straight in, which is what the 1980
    calibration was measured against. `"aged"` calls the engine's ageing curve for
    the season's year.
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
    one engine, so fitting one always removes another.
- `rating.ts` holds the display-only overall rating (`driverOverall`, `carOverall`).
  It sits here, not in the web app, because the progression tool needs the same
  number and two copies of those weights would be two answers to "how good is this
  driver". `apps/web/src/lib/rating.ts` re-exports it.
- `lineup.ts` is the seat-allocation layer over a season seed: a `SeasonLineup` is
  `Record<teamId, driverIds>` with the same keys and the same seat counts as the
  season it overrides, and `applyLineup(season, lineup)` hands back a `SeasonSeed`
  that `buildField` consumes unchanged. It lives here because it is a transformation
  of seed data, and because the driver market will want the same shape.
  - **Only swaps are representable.** `swapDrivers(lineup, a, b)` preserves every
    team's seat count and therefore the size of the field — which is what the
    starting limit and the DNQ arithmetic are calibrated against. It requires at
    least one of the two to hold a seat and throws otherwise; a driver swapped with
    themselves is a no-op. `applyLineup` re-validates rather than trusting, because a
    lineup can arrive from a save file.
  - `authoredLineup`, `isAuthoredLineup`, `reserveDrivers` (alphabetical, everyone in
    the pool without a seat) and `lineupChanges` round it out. A `SeatChange` always
    has `in.length === out.length` — seats are preserved, so every arrival displaced
    someone — and the UI relies on it to print "X for Y".
