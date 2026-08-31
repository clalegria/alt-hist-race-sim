---
paths:
  - "packages/engine/src/race/**"
---

# Race model (v1) — score-and-sort

Five stages, all constants in `race/constants.ts` — the first is what a car *is*, the
rest are what happens to it:

0. **The car** — `0.7·chassis + 0.3·engine` on racing and qualifying, and an even
   `0.5/0.5` on reliability, blended once per entrant by `powertrain()` before anything
   is scored. Consistency is the chassis alone. Everything below reads *that* car,
   never `entrant.chassis`.
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
a points-scorer, not a winner. The driver's share **rose from 0.30 to 0.38** (and 0.28 to
0.36 in qualifying) to stop weak teammates beating strong ones too often — the cost is
that it changes what a rating means, so the authored chassis ratings it was fitted
against are now a slightly different claim; see `.claude/rules/calibration.md`. `mechanicalDnfEraScale` (default 1.0 = 1980)
is the hook for reliability improving across decades, and **the per-year curve now
exists**: every season file carries a 1-10 `retirementFactor`, which scales this *and*
the driver-error endpoints — see `retirement.ts` and
`.claude/rules/retirement-factor.md`. Nothing in this file reads it; a season's
constants are derived before they reach the model.

`simulateRace(field, rng, constants?, round?)` takes constants as an optional override,
which is how the calibration tools sweep values without editing source. `round` is a
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
`sqrt(1 − share)` of the sigma rather than all of it — while the spread across the *field*,
which is what the calibration measured, is untouched. `teamFormBoost` (1 by default) is
the randomness slider's lever on the team half alone.

The mechanical DNF roll is correlated within a team the same way:
`mechanicalDnfTeamCorrelation` (0.5) mixes a shared per-team fragility draw with the car's
own, then passes the result through the normal CDF so it is still uniform. Each car's
failure *rate* is therefore exactly what its reliability says, and only the pairing
changes — which is what leaves every season's fitted `retirementFactor` describing the
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

`powertrain(chassis, engine, constants?)` in `race/powertrain.ts` is the whole of it,
and it takes a `ChassisSpec` to a `CarSpec` by **two ratios, not one**:

- **Pace** — `weightChassisPerformance` (0.7) and `weightEnginePerformance` (0.3), on
  `racing` and `qualifying`. The engine is the minority share because an authored
  chassis rating already contains part of what its engine contributed.
- **Reliability** — `weightChassisReliability` and `weightEngineReliability`, an even
  0.5 each. Unlike pace, reliability is *not* mostly a property of the car the team
  built: blowing up, losing oil pressure or dropping a valve are the engine's own
  failures and owe nothing to the tub they are bolted to.

**Consistency is not blended** — an `EngineSpec` has three ratings, not four, because
how repeatable a car's pace is comes from the chassis and the setup; an engine either
makes its power or breaks, and the second of those is `reliability`.

Three things hold it in place:

- **It is exported, and the UI uses the same function.** `carOverall(chassis, engine)`
  in `@alt-hist/data` runs the blend through `powertrain` rather than weighting the
  engine itself, so the headline number on the grid page is a summary of the car that
  will actually be raced. A second copy of the blend would be a second answer, and with
  two ratios in play it would be twice as easy to get wrong.
- **No engine is the identity.** `powertrain(chassis)` returns the chassis. Every field
  built before engines existed, and every synthetic field in these tests, is scored
  exactly as it was — which is what keeps those tests meaningful.
- **It draws no randomness**, like home advantage: the RNG stream after a race is
  identical with and without engines, so a supplier change cannot shift a later round
  through the dice.

`engine` and `engineId` ride on `RaceEntrant` alongside `chassis` and `teamCountry`,
filled in by `buildField` from the season's own engine table. The engine package still
reads no seed data, and `engineId` is identity the model never looks at.

**Chassis and car are separate names for a reason.** `ChassisSpec` is the authored tub
and `CarSpec` is what comes out of `powertrain()`; they are structurally identical, so
the names are the only thing telling a reader which of the two they hold. The season
JSON says `chassis`, `RaceEntrant` says `chassis`, and everything downstream of the
blend says `car`.

**The pace share is the minority one on purpose.** A season's authored chassis rating is
a judgement about the package as it raced, so part of what the engine contributed is
already inside it; 0.3 is the part that moves when a team changes supplier. A larger
share would flatten the grid, because one engine is shared across a very wide range of
chassis — the 1980 Cosworth DFV ran in chassis rated from 42 to 91.

**The chassis and engine ratings were fitted together, against both seasons — but at
the old `0.8 / 0.2` on all three attributes.** The weights have since moved to
`0.7 / 0.3` on pace and `0.5 / 0.5` on reliability, and **the ratings have not been
re-fitted**; the tables in `.claude/rules/calibration.md` therefore no longer describe
the model. That is a re-tune waiting on the author's word, not something to run
unprompted. Driver ratings were held fixed throughout, and remain the author's.

## Home advantage

An entry has **three allegiances**, and each pays into *both* session scores when the
round's country matches: `homeAdvantageDriver` (1.0) against `driverCountry`,
`homeAdvantageTeam` (0.5) against `teamCountry`, and `homeAdvantageEngine` (0.25)
against `engineCountry`. They stack, so a Frenchman in a Ligier-Matra at Paul Ricard
collects all three — 1.75 points, and that ceiling is the number to weigh these by, not
any one of them alone. An Italian in a Ferrari at Monza collects 1.5; a Brazilian in the
same car collects 0.75.

The ordering is the claim, and there is a test asserting it: a crowd shouts for the
driver first, the team second, and the supplier least of all — it brought engineers and
a truck, not a factory that slept in its own beds. Codes are ISO alpha-2, compared case-
and whitespace-insensitively; anything absent — no round country, no entrant country, no
engine — is simply no match. Set the constants to 0 to switch any share off.

Three properties hold it in place, each with a test:

- **It draws no randomness.** The RNG stream after a race is identical with and
  without a host country, so where a round is held cannot change what happens at every
  later round of the season.
- **A shared bonus is invisible.** Only differences between cars move a result, so a
  grid where everyone is at home finishes in exactly the order it otherwise would.
  Most of the 1980 field was British, which means what this really prices is the
  *visitor's* deficit at a round the paddock treats as home.
- **The countries are identity, not rating.** All three ride on `RaceEntrant`, filled
  in by `buildField` from the driver's `nationality`, the team's `base` and the engine
  manufacturer's; the engine still reads no seed data, and a field built without them
  races everywhere as a visitor.

The three numbers are a first guess, chosen for plausibility — a home race is worth a
tenth or two, not a car upgrade — and have never been fitted. **The calibration figures
cannot see them**: `pnpm calibrate` and the tuner both run with no `RoundContext`, so
home advantage pays nothing in any measured race. That is why adding the engine's share
did not require re-tuning anything, and why fitting these would mean first deciding
whether the harness should rotate through a real calendar. See
`.claude/rules/calibration.md`.

The engine's share is worth even less than 0.25 suggests, for the reason the other two
are worth less than they look: a bonus most of the field collects is invisible. Ten of
the fifteen 1980 entries ran a Cosworth, so at Brands Hatch this pays almost everybody
— what it really prices is Ferrari's and Alfa's deficit there, and their advantage at
Imola.

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
