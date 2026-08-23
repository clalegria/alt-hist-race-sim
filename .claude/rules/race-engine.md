---
paths:
  - "packages/engine/src/race/**"
---

# Race model (v1) — score-and-sort

Four stages, all constants in `race/constants.ts`:

1. **Qualifying** — `0.72·car + 0.28·driver + home − consistencyPenalty + noise`, sorted
   → grid. The whole entry list runs, however big it is.
2. **The cut** — the fastest `maxStarters` (26, the 1980 limit) take the start.
   Anyone slower keeps their grid position but is a **DNQ**: `started: false`,
   `raceScore: null`, and *not* a retirement. `retirements` and `classifiedCount`
   count starters only; `nonQualifiers` counts the rest. A field at or under the
   limit is unaffected, so this is inert rather than something to switch off.
3. **Race** — `0.70·car + 0.30·driver + gridBonus + home − consistencyPenalty + noise`,
   sorted → finishing order. Grid bonus decays exponentially from 3.0 points at pole.
4. **DNFs** — two independent rolls per car: mechanical (from car reliability) and
   driver error (from composure). Both always rolled; mechanical takes precedence
   when recording the cause.

The car is weighted far above the driver on purpose: a great driver in a poor car
should be a points-scorer, not a winner. `mechanicalDnfEraScale` (default 1.0 = 1980)
is the hook for reliability improving across decades — the per-year curve is not
defined yet and belongs to the progression model.

`simulateRace(field, rng, constants?, round?)` takes constants as an optional override,
which is how the calibration tools sweep values without editing source. `round` is a
`RoundContext` — *where* the race is being held — and defaults to `{}`, a neutral race
scored exactly as it was before home advantage existed.

## Home advantage

`homeAdvantageDriver` (1.0) is added to **both** session scores when the round's
country matches the entrant's `driverCountry`, and `homeAdvantageTeam` (0.5) when it
matches `teamCountry`. They stack, so an Italian in a Ferrari at Monza collects 1.5
points and a Brazilian in the same car collects 0.5. Codes are ISO alpha-2, compared
case- and whitespace-insensitively; anything absent — no round country, no entrant
country — is simply no match. Set both constants to 0 to switch the term off.

Three properties hold it in place, each with a test:

- **It draws no randomness.** The RNG stream after a race is identical with and
  without a host country, so where a round is held cannot change what happens at every
  later round of the season.
- **A shared bonus is invisible.** Only differences between cars move a result, so a
  grid where everyone is at home finishes in exactly the order it otherwise would.
  Most of the 1980 field was British, which means what this really prices is the
  *visitor's* deficit at a round the paddock treats as home.
- **The countries are identity, not rating.** They ride on `RaceEntrant`, filled in by
  `buildField` from `nationality` and `base`; the engine still reads no seed data, and
  a field built without them races everywhere as a visitor.

The two numbers are a first guess, chosen for plausibility — a home race is worth a
tenth or two, not a car upgrade — and have never been fitted. The calibration figures
predate them and describe a neutral race; see `.claude/rules/calibration.md`.

## Non-qualifiers still draw their dice

Non-qualifiers draw their race noise and both DNF rolls, and the results are thrown
away. Skipping the draws would make every later car's position in the RNG stream
depend on who made the cut, which breaks append-independence — the invariant that
adding a car to the end of the field cannot change anyone else's weekend.

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

These are eyeballed for plausibility against 1980, not fitted, and gaps shrank a lot
by the 2000s — expect to revisit the constants alongside the era work rather than
treating the current values as calibrated.

## Consistency is a pace stat, not a variance stat

Combined consistency (50/50 car and driver) subtracts `consistencyPacePenalty`,
interpolated 4.0 points at 0 down to 0 at 100, from *both* session scores. Across the
1980 grid (combined consistency runs 46–90) that is a ~1.8 point spread, worth ~6
driver rating points.

This is deliberate and was arrived at by measurement. Consistency originally scaled
the *spread* of the noise (1.6× at 0 down to 0.5× at 100), which is mean-neutral and
therefore not a handicap at all — worse, it inverted win rates, because winning from
behind is an upper-tail event and a wider tail hands a slow car more victories. A
skewed-noise variant (stretching only the bad half) was built and measured too: it
fixes average finishing position but *cannot* fix wins, since it leaves the upper
tail untouched by construction. Only flattening the spread and moving the mean makes
a less consistent pairing worse on every measure at once — fewer wins, fewer poles,
worse average finish, no compensating upside.

`consistencyNoiseMultiplierAtZero/AtHundred` survive as a lever, both pinned at 1.0.
Reopening a gap between them trades strict dominance back for streakier racing.

## Weekend form ties the two sessions together

`weekendFormShare` (0.5) splits each session's noise into a shared per-car,
per-weekend draw and an independent per-session draw, weighted `sqrt(share)` and
`sqrt(1 − share)` so each session's total sigma is unchanged and the correlation
between the two noise terms equals the share exactly. A driver who has the car under
him on Saturday tends to still have it on Sunday. 0 restores independent sessions; 1
makes the race a deterministic function of qualifying (every race processional), so it
is a bound, not a target.

The share alone cannot make a car's form swing *wider*, only redistribute a fixed
sigma — raising it buys weekend form by taking the same variance out of session luck.
Widening the swing means moving the share and both sigmas together, holding
`sqrt(1 − share) · sigma` roughly constant, which is how the original 0.4/3.0/5.0
became **0.5/3.4/5.6**: about a quarter more weekend-to-weekend form for unchanged
session-to-session scatter. It costs a point of Williams win share and gains one for
Ligier; poles and the retirement rate are unmoved. Note the form draw is per *seat*,
not per team — teammates have independent weekends, so this is "the car came to this
driver" rather than "the team brought an upgrade".

The share is a first guess and never fitted — see `docs/DECISIONS.md`.
