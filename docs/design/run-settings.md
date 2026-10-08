# Design: run settings

What-if settings chosen on the setup screen before a run starts, beside Randomness: car
performance, career events, team names, teams and seats, breakdowns, reliability and
points. All are built and documented in `.claude/rules/` (`web-setup.md`, `web-store.md`,
`car-performance.md`, `data-layers.md`, `team-eras.md`, `teams-and-seats.md`,
`retirement-factor.md`). What is left is §3's open question, §4's proposal and closing
the item (§5). Where it sits in the build order is *run settings* in `docs/ROADMAP.md`.

Three of these are settings `docs/design/era-advanced.md` §3 decided for the advanced
era — the frozen grid, historical careers, random car development. They are built here
first, in `era-basic`, and the advanced era inherits them.

- **DECIDED** — the author's decision.
- **PROPOSED** — a suggested design. Confirm with the author before building on it.
- **OPEN** — unresolved; needs the author before or during implementation.

---

## 1. Principles

- **DECIDED** — Career events, team names, and teams and seats are on the **era setup
  only** (§4). Car performance is on both setup screens.
- **PROPOSED** — Every setting's first option is the historical one, and it is the
  default. All-historical is today's run exactly: no draw is made and no field changes,
  so tests and harnesses are untouched until a reader picks something else.
- None of these change what a rating *means*. Car performance and career events change
  the ratings a run uses — per-run data, not the authored numbers — and breakdowns and
  reliability are scales over constants, like Randomness. No tuning, no harness run.

## 2. Presentation and naming

- **One segmented control per setting** (`SettingSegments`), so every row reads
  historical-versus-what-if the same way, and a third option is one more segment.

## 3. Car performance from previous year's car

The walk is built (`.claude/rules/car-performance.md`), as a plain walk.

- **OPEN** — At ±20 or ±30 from previous year's car, ratings reach the clamp within a few
  seasons. Whether the walk pulls back towards the authored car (mean reversion,
  `era-advanced.md` §11). Recommendation: decide after watching a long run.

## 4. Which screen

- **DECIDED** — Era setup only: career events, team names, teams and seats, and Car
  performance's walk from *previous year's car*. The rest of Car performance is on both.
- **PROPOSED** — Eight rows on the era screen. If it reads long, *Teams over the years*
  goes behind a *More settings* disclosure that summarises any non-historical choice in
  one line when closed.

## 5. Build order

**Close the item.** Teams and seats was the last run setting, so delete *Run settings*
from `docs/ROADMAP.md`, move §3's open question (and §4's PROPOSED *More settings*
disclosure, if still wanted) to `docs/DECISIONS.md`, and delete this file.
