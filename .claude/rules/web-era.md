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
sits on — the one store, the reveal cursor, the screen union, how any of this is
tested — is `.claude/rules/web-app.md`, which loads alongside this file. This one owns
only what the *multi-season* shell adds.

## The loop

Three screens on top of the season flow: `era-setup` → `era` → `era-champions` → `era`
→ … `EraRun` is `{ startYear, seasons }` and lives on the last two.

**An era reuses the season screen rather than copying it.** `SeasonScreen` in `App.tsx`
takes an optional `run`, and that is the whole difference: it changes where the summary
leads and where the grid's Back goes. Every other stage is byte-for-byte the same
reveal. `actionsFor(view, rounds, inEra)` says the same thing, and a test asserts that
every stage but the summary is identical under both — if a second flow ever grew here,
there would be two reveals to keep in step. The store follows the same shape:
`isPlaying(screen)` narrows to `season | era`, so `nextSession`, `skipToEnd`,
`setRatingMode`, `setGrid` and `restartSeason` are written once and work in both.

**`run.seasons` holds finished worlds, not a table of winners.** Results are the source
of truth and statistics are derived, so who won a year is a `championshipStandings` call
over a season that is already in hand — `lib/era.ts` makes it, once per season, for the
roll-up. The run is plain data throughout: an era serialises to a save file exactly as
one season does, and a test asserts it.

**The season on screen is not in the run.** It joins on `showEraChampions()`, which is
the *only* thing that appends — so a year cannot be crowned twice, and a year abandoned
half-read (`leaveEraSeason()`, the grid's Back) never enters the roll of honour at all.
`restartSeason` inside an era re-runs the current year only; the crowned years stand,
because they were read and this one was not.

## What crosses a year boundary

**The grid does not.** `nextEraSeason()` builds year N+1 with `createWorld(seed, year+1,
ratingMode)` and nothing else: the field is that year's own entry list, straight from
`<year+1>.json`. **This is the seam `era-advanced` replaces** — a mode that simulates
the grid substitutes what is handed to `createWorld` there, and nothing else about the
loop changes. Keep it a single call. An edited lineup or engine supply is deliberately
*not* carried: it was a grid for a year now behind them. The ability mode is carried,
but it was never chosen — an era runs at `ERA_RATING_MODE` throughout and offers no
switch; see `.claude/rules/web-store.md` for why.

**The dice do.** The next year's seed is `nextSeed(world.rngState)` — drawn from where
the last season's generator stopped, in `lib/seed.ts`. So an era is reproducible end to
end from the seed its first season was drawn on, which is what makes a bug report four
seasons in usable, and no year repeats another's dice. `Math.random()` here would have
cost exactly that, and is why the era does not call `randomSeed()` per year.

**`simulateRestOfEra()` is the same step in a loop**, not a second rule — it must
produce *exactly* the history stepping through would have, and a test asserts the two
are identical world for world. Skipping gives up the reading, never the seasons. It
returns the state object itself when there is nothing left to run, rather than an equal
copy, so a press that changes nothing does not re-render seventy-six rows.

**The era stops where the data does.** `nextEraYear(year)` in `lib/seasons.ts` returns
`year + 1` only if it is authored — never a year written down, so the run reaches
further the moment a later season lands. The champions screen offers no forward button
past it, and `nextEraSeason()` is a no-op there rather than a throw.

## The roll of honour

`EraChampions` is a pure render of a run, buttons included from `App` like every other
screen's. Chronological, earliest first — a record, not a leaderboard. **The year just
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

`ChampionRow` is therefore **controlled** — the open year lives in `EraChampions` — so
both states render without a DOM and without a click, the same split as the grid
editor's tables. `SeasonChampions` in `lib/era.ts` carries the whole `world` for this:
the row needs the results, the scale and the grid, not just two names.

`EraPicker` is `SeasonPicker` with different copy, not a second component — the same
years, the same disabled rule, so the two cannot drift apart the next time the range
changes. `eraActionsFor(lastCrowned)` in `App.tsx` is the roll-up's button set, pure and
tested like `actionsFor`: the next year, and the far end of the range — the latter null
when it *is* the next year, since two buttons doing one thing is a worse offer than
one.
