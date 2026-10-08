# Design: run settings

What-if settings chosen on the setup screen before a run starts, beside Randomness: car
performance, career events, team names, teams and seats, breakdowns, reliability and
points. The Races group — breakdowns, reliability, points —, the Cars group — car
performance, varied from the real car or the previous year's, or at random —, the Drivers group — career events —,
team names and the plumbing every setting shares (`World.settings`, the Run settings
card) are built and documented in `.claude/rules/web-setup.md`, `web-store.md`,
`car-performance.md`, `data-layers.md`, `team-eras.md` and `retirement-factor.md`; the
rest is design intent. Where it sits in the build order is *run settings* in
`docs/ROADMAP.md`; §6 is its own build order, one step per session.

Three of these are settings `docs/design/era-advanced.md` §3 decided for the advanced
era — the frozen grid, historical careers, random car development. They are built here
first, in `era-basic`, and the advanced era inherits them.

- **DECIDED** — the author's decision.
- **PROPOSED** — a suggested design. Confirm with the author before building on it.
- **OPEN** — unresolved; needs the author before or during implementation.

---

## 1. Principles

- **DECIDED** — Career events, team names, and teams and seats are on the **era setup
  only** (§5). Car performance is on both setup screens.
- **PROPOSED** — Every setting's first option is the historical one, and it is the
  default. All-historical is today's run exactly: no draw is made and no field changes,
  so tests and harnesses are untouched until a reader picks something else.
- None of these change what a rating *means*. Car performance and career events change
  the ratings a run uses — per-run data, not the authored numbers — and breakdowns and
  reliability are scales over constants, like Randomness. No tuning, no harness run.

## 2. Presentation and naming

**PROPOSED** — the era setup's remaining rows:

```
 ─ Teams over the years (Team names built) ────────────────────────────
  Teams and seats   [ As they happened | Keep the starting grid ]
```

- **One segmented control per setting** (`SettingSegments`), so every row reads
  historical-versus-what-if the same way, and a third option (random careers, an
  intermediate grid) is one more segment.

## 3. Car performance from previous year's car

The walk is built (`.claude/rules/car-performance.md`), as a plain walk.

- **OPEN** — At ±20 or ±30 from previous year's car, ratings reach the clamp within a few
  seasons. Whether the walk pulls back towards the authored car (mean reversion,
  `era-advanced.md` §11). Recommendation: decide after watching a long run.

## 4. Teams and seats

- **DECIDED** — As they happened / Keep the starting grid. Keep means every year has the
  start year's teams, each with its start-year seat count. Teams new in history never
  appear; their drivers are in the pool without a seat.
- **DECIDED** — Empty seats are filled **by the reader**. Continue is disabled until they
  are, with the reason on the button. **Jump to… stays, and stops at the first grid with
  an empty seat** ("Stopped at 2010: two seats need a driver") — a deliberate exception
  to a jump target being refused rather than clamped (`.claude/rules/web-era.md`).
- **PROPOSED** — Building year N's entry list, in `packages/data` beside `carryOver.ts`:
  - A team with a year-N entry takes its chassis, engine and drivers. Over its start
    seat count, the weakest by the ranking rule drop out; under it, seats are empty.
  - A team history removed (Toyota in 2010) is a **ghost entry**: last year's raced
    drivers wherever they are still free, an empty seat otherwise. A seat the reader
    filled stays filled until history claims that driver elsewhere.
- **OPEN** — A ghost team's car. Recommendation: **it keeps its place in the pecking
  order**, taking the chassis and engine of the team at its rank in last season's order,
  so it neither freezes at its last level nor jumps to the front. Under *previous year's car*
  it walks from its own last car instead. The alternative, freezing its last raced car,
  falls behind as the field develops.
- **PROPOSED** — **A grid waiting for drivers is a new run state.** `createWorld`
  simulates on the spot and needs a full lineup, so the era variant gains a pending year
  (year, seed, entry list, draft). The grid page opens the editor on it, Apply builds the
  world, and nothing past the grid is reachable. The recipe stores a pending year without
  a `check`. The most invasive step, so it is built last.
- **OPEN** — A driver in a ghost seat never retires (`finalSeason` is informational, and
  carry-over stops only at 55). Accept it in era-basic and leave it to the advanced
  era's Retirement setting?

## 5. Which screen

- **DECIDED** — Era setup only: career events, team names, teams and seats, and Car
  performance's walk from *previous year's car*. The rest of Car performance is on both.
- **PROPOSED** — Eight rows on the era screen. If it reads long, *Teams over the years*
  goes behind a *More settings* disclosure that summarises any non-historical choice in
  one line when closed.

## 6. Build order

One session each, in order; each ends green and documented in `.claude/rules/`, leaving
this file smaller.

1. **Teams and seats**: the entry list, ghost entries, the pending grid, Continue gated
   and the jump stopping early.
