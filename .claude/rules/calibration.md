---
paths:
  - "tools/calibrate/**"
  - "packages/engine/src/**/constants.ts"
  - "packages/data/src/*.json"
---

# The harnesses

Four instruments in `tools/calibrate`, and the rules for using them. **This file
describes how they work, not what they last printed.** No figure is recorded here on
purpose: the constants and the authored ratings are moved by hand between sessions, so
any number written down is wrong by the next one, and a stale measurement in a rule file
is worse than no measurement at all. If you want to know what the model does today, the
author runs it; you do not.

**Read the tuning invariant in `CLAUDE.md` before touching any number in these files.**
Short version: the values belong to the author. A session does not adjust them as a side
effect of building something, and does not describe them as fitted, calibrated or stale.

**Do not run a harness to check anything** — not to confirm something, not to see whether
a change moved a number. It is a long measurement loop answering a question nobody asked,
and what it prints is not a pass or a fail. Nothing in the test suite runs one, and
nothing should: no test may depend on an authored rating or on what a seed produced.

Two harnesses are the exception, because they have real targets and their output *is*
meant to be acted on: `pnpm retirements` (on a season's `retirementFactor` only) and
`pnpm fit <year>`.

```
pnpm race [seed]   # ONE race (--phase start|end; --wet 0-1 forces the weather)
pnpm season [seed] # simulate a full season, print both championships
pnpm calibrate [n] # run a grid n times (default 5000), print distributions
pnpm calibrate-season [n]  # a whole SEASON n times: title%, win%, score%, avg points
pnpm retirements [n]  # retirement rate per year vs real; --sweep re-fits the factor
pnpm progression <driver>  # one driver's ageing curve, age 16-55 (no arg lists the pool)
pnpm tune          # rating tuner (prints proposals, writes nothing)
pnpm fit <year>    # fit a season's chassis/engines to its real results; --write applies
```

## Measure at the reference level, on `aged`

**`DEFAULT_RANDOMNESS_LEVEL` is the reference level** and every harness takes it unless
told otherwise. It is not the stop the web app opens on — see
`.claude/rules/race-randomness.md` — and nothing here should read the app's choice.

**Every harness defaults to `aged`** — drivers at their ability in the year being
measured — from the shared `CALIBRATION_RATING_MODE` in `tools/calibrate/src/mode.ts`.
The tuner reads it too, so what it proposes is scored against the grid the sim races.

A `peak` field is a grid that has never existed: a 41-year-old at his best decade, a
rookie at a peak a decade away. Nothing measured off it can be compared with a real
season, and a rating fitted against one quietly absorbs the gap between a driver and his
own prime into the car beside him — a modern team can come out at a third of its real win
share purely because another team's peak driver outguns its own. `--mode peak` still
exists on the harnesses that take a `--mode`; it is not for producing a figure.

## They race the season the app races

Every harness that takes a year races on `seasonConstants` — that season's retirement
factor at the chosen randomness level — and the tuner does too, at the reference level.

**`pnpm calibrate` and the tuner race the real calendar.** Race *i* is held at round
*i* mod *n* (`tools/calibrate/src/calendar.ts`), so all three shares of home advantage
pay where a round has a host, and each car's `developmentTrend` is felt at that round's
point in the year. A win share there is the same quantity as one from
`pnpm calibrate-season`; what the season adds is titles and points. Points are convex in
pace, so a car with a trend scores slightly more on average than the same car flat
(`.claude/rules/car-development.md`).

**`pnpm race` is the one exception:** a single afternoon with no venue, mid-season unless
`--phase start|end` says otherwise (`phase.ts`). `pnpm calibrate` rejects `--phase`.

## The four

- **`pnpm calibrate`** runs one race N times and prints distributions.
- **`pnpm calibrate-season`** runs a whole season N times (`tools/calibrate/src/seasons.ts`)
  and prints, per driver and per team, title share, win share, how often they score at
  all, and average points. It is the instrument for the *midfield*: wins and poles
  describe the front of the grid, and a season is where sixth places add up. A reading
  instrument, not a target set — nothing scores against it and the tuner does not use it.
- **`pnpm retirements`** compares the retirement rate per year against the real record,
  and `--sweep` re-fits a season's `retirementFactor`. `.claude/rules/retirement-factor.md`
  is the write-up.
- **`pnpm fit <year>`** proposes the chassis and engine ratings that reproduce a real
  season. Targets live in `tools/calibrate/targets/<year>.json`, authored by hand from the
  real results — per team: points, wins, podiums, retirements — and **keyed by `teamId`,
  never by display name**, because a name is an era. A year with no targets file throws
  rather than borrowing another's.

## What the fitter deliberately will not do

Each of these was learned from watching it do the wrong thing first.

- **It fits points share, not wins.** Over a dozen-odd real races the standard error on a
  win count is enormous — ±14 points of share on 8 wins from 12 — so wins and podiums are
  printed as a sanity check and never scored against.
- **Reliability first, then pace with reliability pinned.** The other order lets pace
  quietly absorb reliability error.
- **It clips unreachable targets before fitting.** Real retirement spreads are far wider
  than the model can express — one modern season runs a factor of eleven between its most
  and least reliable team, against about four at a fixed `retirementFactor`. Fitted raw,
  the unreachable extremes dominate the residual and drag the shared engine with them,
  making every customer of that engine worse. Clipping says the honest thing: get the
  retirement *order* right, give up on the magnitude. The raw figure is still reported.
- **Ties break toward what is already authored.** An engine with one customer is not
  separately identifiable from that customer's chassis, so every split with the same
  blended reliability fits equally well; a first-past-the-post scan would walk it to
  whichever end it started from. When the data cannot tell two answers apart, do not move.
- **Engine reliability is drift-capped** (10 by default). The chassis floor means a car
  cannot be more fragile than `(60 + engine) / 2`, so a single fragile customer's only
  available scapegoat is the engine, and one bad car can walk a whole manufacturer down.
- **Reliability proposals are bounded** to 60-94 for a chassis and 35-94 for an engine,
  well inside what the seed files contain. Values at 0 or 100 are not realism, they are a
  cornered fit, and they would poison the progression and the game modes later.

It writes nothing without `--write`, and when it does it substitutes digits in place
rather than re-serialising, so the hand-aligned columns survive.

## Working here

- Tunable numbers live in one constants module per subsystem, never inline in logic.
  `packages/engine/src/race/constants.ts` is the pattern.
- `simulateRace` and `simulateSeason` both take constants as an optional override, which
  is how a harness sweeps values **without editing source**. Sweeping by editing a
  constants file and reverting is the wrong way round.
- **The tuner moves chassis and engines, and nothing else by default.** Driver ratings
  need `--drivers` and the noise constants need `--noise`, because the failure mode of a
  tuner is quietly rewriting more than you meant. Targets are per year in
  `tools/calibrate/src/targets.ts` under `tunedChassis`, and a year with no targets throws
  rather than borrowing another season's.
- **`MAX_DRIFT_CHASSIS` is a band around what is authored**, and it has to be wide enough
  for the blend: holding a car's effective pace steady while the engine takes 30% of it
  asks the chassis to move about 1.43× whatever the engine took out. Too narrow a band
  caps a fit before it starts.
- The tuner's `buildFieldFrom` starts from `buildField` and overlays only the ratings it
  is trying. Keep it that way: a hand-built field drifts from the one the sim races, and
  the tuner then optimises a model nothing runs.
- `tools/*` may use dev dependencies (tsx runs the TS directly). The engine may not.
