---
paths:
  - "packages/data/**"
---

# Seed data and the layer over it

The authored JSON in `packages/data/src/`, and the modules that turn it into a field, a
grid or a headline number. Each module's header says what it does; these are the rules.

## The JSON
- **Never reformat a seed file.** Biome skips them (`overrides` in `biome.json`) because
  each file's layout is authored and differs by file: match the one you are in.
- **Adding a season is one file**, `seasons/<year>.json`, plus any new drivers, teams and
  engine manufacturers in their pools. There is no registry and nothing else lists
  seasons; derive every count of rounds, entries, scorers or seats, never assume one.
- **`tsc` never checks a season file**: `validateSeedData()` does, at runtime, over every
  year. Never name a season in `type-checks.ts`; that is the registry discovery avoids.
- **A team is its id, never its name**: name, base and livery are era lists
  (`team-eras.md`). Anything keyed on a team (targets, saves, lookups) uses `teamId`.
- **An engine rating and its customers' chassis ratings are one judgement**: neither is
  separately observable, so they are authored, and moved, together.
- `retirementFactor` is how hard the year was on every car. One car's fragility is its
  chassis and engine `reliability`, never the factor.

## One answer each
- **The engine may not read data**, so every seed-to-runtime mapping lives here, not in
  the engine and not in `apps/web`, because more than one consumer needs it.
- **Never a second copy**: `powertrain()` (engine) is the only chassis/engine blend,
  which `buildField` leaves to it and `carOverall` calls; `rating.ts` is the only overall
  and `compareByRating` the only ranking rule; `people.ts` the only `matchesFilters`.
  `apps/web/src/lib/rating.ts` and `lib/people.ts` re-export them; never re-implement
  one in the app or a tool.
- **A run setting reaches driver ratings through the pool argument**, never a flag:
  `buildField`, `arrangeLineup`, `carryOverLineup`, `reserveDrivers`, `keptYear` and
  `fillSeats` each take one, and the app picks it in `driverPoolOf`
  (`apps/web/src/lib/run-settings.ts`).

## Overrides over a season
- `lineup.ts`, `engines.ts`, `chassis.ts` and `development.ts` share one shape: a record
  keyed by `teamId` (by `engineId` for engine ratings), applied by a function that hands
  back a `SeasonSeed` `buildField` consumes unchanged. A new what-if follows it.
- **They never touch the authored data**, and each `apply*` re-validates, because an
  override can arrive from a save file.
- **No operation may change a team's seat count**: the starting limit and the DNQ count
  depend on the field size. Every lineup edit is an `exchangePicks`.
- **`filledLineup` is the only gate** from a `LineupDraft` to a `SeasonLineup`;
  `applyDraft` is for previews and never stands in for `applyLineup`.

## Reseat and signings (`arrange.ts`, `keptGrid.ts`, `carryOver.ts`)
- They move drivers only: teams, seat counts and engines are the season's.
- **No eligibility rule of their own**: who may be drawn from outside the grid is the
  run's signing pool, read through `matchesFilters`. The seated half is never filtered,
  and a filter only hides: anyone can still be placed by hand in the grid editor.
- Ties go to `compareByRating`, then an id or name: two runs of a rule give one grid.
  `random` takes the injected `Rng` and throws without one.
