---
paths:
  - "packages/engine/src/race/constants.ts"
  - "packages/engine/src/race/gaps.ts"
---

# Race constants — why the numbers are what they are

Three levers that carry an argument, and one set that is decoration — why each is shaped
the way it is, so the next person does not undo the reasoning by accident. What the model
*does* with them is `.claude/rules/race-engine.md`; the instruments are
`.claude/rules/calibration.md`.

**Nothing here authorises changing a number.** The tuning invariant in `CLAUDE.md` covers
this file. The values belong to the author and move by hand; this file explains their
shape, and deliberately records no measurement, because a figure written down here would
be out of date by the next session.

## Gaps are decoration

`qualifyingGapToPole` and `raceGapToWinner` are pure functions of the scores, computed
in `race/gaps.ts` from four constants. The model has no time dimension at all — no
laps, no distance, no circuits — so a gap is a monotone relabelling of the sort key
and cannot disagree with the finishing order or add information to it. Nothing in the
sim reads them back; do not build championship logic on them.

Qualifying is linear (`0.15 s` per rating point). The race is a power curve,
`0.9 · deficit^1.5` seconds, because one seconds-per-point factor cannot serve both
ends: winner-to-second runs ~3 rating points while winner-to-last runs ~45, so
linear either bunches the field into a few seconds or puts the runner-up a minute
back. The exponent keeps the lead battle tight while the tail stretches into whole
laps, converted at a nominal 90-second lap (`nominalLapSeconds`, one value for every
circuit, since there is no track data). Set `raceGapExponent` to 1 for a linear map.

These are eyeballed for plausibility against an early-eighties race, and gaps shrank a
lot by the 2000s — expect to revisit them alongside the era work rather than treating
them as settled.

## Consistency is a pace stat *and* a variance stat

Consistency does two things. It subtracts a pace penalty from *both* session scores; and
it scales the spread of that session's noise, 1.3× at 0 down to 0.75× at 100, **each axis
off the rating that owns it** — the team's terms off the car's consistency, the entry's
own off the driver's. See `.claude/rules/race-engine.md`.

**The penalty runs off two spans, not one.** The car's consistency is interpolated from
`carConsistencyPacePenaltyAtZero` down to a shared floor of 0, the driver's from
`driverConsistencyPacePenaltyAtZero` down to the same floor, and the two are added under
the same 50/50 weights as before. Set the spans equal and this is *identical* to
interpolating once off the blended rating, which is what it did before the pair existed —
a test holds that, because it is what makes the split safe to have made.

They are apart because the two sides are not in the same position. Driver consistency
reaches a result through this penalty and almost nowhere else, its other channel being all
but closed (see below); the car keeps both. So the driver's span is the steeper, and
**raising it does not touch what a chassis's consistency is worth** — which is the
property that matters when every season has been fitted against the car's half. Another
test holds that one.

**The spread half is worth much less than the endpoints suggest**, and that is a
consequence of `teamFormShare` rather than of these numbers: a driver's consistency now
scales only `1 - teamFormShare` of the variance, so at 0.85 a 90-consistency driver and a
20-consistency one in identical cars differ in spread by about 7%, where the same pair
differed by ~20% when one blended multiplier scaled everything. Widening these endpoints
is the way to buy that back, at the usual price in wildcards.

**The pace penalty exists because spread alone does not work.** Consistency originally
scaled the spread *only*, which is mean-neutral and therefore not a handicap at all —
worse, it inverted win rates, because winning from behind is an upper-tail event and a
wider tail hands a slow car more victories. A skewed-noise variant (stretching only the
bad half) was tried too: it fixes average finishing position but *cannot* fix wins, since
it leaves the upper tail untouched by construction. Only moving the mean makes a less
consistent pairing worse on every measure at once, and the penalty is what carries that.

**The spread lever was pinned flat at 1.0 and is now open at 1.3 / 0.75.** The reason
for reopening it is that flat made `consistency` a rating which costs pace and nothing
else — a 96-consistency driver and a 60-consistency driver had *identically shaped*
distributions, which is not what the word means and throws away a large part of what
separates a first driver from a second in the same car.

The cost the flat setting was avoiding is real and is now accepted rather than
abolished. Opening the lever hands the strongest car a little more win share and rather
more pole share, because its high-consistency pairing now has the tighter distribution;
an erratic backmarker also wins slightly more often while still finishing worse on
average. Two tests hold that trade in place: the erratic car's mean finish must stay
worse, and its win rate must stay under twice the steady car's.

Widen the gap for more wildcards and streakier racing; close it back toward 1.0 for
stricter dominance by the best pairing. A middle option is untried: stretch the bad tail
*and* compress the good one, keeping some asymmetry while capping the ceiling.

## The noise splits on two axes: weekend/session, and team/car

Each session's noise is divided twice over, and the two divisions are independent.

`weekendFormShare` (0.5) says how much of it carries from Saturday to Sunday. A car that
has found something on Saturday tends to still have it on Sunday, so the weekend part is
drawn once and reused by both sessions. 0 restores independent sessions; 1 makes the race
a deterministic function of qualifying (every race processional), so it is a bound, not a
target.

`teamFormShare` (0.85) says how much of it belongs to the **team** rather than the
individual car. Crossing the two gives four draws per session — team form for the
weekend, car form for the weekend, team luck on the day, car luck on the day — weighted
by the square roots of the four products, which sum to 1. Each session's total sigma is
therefore untouched by either share, and so is the correlation between the sessions.

**The team share is why a weaker teammate no longer wins too often.** Before it existed
the only weekend draw was per car, so every bit of weekend-to-weekend swing stood between
two drivers in the same machinery — at `sqrt(2)` times the nominal sigma, against a
driver-rating gap worth only `weightDriverRacing` times itself. Even the largest teammate
gap on the grid was under one standard deviation. Both team terms cancel out of a
teammate comparison, so raising this share shrinks what separates them to
`sqrt(1 − share)` of the sigma **without touching the spread across the field**. That is
the whole argument for it: it is a redistribution, not an extra dice roll.

What it was reasoned against is real teammate head-to-heads, which for a strong pairing
in a dominant car sit around a fifth to a quarter of races — where the model, before the
share existed, was closer to a third. Teams whose two drivers are close stay near a coin
flip, which is correct. Both shares are judgements rather than answers to a harness.

## The DNF endpoints carry a wet correction

None of the four is a round number, and the factor below is why. Wet racing raises both
risks — up to 2.6x driver error, 1.25x mechanical — and with ~15% of rounds wet at a mean
wetness near 0.51, that inflates a season's expected driver-error risk by ~12% and its
mechanical risk by ~2%. Every season's `retirementFactor` answers a model with no weather
in it, so without a correction the drift would land on all 77 years at once.

| constant | base | correction | value |
| --- | --- | --- | --- |
| `mechanicalDnfAtZeroReliability` | 0.75 | x0.985 | 0.739 |
| `mechanicalDnfAtFullReliability` | 0.12 | x0.985 | 0.118 |
| `driverErrorDnfAtZeroComposure` | 0.3 | x0.90 | 0.27 |
| `driverErrorDnfAtFullComposure` | 0.03 | x0.90 | 0.027 |

**Two numbers, not one.** The rolls are inflated by very different amounts and eras
differ in which retires more cars, so a blanket scale left about three times the residual
at the high-attrition end. Derived analytically — `1 / (1 + 0.15 · 1.6 · 0.51)` and
`1 / (1 + 0.15 · 0.25 · 0.51)` — then softened a shade by measurement, since reducing
both risks together lowers the *rate* slightly more than proportionally where retirements
overlap.

**Checked end to end against the real record** with `pnpm retirements` over all 77
years: weather without the correction drifts the whole set noticeably wide, and weather
with it lands back where the seasons sat before weather existed.

**It applies to dry races too, and that is deliberate.** A season is ~85% dry rounds, so
restoring a season's total puts most of the correction on them — a dry race retires
marginally fewer cars than before, a wet one far more. Holding the dry race *and* the
season total fixed is impossible while wet races retire more, and the author chose the
season total, because that is the quantity every season file answers. Authorised
2026-09-02.

## Teammate retirements are correlated, and the rate is not

`mechanicalDnfTeamCorrelation` (0.5) makes two cars of one team break on the same
afternoon more often than chance. Each team draws one hidden "how fragile is the car
today" value per race; each car's roll is `sqrt(rho)` of that plus `sqrt(1 − rho)` of its
own, pushed back through the normal CDF into a uniform before it meets the risk.

That last step is the point: the result is still uniform, so **each car's own failure
rate is exactly what its reliability says**, and only the pairing changes. A season's
`retirementFactor` therefore still describes the same total number of retirements. Two
tests hold it: the marginal rate must match what the constants imply, not merely match
itself at another correlation.

At 0.5, a car with an 18.5% failure rate sees its teammate fail about 42% of the time it
fails itself, against 18.5% under independence. **The lever is close to exhausted**: even
at 0.85 the largest-gap teammate upsets only fall from 6.5% to 4.8%, against a 0.9% floor
with retirements switched off entirely, because driver error is independent and carries
the remainder — it is left that way on purpose, since composure belongs to the driver and
two drivers do not spin in sympathy.

The reason it matters is the championship rather than the race. Teammates share a car and
so share a failure probability; rolled independently they still ended a 17-round season
about two retirements apart on luck alone, which is worth more points than a season's
honest pace advantage. This is the second half of the teammate fix, and much the smaller
half — on its own it moves the second driver's title odds by about a point and a half.

## Composure is rotated before it becomes a risk

The driver-error endpoints are not read straight: `composureSpreadGain` rotates the line
between them about `composureSpreadPivot`, because the band a real field occupies is far
narrower than 0-100 and the raw endpoints therefore price a calm driver and a wild one
much closer together than their ratio suggests. The rotation holds the risk at the pivot
fixed, so a season's `retirementFactor` still means what it meant, and a gain of 1 is the
identity. `.claude/rules/driver-error.md` has the whole argument, including what raising
it cannot do.

The randomness slider that scales these sigmas is its own rule,
`.claude/rules/race-randomness.md`, which loads with `randomness.ts`.
