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
cursor walking each year's beats and then its **review** (`/run`, the era's overview)
before the next year's grid. `EraRun` is `{ startYear, seasons }`.

**An era reuses the season's beats rather than copying them.** `SeasonPage` in
`App.tsx` takes an optional `run`, and that changes whether the ability toggle is offered
and what the grid's carry-over copies — nothing else. `runBarFor` says the same thing:
a test asserts every beat but the summary offers the same season actions in both, the
era adding only its own — the jump across years and Restart era. The store
follows the same shape: `continueRun`, `jumpTo`, `setGrid` and `restartSeason` are
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
`seasons`, on its way to building the next year.

**Two restarts, both new dice and never a rewind.** `restartSeason` re-runs the current
year only, the crowned years standing, and is refused on the review, where that year
has itself been crowned. `restartEra` goes back to the first year's grid with every year
since discarded; what carries is how the reader chose to play (randomness, ability mode)
and **the first year's grid** — its edits, engines and bulk rule, a kept rule going on to
arrange every year after. A grid edited in a later year goes with that year.

## What crosses a year boundary

**The grid does not.** `nextEraWorld(last, year)` in the store builds year N+1 with one
`createWorld` call: the field is that year's own entry list, straight from
`<year+1>.json`. **This is the seam `era-advanced` replaces** — a mode that simulates
the grid substitutes what is handed to `createWorld` there, and nothing else about the
loop changes. Keep it a single call, shared by Continue and the jump. An edited lineup, engine supply or chassis is deliberately
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

**A jump is Continue, pressed until it gets there.** `stepRun(run)` is one Continue as a
pure function and `jumpRun(run, target)` loops it, so `jumpTo` writes *exactly* the
history stepping through would have, by construction — tests assert it world for world,
to a year's start and to its end. Skipping gives up the reading, never the seasons;
every year passed is crowned unread. A target lands only on a year's **grid** or its
**summary**, and one behind the cursor, of any other kind, or never reached (no seed
data, another year of a one-year run) is refused outright, not clamped: a stray target
must not quietly run the era to its end. Refused, `jumpTo` returns the state object
itself, so a press that changes nothing re-renders nothing.

**The era stops where the data does.** `nextEraYear(year)` in `lib/seasons.ts` returns
`year + 1` only if it is authored — never a year written down, so the run reaches
further the moment a later season lands. The run bar offers no Continue
past it, and `continueRun()` is a no-op there rather than a throw.

## The roll of honour

`EraChampions` is a pure render of a run; its actions are the run bar's. Chronological,
earliest first — a record, not a leaderboard. **The year last crowned carries
`STANDOUT_ROW`**, exactly one row per view, which is the accent rule from
`web-display.md`: on the review it is the champion of the thing the reader just came off.

**The year in progress follows it** (`InProgressRow`, from `inProgress`): each
championship's leader as far as the cursor has got, or "on the grid". Muted, never
opened, never accented — it is a season still being written. It is there whenever the
cursor is not on a review, so `/run` is a page from the era's first grid on; with
nothing crowned it is the only row, and the career statistics (crowned years only) are
left out.

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
*also* the season page's standings tab: extracted out of `SeasonView` precisely so a
year read out of the roll of honour and a year just finished cannot say different
things. Its calendar comes from `seasonSeed(row.year)`, never a season fixed at import
time, and each row of it still opens into its own race-by-race — an expansion inside an
expansion, which is why only one year opens at a time. The panel ends with *1984 season
page →* (`seasonLink`), the panel first and the page second, as the career panels do.

`ChampionRow` is therefore **controlled** — the open year lives in `RollOfHonour` — so
both states render without a DOM and without a click, the same split as the grid
editor's tables. `SeasonChampions` in `lib/era.ts` carries the whole `world` for this:
the row needs the results, the scale and the grid, not just two names.

**Both champions of a row open their own career**, via `DriverHistory` / `TeamHistory`
— the year's chevron beside them still opens the season. Two controls next to each
other answering the two questions a champion's row raises;
`.claude/rules/web-careers.md` owns that panel and the provider in the run's frame that
feeds it.

`EraPicker` is `SeasonPicker` with different copy, not a second component — the same
years, the same disabled rule, so the two cannot drift apart the next time the range
changes.

## The career statistics

The other half of the champions screen — who won the *era* rather than each year — is
`.claude/rules/web-records.md`, which loads on `CareerStatistics.tsx` and `lib/records.ts`.
Two things about it belong here: it reads `run.seasons` and derives everything on render,
like the roll of honour does; and adding it is why `RollOfHonour` is its own component,
since the era tests count rows and flags in *the record's table* and a second table of
names on the same screen made those counts measure the wrong thing.
