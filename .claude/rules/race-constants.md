---
paths:
  - "packages/engine/src/race/constants.ts"
  - "packages/engine/src/race/gaps.ts"
---

# Race constants — why the numbers are what they are

Why each lever is shaped the way it is, beyond what the doc comments in `constants.ts`
already say, so the next person does not undo the reasoning by accident. What the model
*does* with them is `.claude/rules/race-engine.md` (loads alongside this); the
instruments are `.claude/rules/calibration.md`. **Nothing here authorises changing a
number** (`CLAUDE.md`), and it deliberately records no measurement.

## Gaps are decoration

`qualifyingGapToPole` and `raceGapToWinner` are pure functions of the scores, computed
in `race/gaps.ts` from four constants. The model has no time dimension at all — no
laps, no distance, no circuits — so a gap is a monotone relabelling of the sort key
and cannot disagree with the finishing order or add information to it. Nothing in the
sim reads them back; do not build championship logic on them. Why qualifying is linear
and the race a power curve is on `raceGapSecondsAtOnePoint` in `constants.ts`.

## Consistency is a pace stat *and* a variance stat

It subtracts a pace penalty from *both* session scores, and scales that session's noise
1.3× at 0 down to 0.75× at 100 (per axis, as `.claude/rules/race-engine.md` describes).

**The penalty runs off two spans, not one** — car and driver, meeting at a shared floor
of 0. Two tests hold the split: equal spans score *identically* to one interpolation off
the blended rating, and **raising the driver's span does not touch what a chassis's
consistency is worth**, since every season's chassis ratings assume the car's half as
it stands.

**The spread half is worth much less than the endpoints suggest**, because of
`teamFormShare` rather than these numbers: a driver's consistency scales only
`1 - teamFormShare` of the variance, so at 0.85 a 90-consistency driver and a
20-consistency one in identical cars differ in spread by about 7%. Widening these
endpoints is the way to buy that back, at the usual price in wildcards.

**The pace penalty exists because spread alone does not work.** Scaling the spread only
is mean-neutral, so not a handicap at all — worse, it inverts win rates, because winning
from behind is an upper-tail event and a wider tail hands a slow car more victories. A
skewed-noise variant (stretching only the bad half) fixes average finishing position but
*cannot* fix wins, since it leaves the upper tail untouched by construction. Only moving
the mean makes a less consistent pairing worse on every measure at once.

**The open spread lever's cost is accepted, not abolished**: an erratic backmarker wins
slightly more often while still finishing worse on average. Two tests hold that trade:
the erratic car's mean finish must stay worse, and its win rate must stay under twice
the steady car's.

## The DNF endpoints carry a wet correction

None of the four is a round number: each carries a correction undoing what wet racing
adds to a season's retirement risk, so every season's `retirementFactor` still answers
the model it was written against. The derivation, why it is two numbers rather than
one, and why it lands on dry races too are on `driverErrorDnfAtZeroComposure` in
`constants.ts`; the wet multipliers are `.claude/rules/wet-weather.md`.

| constant | base | correction | value |
| --- | --- | --- | --- |
| `mechanicalDnfAtZeroReliability` | 0.75 | x0.985 | 0.739 |
| `mechanicalDnfAtFullReliability` | 0.12 | x0.985 | 0.118 |
| `driverErrorDnfAtZeroComposure` | 0.3 | x0.90 | 0.27 |
| `driverErrorDnfAtFullComposure` | 0.03 | x0.90 | 0.027 |

## Teammate retirements are correlated, and the rate is not

`mechanicalDnfTeamCorrelation` (0.5) changes which failures land together, never how
many there are (mechanism: `.claude/rules/race-engine.md`; reasons: its doc comment). A
test holds each car's marginal rate against what the constants imply, not merely against
itself at another correlation. For scale: at 0.5, a car with an 18.5% failure rate sees
its teammate fail about 42% of the time it fails itself, against 18.5% under
independence.

## Composure is rotated before it becomes a risk

`composureSpreadGain` rotates the driver-error line about `composureSpreadPivot`, because
a real field's composure band is far narrower than 0-100. The risk at the pivot is fixed
and a gain of 1 is the identity; the whole argument is `.claude/rules/driver-error.md`.
