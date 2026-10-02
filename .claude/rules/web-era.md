---
paths:
  - "apps/web/src/components/EraChampions.tsx"
  - "apps/web/src/components/SeasonPicker.tsx"
  - "apps/web/src/lib/era.ts"
  - "apps/web/src/store/season.ts"
  - "apps/web/src/store/era.test.ts"
  - "apps/web/src/App.tsx"
---

# Web app — the era mode

`era-basic`: a run of seasons, each one the real grid of its year. The architecture it
sits on — the one store, the reveal cursor, the `Run` union, how any of this is
tested — is `.claude/rules/web-app.md`, which loads alongside this file. This one owns
only what the *multi-season* shell adds.

## The loop

The era picker (`/era/new`), then one `era` run: `{ run: EraRun, world, cursor }`, the
cursor walking each year's beats and then its **review** (`/run`, the roll of honour)
before the next year's grid. `EraRun` is `{ startYear, seasons }`.

**An era reuses the season's beats rather than copying them.** `SeasonPage` in
`App.tsx` takes an optional `run`, and that changes whether the ability toggle is offered
and what the grid's carry-over copies — nothing else. `runBarFor` says the same thing,
and a test asserts every beat but the summary offers the same actions in both. The store
follows the same shape: `continueRun`, `skipToEnd`, `setGrid` and `restartSeason` are
written once and work in both.

**`run.seasons` holds finished worlds, not a table of winners.** Results are the source
of truth and statistics are derived, so who won a year is a `championshipStandings` call
over a season that is already in hand — `lib/era.ts` makes it, once per season, for the
roll-up. The run is plain data throughout: an era serialises to a save file exactly as
one season does, and a test asserts it.

**`run.seasons` is the years before the world on the cursor**; which years are
*crowned* is derived. `crowned(run)` adds the world once the cursor reaches its review,
and every reader of the roll-up goes through it — so no world is stored twice and no
year can be crowned twice. Continue off the review is the only thing that appends to
`seasons`, on its way to building the next year. `restartSeason` inside an era re-runs
the current year only, and is refused on the review, where that year has itself been
crowned.

## What crosses a year boundary

**The grid does not.** `nextEraWorld(last, year)` in the store builds year N+1 with one
`createWorld` call: the field is that year's own entry list, straight from
`<year+1>.json`. **This is the seam `era-advanced` replaces** — a mode that simulates
the grid substitutes what is handed to `createWorld` there, and nothing else about the
loop changes. Keep it a single call, shared by Continue and the jump. An edited lineup or engine supply is deliberately
*not* carried: it was a grid for a year now behind them. The ability mode is carried,
but it was never chosen — an era runs at `ERA_RATING_MODE` throughout and offers no
switch; see `.claude/rules/web-store.md` for why.

**A bulk rule does, if the reader ticked the box.** The grid editor's three
rearrange-everything buttons carry a `retain` flag, and an era that has one re-runs the
*rule* on each following year's own entry list — never the lineup, which was a grid for a
year now behind them. Same split as the ability mode: how to play carries, one grid does
not. `nextEraGrid` in the store is where it happens, for stepping and for jumping alike;
`.claude/rules/grid-arrangements-app.md` owns the rest.

**The dice do.** The next year's seed is `nextSeed(world.rngState)` — drawn from where
the last season's generator stopped, in `lib/seed.ts`. So an era is reproducible end to
end from the seed its first season was drawn on, which is what makes a bug report four
seasons in usable, and no year repeats another's dice. `Math.random()` here would have
cost exactly that, and is why the era does not call `randomSeed()` per year.

**`simulateRestOfEra(through?)` is the same step in a loop**, run from the review and
landing on the review of the year it stops on, not a second rule — it
must produce *exactly* the history stepping through would have, and a test asserts the
two are identical world for world, jumped to a mid-era year as well as run to the end.
Skipping gives up the reading, never the seasons. `through` is the year it stops *on*,
inclusive, and a partial jump is deliberately this action with a stop year rather than a
loop of its own — an era jumped to 1980 and then played on must be the era that was
stepped through. A `through` behind the run or with no seed data is refused outright, not
clamped: falling through to "no target" would silently run the whole era to the end. It
returns the state object itself when there is nothing left to run, rather than an equal
copy, so a press that changes nothing does not re-render seventy-six rows.

**Jump forward is in the run bar's overflow, on the review**, and opens
`JumpForwardDialog`: a `YearPicker` restricted by its injected `playable` to years the
era has not reached, defaulting to the far end. `eraJumpTarget(lastCrowned, chosen)` in
`lib/run-bar.ts` decides what it runs: pure and exported like `eraActionsFor` beside it,
because a stale year must fall back to the far end rather than reach the store.

**The era stops where the data does.** `nextEraYear(year)` in `lib/seasons.ts` returns
`year + 1` only if it is authored — never a year written down, so the run reaches
further the moment a later season lands. The run bar offers no Continue
past it, and `continueRun()` is a no-op there rather than a throw.

## The roll of honour

`EraChampions` is a pure render of a run; its actions are the run bar's. Chronological, earliest first — a record, not a leaderboard. **The year just
finished is the last row and carries `STANDOUT_ROW`**, exactly one row per view, which
is the accent rule from `web-display.md`: it is the champion of the thing the reader
just came off.

**Each row publishes its own season's engine supply**, wrapping its `<tr>` in
`EntryNames` (a provider renders no DOM, so it nests inside `<tbody>` fine). This is the
only table in the app that spans more than one year, and it is the one place a single
shared supply map would go unnoticed — most rows read correctly anyway, because a works
team is named after itself. The test therefore **searches** for a season whose champion
team ran somebody else's engine rather than assuming the fixture years have one; without
that search it passed against a deliberately emptied field.

**A row opens into that year's full championships.** The **year is the control** —
`▶` chevron, `aria-expanded`, the name itself as the button — the same affordance the
championship tables and the calendar use. The panel is `SeasonStandings`, which is
*also* what the season summary ends on: extracted out of `SeasonView` precisely so a
year read out of the roll of honour and a year just finished cannot say different
things. Its calendar comes from `seasonSeed(row.year)`, never a season fixed at import
time, and each row of it still opens into its own race-by-race — an expansion inside an
expansion, which is why only one year opens at a time.

`ChampionRow` is therefore **controlled** — the open year lives in `RollOfHonour` — so
both states render without a DOM and without a click, the same split as the grid
editor's tables. `SeasonChampions` in `lib/era.ts` carries the whole `world` for this:
the row needs the results, the scale and the grid, not just two names.

**Both champions of a row open their own career**, via `DriverHistory` / `TeamHistory`
— the year's chevron beside them still opens the season. Two controls next to each
other answering the two questions a champion's row raises;
`.claude/rules/web-careers.md` owns that panel and the provider above the screen that
feeds it.

`EraPicker` is `SeasonPicker` with different copy, not a second component — the same
years, the same disabled rule, so the two cannot drift apart the next time the range
changes. `eraActionsFor(lastCrowned)` in `lib/run-bar.ts` is the review's way on: the next
year, and the far end of the range — the latter null when it *is* the next year, since a
jump doing what Continue does is a worse offer than none.

## The career statistics

The other half of the champions screen — who won the *era* rather than each year — is
`.claude/rules/web-records.md`, which loads on `CareerStatistics.tsx` and `lib/records.ts`.
Two things about it belong here: it reads `run.seasons` and derives everything on render,
like the roll of honour does; and adding it is why `RollOfHonour` is its own component,
since the era tests count rows and flags in *the record's table* and a second table of
names on the same screen made those counts measure the wrong thing.
