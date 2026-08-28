---
paths:
  - "tools/calibrate/**"
  - "packages/engine/src/**/constants.ts"
  - "packages/data/src/*.json"
---

# Calibration

> **⚠ THESE TABLES ARE STALE.** Every figure below was measured with the powertrain
> blended `0.8 · chassis + 0.2 · engine` on all three attributes. The weights have since
> moved to **`0.7 / 0.3` on pace and an even `0.5 / 0.5` on reliability**, and the
> chassis and engine ratings have **not** been re-fitted. The win and pole shares below
> will have drifted; the retirement rates will have moved most, since reliability's
> blend changed the furthest. A re-tune is needed and **has not been run** — it needs
> the author's word. Do not treat any number here as current, and do not re-measure to
> find out how far off it is.

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

**Every figure below describes `buildField`'s default `peak` mode**, where drivers
race at their authored peaks. The `aged` mode added with the ageing curve produces a
different 1980 — a rookie Prost, a declining Scheckter — and is deliberately **not** calibrated
against anything. Do not "fix" the aged grid to match this table; they are answers to
two different questions.

**They also describe a race with no host country.** `pnpm calibrate` and the tuner both
run `simulateRace` with no `RoundContext`, so all three shares of home advantage —
driver, team and engine — pay nothing in any measured race. That is why adding the
engine's *home-advantage* share needed no re-measurement — which is not true of the
blend weights, and the warning at the top of this file is about those. Rotating the harness through a season's
calendar would fold home advantage into every number here; that is a change to what the
harness measures, and it needs the author's word before anyone runs it.

## The two harnesses

`pnpm calibrate` runs one race N times; **`pnpm calibrate-season` runs a whole season N
times** (`tools/calibrate/src/seasons.ts`) and prints, per driver and per team, how often
they take the title, how often they win a race, how often they score at all, and the
average points they end the year on. It is the instrument for the *midfield*: wins and
poles describe the front of the grid, and a season is where sixth places add up.

**Its numbers are not comparable with the figures below.** Every table here is a race
with no host country; a season runs the year's real calendar, so home advantage pays at
every round that has one. The two win shares are different quantities, and the gap
between them is what home advantage is worth. Neither is the other's check.

It is a reading instrument, not a target set: nothing scores against it, the tuner does
not use it, and the rule above — do not run a harness to check something — covers it
too.

**`pnpm retirements` is the third, and the one exception to that rule** — it has a
measured target for all 77 years and its output *is* meant to be acted on, but only on
the season file's `retirementFactor`, which the author asked to have calibrated.
`.claude/rules/retirement-factor.md` is the write-up.

**It moved 1980 and 1981 to factor 6**, so the retirement figures in the tables below
now describe the *neutral* constants rather than the season the app runs: the two years
really retired 48.5% and 48.3% of their starters against the 41.3% reported here.
Nothing else moved — no rating was touched, the tuner still builds constants from
`RACE_CONSTANTS` rather than `seasonConstants`, and `retirementRate: 0.42` in
`targets.ts` was left alone even though the measurement contradicts it by six and a half
points, because changing it re-fits chassis and engine reliability.

## The engine pass (both seasons, chassis and engines together)

Engine manufacturers made a car `0.8 · chassis + 0.2 · engine`, which changes what a
chassis rating *means* — the case the invariant lists as needing the author's word.
The author gave it, so **1980 and 1981 were re-tuned as one set each**: chassis and
engine ratings fitted together rather than an engine layered onto settled chassis.
**That 0.8 / 0.2 is no longer the blend** — see the warning at the top of this file.
**Driver ratings were held fixed throughout** and remain the author's; see
`docs/DECISIONS.md`.

Two things came out of it worth knowing:

- **The tuner had a stalling bug, now fixed.** Its inner loop accepted an improving
  candidate but then reverted to the *pre-sweep* value when a later candidate failed,
  while keeping the improved score in `best`. State and score disagreed, nothing could
  beat the stale score, and every run stopped after one productive sweep having moved
  almost nothing. It is a proper per-coordinate line search now, and it runs to six
  sweeps (1980) and ten (1981). **The pre-engine calibration was produced under that
  bug**, which is part of why the fit below is better than the one it replaced.
- **The chassis drift band went from 8 to 12.** Holding effective pace steady while the
  engine takes 20% needs the chassis to move 1.25× whatever the engine took out, so the
  old band would have capped the fit below where the previous calibration already sat.
  At the engine's current 30% pace share the same argument asks for ~1.43×, so whoever
  runs the next pass should expect to widen `MAX_DRIFT_CHASSIS` again.

## Status against the real 1980 season (14 races), at 20,000 simulated races

| Team | Model win% | Actual | Model pole% | Actual (approx) |
|---|---|---|---|---|
| Williams | 42.5% | 42.9% | 21.5% | ~21% |
| Brabham | 20.8% | 21.4% | 8.1% | ~7% |
| Renault | 20.7% | 21.4% | 43.1% | ~43% |
| Ligier | 13.6% | 14.3% | 19.6% | ~21% |
| Alfa Romeo | 0.1% | 0% | 7.7% | ~7% |

Retirements 41.3% of the 26 starters, against a 42% target. The 28-entry grid means two
DNQs a weekend and they fall where they should: Shadow 73.7% (Kennedy 98.7% — he failed
to qualify for all seven races he entered in reality), Osella 33.5%, ATS 7.1%, Ensign
4.8%, and nobody above them ever misses.

**Alfa Romeo's pole is now modelled rather than written off.** The previous calibration
listed it as an accepted gap — Giacomelli's real 1980 pole treated as a freak that
would distort the car if forced. The engine split makes it expressible instead: a
qualifying-strong, race-weak, fragile Alfa engine (87 / 67 / 29) in a chassis whose
qualifying rose to 88. That is what the car actually was, and it costs nothing
elsewhere. Splitting one rating into chassis and engine is what bought this.

## Status against the real 1981 season (15 races), at 20,000 simulated races

| Team | Model win% | Actual | Model pole% | Actual |
|---|---|---|---|---|
| Williams | 26.0% | 26.7% | 15.2% | 13.3% |
| Renault | 20.2% | 20.0% | 39.6% | 40.0% |
| Brabham | 20.1% | 20.0% | 28.6% | 26.7% |
| Ferrari | 14.1% | 13.3% | 7.9% | 6.7% |
| Ligier | 12.5% | 13.3% | 7.0% | 6.7% |
| McLaren | 6.4% | 6.7% | 0.9% | 0% |

Retirements 41.3% of the 26 starters. Note the target is **1980's 42%, inherited rather
than observed** — no separate 1981 figure has been established, and `mechanicalDnfEraScale`
still has no per-year curve (`docs/DECISIONS.md`). The 31-entry grid means five DNQs a
weekend: Osella 95.3%, Toleman 86.0%, Ensign 35.7%, ATS 24.2%, March 19.0%, Fittipaldi
11.6%, Theodore 10.4%.

**Known accepted gaps — do not "fix" these.**

- **Arrows takes 0% of 1981 poles against a real 6.7%.** Patrese's Long Beach pole is
  the 1981 equivalent of Giacomelli's 1980 one, and unlike Giacomelli's it has no
  engine story behind it — Arrows ran the same Cosworth as half the grid, so there is
  no rating that gives Arrows a pole without giving nine other cars one too.
- **Reutemann over-wins in 1980** (16.6% against 1 real win). A one-event sample.
- **McLaren's 1981 chassis rose a long way** (racing 80 → 90, qualifying 76 → 88) to
  reach a 6.7% win share off Watson's single Silverstone win — a win that came largely
  from attrition ahead of him, which this model has no pathway to express except pace.
  The most opinionated number in the set: the win share it produces is right, and the
  car it implies is flattering.
- **Three 1981 proposals were rejected as noise-fitting**, not applied: `engine
  hart.qualifying 62 → 77`, `engine hart.reliability 26 → 11`, `chassis
  arrows.qualifying 69 → 57`. Hart powered only Toleman, which contributes to no win or
  pole target and is 2 of 31 cars in the retirement rate; the Arrows move went *away*
  from its one target. Rejecting them cost 0.2 points of retirement rate and nothing else.

## Working here

- Tunable numbers live in one constants module per subsystem, never inline in logic.
  `packages/engine/src/race/constants.ts` is the pattern.
- `simulateRace` and `simulateSeason` both take constants as an optional override,
  which is how the harness sweeps values **without editing source**. Sweeping by
  editing a constants file and reverting is the wrong way round.
- **The tuner moves chassis and engines, and nothing else by default.** Driver ratings
  need `--drivers` and the noise constants need `--noise`, because the failure mode of a
  tuner is quietly rewriting more than you meant. Targets are per year in
  `tools/calibrate/src/targets.ts` under `tunedChassis`, and a year with no targets
  throws rather than borrowing another season's.
- `buildFieldFrom` in the tuner must keep matching `buildField` attribute for attribute,
  or the tuner optimises a model the sim does not run. It builds fields by hand only
  because the whole point is to race ratings that are not in the JSON yet.
- `tools/*` may use dev dependencies (tsx runs the TS directly). The engine may not.
- Driver ratings are un-tuned on purpose — see `docs/DECISIONS.md`.
