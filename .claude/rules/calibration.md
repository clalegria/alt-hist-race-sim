---
paths:
  - "tools/calibrate/**"
  - "packages/engine/src/**/constants.ts"
  - "packages/data/src/*.json"
---

# The harnesses

The measuring tools in `tools/calibrate`, and the rules for using them. The numbers they
read are the author's (`CLAUDE.md`).

```
pnpm race [seed]           # one race (--phase start|end; --wet 0-1 forces the weather)
pnpm season [seed]         # a full season, both championships
pnpm calibrate [n]         # one grid n times, distributions
pnpm calibrate-season [n]  # a whole season n times: title%, win%, score%, avg points
pnpm retirements [n]       # retirement rate per year vs real; --sweep re-fits the factor
pnpm progression <driver>  # one driver's ageing curve (no arg lists the pool)
pnpm tune                  # rating tuner: prints proposals, writes nothing
pnpm fit <year>            # fit a season's chassis/engines to its real results; --write applies
```

- **Don't run a harness to check anything**: not to confirm a change, not to see whether a
  number moved. What it prints is not a pass or a fail; the author runs them. No test runs
  one, and none may.
- **The exceptions are `pnpm retirements --sweep`** (a season's `retirementFactor` only)
  **and `pnpm fit <year>`**: they have real targets and their output is meant to be acted
  on, when the author asks for it.
- **Never write a figure a harness printed into a doc or a comment.** The numbers move by
  hand between sessions, so any recorded figure is soon wrong.
- **Measure at `DEFAULT_RANDOMNESS_LEVEL` and on `aged`** (`CALIBRATION_RATING_MODE`).
  The app's opening level is a UI choice and nothing here may read it; `--mode peak` is
  for reading a grid, never for producing a figure.
- **Sweep through the constants override** that `simulateRace` and `simulateSeason`
  take, never by editing a constants file and reverting.
- **A harness builds its field with `buildField`** and overlays only what it is trying
  (the tuner's `buildFieldFrom`); a hand-built field drifts from the one the sim races.
- **The tuner moves chassis and engines only by default**: driver ratings need
  `--drivers`, noise constants `--noise`. Keep it that way; a tuner's failure mode is
  quietly rewriting more than was meant.
- **Two sets of targets**: `pnpm fit` reads `targets/<year>.json`, the real record per
  team keyed by `teamId` (refreshing one is a data fix, not tuning); `pnpm tune` reads
  `src/targets.ts`. A year with no targets throws rather than borrowing another's.
- **The fitter's refusals are deliberate** (points share not wins, reliability before
  pace, clipped unreachable targets, ties toward what is authored, capped engine drift,
  bounded reliability), each argued in `fit.ts`: don't remove one because a fit would
  score better without it.
- `fit --write` substitutes digits in place (`writeSeason.ts`) so the hand-aligned
  columns survive; any other writer to a season file must do the same.
- `tools/*` may use dev dependencies (tsx runs the TypeScript directly). The engine may not.
