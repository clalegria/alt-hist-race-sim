---
paths:
  - "packages/engine/src/race/composure.ts"
---

# Driver error — composure, and the spread gain

`driverErrorRisk(composure, constants)` in `race/composure.ts` is the only place a
composure rating becomes a probability. The race model reads it, and so does `pnpm fit`,
which needs the same answer without running a race — a second copy of the formula would
be a second answer to how often a driver puts it in the barrier.

**Nothing here authorises changing a number.** The tuning invariant in `CLAUDE.md`
covers this file, and it deliberately records no measurement.

## Two anchors and a rotation

`driverErrorDnfAtZeroComposure` and `driverErrorDnfAtFullComposure` anchor a line across
the whole 0-100 rating scale. Those two carry a wet correction of their own, which is
`.claude/rules/race-constants.md`; what this file is about is what happens to the line
between them.

A field never occupies that scale. Composure on a real grid sits in a band some forty
points wide, and the aged pool's mean has stayed close to `composureSpreadPivot` in every
era the seed data covers — the band moves a little with the decades, but not much. Read
straight off the anchors, that band spans only a fraction of the line, so the distance
between a calm driver and a wild one comes out far smaller than a 10:1 pair of endpoints
suggests. Most of the line is spent on composure nobody is authored with.

`composureSpreadGain` buys that distance back by **rotating the line about the pivot**: a
driver `n` points clear of it is priced as though they were `n · gain` clear of it. Two
properties follow, and both are held by tests:

- **The risk at the pivot does not move.** So a field whose mean composure sits near the
  pivot retires about as many cars however the gain is set, and each season's
  `retirementFactor` still describes the year it was written for. What changes is the
  spread *inside* the field, which is the entire point of the constant.
- **A gain of 1 is the identity.** The line is exactly the one the two anchors draw. That
  is the guarantee to keep: the constant can be turned off and the model is the one the
  seasons were authored against.

## The rating axis is unclamped, and has to be

Rotating a line while clamping the *rating* into 0-100 flattens every driver past the
point the clamp bites — and at any gain above 1 that point is inside the composed end of a
real grid, which is exactly the end the rotation exists to separate. So the line runs on
past both anchors and only the resulting **probability** is clamped into [0, 1].

Two consequences worth knowing before touching the gain:

- A composed enough driver is priced *below* `driverErrorDnfAtFullComposure`, and at a
  high enough gain down to never erring at all. That floor is a bound to stay clear of,
  not a target — a driver who cannot make a mistake is not a driver.
- A wild enough driver is priced above the other anchor. The probability clamp is what
  keeps that meaningful rather than absurd.

## What raising the gain cannot do

It cannot make composure legible within a single season, and reaching for it again when a
season looks wrong is the mistake this paragraph exists to prevent.

A driver-error retirement is a handful of rare independent rolls over a calendar, so the
count carries a spread of roughly its own square root whatever the rate is. Steepening the
line moves the long-run ordering; it does not shrink the noise around it. A composed
driver will still have the occasional dreadful season, and a wild one the occasional clean
one, and that will remain true at any gain the model can sensibly carry. Making composure
visible race by race would take a second, non-binary channel — something that costs pace
rather than the whole afternoon — which is a change to what the rating *means*, not a
number to turn.

## How it composes

Both anchors arrive already scaled: by the season's `retirementFactor`
(`.claude/rules/retirement-factor.md`) and by the weather (`.claude/rules/wet-weather.md`),
which also blends composure itself toward the driver's `wetWeather` rating before it gets
here. The gain acts on the rating axis and those act on the probability axis, so they
multiply cleanly and in any order — a test holds that, because if it ever stopped being
true every season file would be describing a different year.

Driver error stays **independent between teammates**, unlike the mechanical roll. Composure
belongs to the driver, and two drivers do not spin in sympathy.
