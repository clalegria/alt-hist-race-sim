---
paths:
  - "tools/calibrate/**"
  - "packages/engine/src/**/constants.ts"
  - "packages/data/src/*.json"
---

# Calibration

**Read the no-re-calibration invariant in `CLAUDE.md` before touching any number in
these files.** Short version: the values below are settled, and re-tuning happens only
when the author asks or when a deep change to how performance is computed makes the
old values a different claim. The figures here are the record of what was measured,
not an invitation to re-measure.

## Status against the real 1980 season (14 races), at 20,000 simulated races

| Team | Model win% | Actual | Model pole% | Actual (approx) |
|---|---|---|---|---|
| Williams | 42.1% | 42.9% | 27.7% | ~21% |
| Renault | 21.4% | 21.4% | 42.3% | ~43% |
| Brabham | 19.5% | 21.4% | 9.2% | ~7% |
| Ligier | 16.2% | 14.3% | 20.7% | ~21% |

Retirements 41.1% of the 26 starters, matching the era. (This was 42.0% before the
starting limit landed; the two cars that now miss the cut are unreliable ones, so
dropping them out of the denominator moves the rate slightly. Win and pole
percentages did not shift at all — the cut only ever touches the back of the grid.)
Reference targets live in `tools/calibrate/src/targets.ts`.

The 28-entry 1980 grid means two DNQs a weekend. They fall where they should: Shadow
takes 54.9% and 99.0% (Kennedy failed to qualify for all seven races he entered in
reality), Osella 34.5%, ATS and Ensign under 5%, and nobody above them ever misses.

The consistency pace penalty is a systematic term that did not exist when the cars
were first tuned, and it cost Renault disproportionately (Arnoux and Jabouille are
both below-average consistency, and Renault's whole 1980 identity was qualifying
pace). Absorbed with a second car pass: **Renault qualifying 90 → 91, racing 93 → 95**.
That lands every headline number closer to target than the pre-penalty calibration did.

**Known accepted gaps — do not "fix" these.** Alfa Romeo takes 0% of poles
(Giacomelli's real 1980 pole was a freak; forcing it would distort the car). Williams
still over-takes poles (27.7% vs ~21%). Reutemann over-wins at 16.5% against 1 real
win (a one-event sample — not worth fitting).

## Working here

- Tunable numbers live in one constants module per subsystem, never inline in logic.
  `packages/engine/src/race/constants.ts` is the pattern.
- `simulateRace` and `simulateSeason` both take constants as an optional override,
  which is how the harness sweeps values **without editing source**. Sweeping by
  editing a constants file and reverting is the wrong way round.
- `tools/*` may use dev dependencies (tsx runs the TS directly). The engine may not.
- Driver ratings are un-tuned on purpose and cannot be tuned until the ageing curve
  exists — see `docs/DECISIONS.md`.
