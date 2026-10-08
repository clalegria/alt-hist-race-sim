# Design: run settings

What-if settings chosen on the setup screen before a run starts, beside Randomness: car
performance, career events, team names, teams and seats, breakdowns, reliability and
points. The Races group — breakdowns, reliability, points —, the Cars group — car
performance, varied from the real car or the previous year's, or at random —, the Drivers group — career events —,
team names, teams and seats filled automatically, and the plumbing every setting shares (`World.settings`, the Run settings
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

- **One segmented control per setting** (`SettingSegments`), so every row reads
  historical-versus-what-if the same way, and a third option is one more segment.
- **DECIDED** — *Teams and seats* gains one row under Keep, above the built ones:
  *Empty seats* `[ I fill them | Filled automatically ]`, *I fill them* first. Under
  *I fill them* the *Filled with* row and the active-only box go; *Driver ages* stays,
  since it still decides who is carried. The built rows are
  `.claude/rules/web-setup.md`.

## 3. Car performance from previous year's car

The walk is built (`.claude/rules/car-performance.md`), as a plain walk.

- **OPEN** — At ±20 or ±30 from previous year's car, ratings reach the clamp within a few
  seasons. Whether the walk pulls back towards the authored car (mean reversion,
  `era-advanced.md` §11). Recommendation: decide after watching a long run.

## 4. Teams and seats

Built with its automatic fills (`.claude/rules/teams-and-seats.md`). What is left is
*I fill them*, the `"reader"` fill `keptYear` and `fillSeats` already support.

- **DECIDED** — Carry-over still runs, and any hole makes the next year a **pending
  year** (`{ year, seed, kept, draft }`). `createWorld` needs a full lineup, so the grid
  page opens the editor on it and Apply builds the world; nothing past the grid is
  reachable. Continue is disabled with the reason on the button; **Jump to… stops at the
  first pending grid** ("Stopped at 2010: two seats need a driver"), a deliberate
  exception to a jump target being refused rather than clamped
  (`.claude/rules/web-era.md`). The recipe stores a pending year without a `check`. A
  driver placed by hand is never barred by the band.
- `OFFERED_SEAT_FILLS` gains `"reader"`, so `parseRunSettings` accepts it.

## 5. Which screen

- **DECIDED** — Era setup only: career events, team names, teams and seats, and Car
  performance's walk from *previous year's car*. The rest of Car performance is on both.
- **PROPOSED** — Eight rows on the era screen. If it reads long, *Teams over the years*
  goes behind a *More settings* disclosure that summarises any non-historical choice in
  one line when closed.

## 6. Build order

One session; it ends green and documented in `.claude/rules/`, and this file keeps only §3.

1. **I fill them**: the *Empty seats* row, the pending year, Continue gated, the jump
   stopping early.
