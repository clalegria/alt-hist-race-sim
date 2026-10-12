---
paths:
  - "apps/web/src/components/GridStage.tsx"
  - "apps/web/src/components/LineupChanges.tsx"
  - "apps/web/src/store/season.ts"
---

# The grid's bulk rules — the app around them

The three rules that reseat the whole field (fastest drivers in fastest teams, in slowest,
random), as the app uses them. **The rules themselves** — the pairing, the cast, the
dice — are `.claude/rules/grid-arrangements.md`, in the data package.

## Who drives where: the reseat as a setting

`RunSettings.seating` (null or `{ kind, includeUnemployed }`, on both screens) reseats
every year's grid. `seatingArrangement(settings)` turns it into a `GridArrangement`
whose filters are the run's signing pool (`driverPool`, `signingFilters`), the pool the
kept teams' empty seats sign from too (`teams-and-seats.md`).

- **The reseat is the starting grid, not an edit.** `reseat` is `baselineSeason`'s last
  step, after the kept teams' signings: the rule over the season's own grid, on the cars
  it races, ranking drivers in the world's rating mode. `world.reseated` keeps the
  result, a derived baseline like `keptSeats`; `enteredSeason` applies it, so `lineup`,
  Restore, Clear all edits and every change notice measure hand edits from it, and
  `isUntouched` holds on a reseated grid.
- **A hand edit sits on top of it and never ends it.** Next year is reseated again on
  that year's own entry list; an era carries the setting, never a lineup.
- **The dice are `createRng(seed)`**, a generator apart from the races', so a random
  reseat is reproducible from the season's seed: `setGrid` and `setRatingMode` keep it,
  both restarts, `switchSeasonYear` and `setRunSettings` throw it again. A ranked rule
  comes back the same on any seed. A rule that leaves a seat open falls back to the
  season's grid.
- **The settings form has no row for it yet**, and the settings line does not name it;
  the grid states it through `ArrangementNote` (below).

A recipe from before this stored an `arrangement` beside each world's lineup;
`parseWorldRecipe` ignores it. Such a run is refused anyway, as its fingerprint covers
the world's old shape (`web-persistence.md`).

## The editor's panel, until the editor is tidied

`GridArrangements` in `GridStage` still offers the three buttons and *Include unemployed
drivers* while the editor is open. A press rearranges the **draft** with a fresh
`createRng(randomSeed())`, and what is applied is a hand edit like any other: nothing
about the rule is recorded. `chosen` only says which button the draft came from; a
hand edit clears it, and `untouched` counts it as a change.

## Saying so

`ARRANGEMENT_LABELS` in `LineupChanges.tsx` names each rule, for the buttons and the
note alike. `arrangementNote` spells out the cast, the age band with "peak age" under
`peak`. `ArrangementNote` draws it as its own line on the grid, from the settings'
rule or, while the editor is open, the draft's: on `SeasonGrid` (the grid screen and
the summary's grid tab). The summary's banner lists only hand edits.

## Testing

`store/season.test.ts` (a season) and `store/era.test.ts` (every year by stepping and by
jumping, a hand edit not stopping next year's reseat, Restart keeping a ranked reseat and
re-rolling a random one, kept teams under a reseat seated in full with nobody twice) test
where the reseat ends up; `lib/run-settings.test.ts` the in-force rules and the parse;
`recipe.test.ts` the round trip and an old recipe's `arrangement` ignored.
Mutation-checked: dropping the reseat, drawing its dice off a fixed seed, ranking on a
fixed mode, `enteredSeason` ignoring it, and the in-force fill or pool each fail at
least one. `grid-arrangement.test.tsx` covers what the reader is told: the panel's
pressed button, the label map, the note's cast, the note with no hand edit at all.
