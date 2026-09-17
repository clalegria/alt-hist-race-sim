---
paths:
  - "packages/engine/src/race/**"
---

# Race model (v1) — score-and-sort

Six stages, all constants in `race/constants.ts` — the first two are what the afternoon
and the car *are*, the rest are what happens to them:

-1. **The weather** — rolled before anything else, two draws whether it rains or not.
   About one round in seven is wet, and a wet one replaces `constants` with a derived
   copy (wider noise, harsher retirements, the score leaning onto the driver and the
   chassis) and each driver with a copy blended toward their `wetWeather` rating. **A
   dry round gets both back by identity**, so most rounds are scored by exactly the
   constants as written. `.claude/rules/wet-weather.md` has the whole of it; the
   weights and sigmas quoted below are the *dry* ones.
0. **The car** — `0.7·chassis + 0.3·engine` on racing and qualifying, and an even
   `0.5/0.5` on reliability, blended once per entrant by `powertrain()` before anything
   is scored. Consistency is the chassis alone. Everything below reads *that* car,
   never `entrant.chassis`. A car with a `developmentTrend` then has its two pace
   ratings rotated by where in the season the round sits (`round.seasonProgress`) —
   `.claude/rules/car-development.md`. A lone race says nothing about when it is, so
   it is mid-season and every trend is worth zero.
1. **Qualifying** — `0.64·car + 0.36·driver + home − consistencyPenalty + noise`, sorted
   → grid. The whole entry list runs, however big it is.
2. **The cut** — the fastest `maxStarters` (26, the 1980 limit) take the start.
   Anyone slower keeps their grid position but is a **DNQ**: `started: false`,
   `raceScore: null`, and *not* a retirement. `retirements` and `classifiedCount`
   count starters only; `nonQualifiers` counts the rest. A field at or under the
   limit is unaffected, so this is inert rather than something to switch off.
3. **Race** — `0.62·car + 0.38·driver + gridBonus + home − consistencyPenalty + noise`,
   sorted → finishing order. Grid bonus decays exponentially from 3.0 points at pole.
4. **DNFs** — two rolls per car: mechanical (from car reliability) and driver error
   (from composure). Both always rolled; mechanical takes precedence when recording the
   cause. Driver error is independent; **the mechanical roll is correlated between two
   cars of the same team** — see "Noise and retirements are team-shaped" below.

The car is weighted above the driver on purpose: a great driver in a poor car should be
a points-scorer, not a winner. The driver's share is 0.38 in the race
and 0.36 in qualifying; it was raised from 0.30 and 0.28 to stop weak teammates beating
strong ones too often. `mechanicalDnfEraScale` (default 1.0 = 1980)
is the hook for reliability improving across decades, and **the per-year curve now
exists**: every season file carries a 1-10 `retirementFactor`, which scales this *and*
the driver-error endpoints — see `retirement.ts` and
`.claude/rules/retirement-factor.md`. Nothing in this file reads it; a season's
constants are derived before they reach the model.

`simulateRace(field, rng, constants?, round?)` takes constants as an optional override,
which is how the harnesses sweep values without editing source. `round` is a
`RoundContext` — *where* the race is being held — and defaults to `{}`, a neutral race
scored exactly as it was before home advantage existed.

## Noise and retirements are team-shaped

Both `noise` terms above are split on two independent axes at once: `weekendFormShare`
(0.5) decides how much carries from Saturday to Sunday, `teamFormShare` (0.85) how much
belongs to the **team** rather than to the individual car. Crossing them gives four draws
per session — team form for the weekend, car form for the weekend, team luck on the day,
car luck on the day — weighted by the square roots of the four products, so each session's
total sigma is exactly what the constants say and neither share affects the other.

The team share is what stops the dice deciding a teammate battle: both team terms cancel
out of a comparison between two cars in the same garage, so what separates them is
`sqrt(1 − share)` of the sigma rather than all of it — while the spread across the *field*
is untouched. `teamFormBoost` (1 by default) is
the randomness slider's lever on the team half alone.

The mechanical DNF roll is correlated within a team the same way:
`mechanicalDnfTeamCorrelation` (0.5) mixes a shared per-team fragility draw with the car's
own, then passes the result through the normal CDF so it is still uniform. Each car's
failure *rate* is therefore exactly what its reliability says, and only the pairing
changes — which is what leaves every season's `retirementFactor` describing the
same total number of retirements. Why these exist and what they were worth is
`.claude/rules/race-constants.md`.

**Consistency modulates each axis from the rating that owns it.** The team's terms are
scaled by the *car's* consistency, so both sides of a garage get the same number and the
team half cancels exactly out of a teammate comparison; the entry's own terms are scaled
by the *driver's*. One blended multiplier over everything — which is what this did at
first — leaks the driver's consistency into the team's weekend and quietly gives two
teammates different team form.

**Team draws are taken lazily**, at the first car of each team in field order, so
appending an entrant cannot shift anyone already in the field along the RNG stream. A team
costs four draws (form, two session lucks, fragility) however many cars it enters.

## Engines

`powertrain(chassis, engine, constants?)` blends a `ChassisSpec` into the `CarSpec` the
model scores, by **two ratios, not one**: 0.7 / 0.3 chassis-to-engine on pace, an even
0.5 / 0.5 on reliability, and consistency from the chassis alone. Everything about why —
the identity case, the exported `carOverall` the UI shares, and why the two halves are
one judgement — is `.claude/rules/race-powertrain.md`.

## Home advantage

An entry has three allegiances — driver, team and engine supplier — and each pays into
both session scores when the round's country matches, for a ceiling of 1.75 points.
`homeAllegiances()` / `homeAdvantage()` in `race/home.ts` own it, and are exported
because the web app's star reads the same function. The whole of it, both sides, is
`.claude/rules/home-advantage.md`.

## Non-qualifiers still draw their dice

Non-qualifiers draw their race noise and both DNF rolls, and the results are thrown
away. Skipping the draws would make every later car's position in the RNG stream
depend on who made the cut, which breaks append-independence — the invariant that
adding a car to the end of the field cannot change anyone else's weekend.

## Why the numbers are what they are

The tuning rationale behind the constants — what consistency does to both the mean and
the spread, how the noise splits on its two axes, why teammate retirements are
correlated, and why the cosmetic gaps are shaped the way they are — is
`.claude/rules/race-constants.md`, which loads when you open `constants.ts` or `gaps.ts`.
The randomness slider over those sigmas is `.claude/rules/race-randomness.md`.
