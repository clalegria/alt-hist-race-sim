---
paths:
  - "packages/data/src/keptGrid.ts"
  - "packages/data/src/keptGrid.test.ts"
  - "apps/web/src/lib/kept.ts"
  - "apps/web/src/components/TeamsSetting.tsx"
  - "apps/web/src/components/teams-setting.test.tsx"
---

# The first season's teams — the kept grid

*Teams: The first season's teams* is an era run setting: every year has the
start year's teams, each with its start-year seat count, and teams new in history never
appear (their drivers are free). `packages/data/src/keptGrid.ts` builds one year of it;
the settings row is `.claude/rules/web-run-settings.md`, and the layer it sits in
`.claude/rules/data-layers.md`. The fills are `last` and `best` (`SEAT_FILLS`).

## The entry list: `keptYear(start, season, previous, rules, options)`

- **A team history has in year N** takes its car and its authored drivers. With more
  drivers than its start-year count, the weakest drop out by `strongestOf`
  (`carryOver.ts`, shared): the ranking rule, the authored order settling a dead heat.
- **A ghost entry** — a start-year team history has dropped — races **its last real
  car**: the latest season before N with the team (the start year always has it), chassis,
  engine and paint, but no `developmentTrend`, which describes that one year. Its engine
  has year N's values if N rates it; otherwise its latest authored spec is **appended to
  the kept season's `engines`**, so `applyEngines` and `buildField` accept it. `ghosts`
  maps each ghost to the year of the car.
- **A short seat** is one a real team leaves empty by running fewer cars than in the start
  year. It follows the same rules as a ghost's.
- **Last year's driver keeps an empty seat** (under `last`) at the team they
  drove for last year *in this run* (`previous`), unless:
  - **history has seated them elsewhere this year** — history always wins;
  - they are **outside the age band**, read against their real age in the season. Past
    `maxAge` is their retirement from the seat.

  More candidates than seats, and the strongest stay. Nobody held two seats last year,
  so nobody is carried twice. A driver history moved to a team that has no room for
  them — it ran fewer cars in the start year — is a leftover, so they can still return
  to the seat they raced last year.

`KeptYear.season` is year N's calendar, points and factors with the start year's teams on
these cars, each entry's `drivers` its filled seats; `seats` is the `LineupDraft`, empty
seats `null`.

## Signing: `fillSeats(season, seats, signing, options)`

- **Best car first** — `teamsByCar` (`arrange.ts`, shared), on
  the `season` passed in, which is the cars the run races after any *Chassis performance*
  roll — each empty seat takes the strongest free driver by `byOverall` (`arrange.ts`,
  shared). `signing` is the run's `SigningPool`. Free means holding no seat, inside the
  band, and under `activeOnly` a real
  career spanning the season (`matchesFilters` with both career filters on: one rule with
  the grid editor's pool).
- `best` carries nobody, so every empty seat is signed fresh each year.
- **A seat nobody qualifies for stays `null`.** `seatedSeason` leaves it out, and a team
  with no driver at all sits the year out. Only a very narrow band reaches it.

No dice anywhere: ranking is deterministic, ties settled by name then id. Ratings are
`aged` by default, as an era always runs; `pool` is the run's (`driverPoolOf`).

## In the run

- **The setting** is `RunSettings.teams` (null / `{ fill }`, era only: `seasonSettings`
  drops it) with the run's signing pool, `RunSettings.driverPool` (`SigningPool`: an age
  band and `activeOnly`), which a reseat shares. `emptySeatRules(settings)` joins them
  into the `EmptySeatRules` this file reads. Under a reseat the fill is always `best`
  (`settingsInForce`): the reseat moves everyone. `TeamsSetting` draws *Teams* in Over
  the years, with *Empty seats go to* (`SEAT_FILL_LABELS`) under it, hidden under a
  reseat; the pool is the Drivers group's *Drivers who can be signed*
  (`web-run-settings.md`). Switching in opens on `OPENING_TEAMS`. `parseRunSettings` refuses a fill outside
  `OFFERED_SEAT_FILLS`, and an age outside `AGE_RANGE` or crossed.
- **The world** (`store/season.ts`) records `gridKeptFrom` (the era's first year),
  `kept` (the `KeptYear`, an input passed on by every in-place rebuild) and `keptSeats`
  (after `fillSeats`, a derived baseline like `baselineChassis`); all null unless Keep,
  and `kept` null in the first year. `keptYearAfter(last, year)` builds the next year off
  `racedLineup(last)`; `nextEraWorld` and the recipe's `rebuild` both call it, so
  stepping, jumping and reloading build the same year.
- **`baselineSeason` is the one place it reaches a season**: the kept season, then the
  run's own cars over it (`withRunCars`: kept engine suppliers, which give a ghost its
  first-season engine too, the chassis and engine rolls and the trends — a ghost walks
  off its own raced car with no special case), then `fillSeats` on those cars, then
  `seatedSeason`, then the reseat under *Who drives where*.
- **Kept seats are the baseline, not edits.** `enteredSeason(world)` (`lib/seasons.ts`,
  memoised per world) is what Restore and every change notice compare against; the
  grid editor's *Copy last year's grid* copies `racedLineup` of the year before.
- **On the grid**, `keptNotes(world)` (`lib/kept.ts`) says what Keep did: a ghost card
  reads "Gone in real life, racing its {year} car", a seat history did not fill carries a
  muted *kept* or *signed* (never `SWAPPED_IN`, which means the reader moved someone),
  and `KeptNote` above the cards — its own notice, not the edited-grid one — names the
  ghosts, counts the seats and says who is short (`keptSentences`, pure).

## Testing

`keptGrid.test.ts` checks every rule above against synthetic seasons and drivers, and
chains real seasons from two start years to the last checking rules only (every start
team at its count, nobody seated twice, every raced engine on the menu). Mutation-checked:
reversing the driver ranking, the car order, dropping the band from either step, or
letting carry-over ignore history each fail at least one test. In the app,
`store/era.test.ts` runs an era from `FOLDING_YEAR` (`test-support.ts`, found by search),
`recipe.test.ts` reloads a ghost year, and `teams-setting.test.tsx` renders the
row, the ghost and the note; dropping `kept` from `nextEraWorld`, from `rebuild` or from
an in-place rebuild each fails at least one. `pnpm screenshots` keeps the 1984 grid
(`era-kept-grid`).
