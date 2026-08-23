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

**Do not run the harness to check anything, either** — not to confirm a figure below,
not to see whether a change moved something. It is a long measurement loop that answers
a question nobody asked, and the numbers it prints are not a pass/fail. Nothing in the
test suite runs it, and nothing should: no test may depend on an authored rating or on
what a particular seed produced.

**Every figure below predates engine manufacturers, and was not re-measured.** Cars
are now `0.8 · chassis + 0.2 · engine` (`powertrain()` in the race model), which
compresses the field slightly around each shared engine's rating and moves the turbo
runners relative to the Cosworth ones. The win and pole shares in the table are
therefore a record of a grid the sim no longer runs. That is deliberate: adding an
entity between the car and the result is exactly the case the no-re-calibration
invariant lists as *needing the author's word first*, and the author has not given it.
**Do not run the harness to find out how far it has drifted** — that is the same long
loop the rule above forbids, and knowing the number changes nothing until someone
decides to re-tune. See `docs/DECISIONS.md`.

**Every figure below describes `buildField`'s default `peak` mode**, where drivers
race at their authored peaks. The `aged` mode added with the ageing curve produces a
different 1980 — a rookie Prost, a declining Scheckter — and is deliberately **not** calibrated
against anything. Do not "fix" the aged grid to match this table; they are answers to
two different questions.

**They also describe a race with no host country.** `pnpm calibrate` runs the same grid
N times through `simulateRace` with no `RoundContext`, so home advantage pays nothing in
any of them — the figures below are the neutral-race baseline they always were, unmoved
by that feature landing. Rotating the harness through a season's calendar would fold
home advantage into every number here; that is a change to what the harness measures,
and it needs the author's word before anyone runs it.

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
