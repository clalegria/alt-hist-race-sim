---
paths:
  - "apps/web/**"
---

# Web app

`apps/web` reveals a season a session at a time. React + Vite, Tailwind 4, Zustand.
shadcn/ui components are **copied in, not a dependency** — but the Radix primitives
they wrap *are* real dependencies (`react-popover`, `react-alert-dialog`,
`react-dropdown-menu`).

## Screens and state

**The URL says which page; the store holds the run.** Routes and the top nav are
`.claude/rules/web-routing.md`, the run bar `.claude/rules/web-run-bar.md`. The store's `run` is null until one is started,
then a `Run` in `store/season.ts`: `season` for a single year, `era` for a run of them,
each a world and a cursor, and `pending` for an era waiting on the reader to fill a
year's seats, which has none yet (`web-era.md`). A `World` is a *member of the
variants that have one* rather than a nullable field beside them, so nothing reads a
season nobody started. Nothing is simulated until a mode is chosen: the app opens on the
menu having run no races at all. **The era half is `.claude/rules/web-era.md`**, which
loads alongside this file on the store and `App.tsx`; everything below describes both
unless it says otherwise, since an era is the same season screen with a run carried
beside it.

Modes come from `lib/modes.ts` and years from `lib/seasons.ts`; both list what does
not exist yet — the unbuilt modes, and any year without seed data — as disabled entries
rather than omitting it. **`lib/seasons.ts` holds no list of its own** —
`PLAYABLE_SEASONS` and `isPlayable` come straight from `authoredSeasons` in
`@alt-hist/data`, so authoring a season is a file in `packages/data/src/seasons/` and
the UI follows. The split: which years *exist* is a data decision, the `FIRST_SEASON`–
`LAST_SEASON` *range the picker draws* is a display decision and lives here. Every year
in the range is authored today, so what still proves the rule is that a year *outside*
it is not playable. `playableSummary()` writes the picker's
subtitle from the same source, collapsing runs into ranges — it said "Only 1980 has
been authored" for a while after 1981 landed, and that is why the copy is derived.
`createWorld(seed, year)` goes through `seasonSeed`, which throws on an unauthored
year rather than quietly falling back.

## The reveal: a timeline of beats

The whole year is simulated the instant a seed is drawn — one continuous RNG stream
through every round, which is what makes a season reproducible. The cursor (`run.cursor`)
is a `Beat` (`lib/timeline.ts`) over results that already exist:

```
grid → qualifying 1 → race 1 → … → summary → (era) review → next year's grid
```

`View` is the season screen's part of it, every beat but `review`. Continue is a promise
about what the reader sees next, not about when the dice are rolled. What a page may
read of those results is the gate's call, `revealed(run)` (`.claude/rules/web-routing.md`). `nextBeat` is the
order, `comparePlaces`/`isReached` compare two `Place`s (a year and a beat) anywhere in
a run, and `describeBeat` is the run bar's words for one. **A new kind of beat** — a
market event, a decision — **is a row in that file**, plus a page and a line in the bar.

`continueRun()` is the store's one forward step: the next session, the summary, an era's
review, then the next year (built there, which is the advanced mode's seam —
`.claude/rules/web-era.md`); `jumpTo` is that step in a loop. Nothing rewinds the
cursor: a restart draws a new season and puts it at the grid, and Back moves between
pages, never through time. The walk is
property-tested (every session once, strictly increasing, `isReached` agreeing with it),
and `runBarFor()` is the whole of what can be done on each beat (`web-run-bar.md`).
