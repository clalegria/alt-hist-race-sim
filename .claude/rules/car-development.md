---
paths:
  - "packages/engine/src/race/development.ts"
  - "packages/engine/src/season/**"
  - "packages/data/src/seasons/**"
  - "packages/data/src/types.ts"
  - "packages/data/src/buildField.ts"
  - "tools/calibrate/src/phase.ts"
---

# In-season car development

One authored integer per car per season, `developmentTrend`, from `-10` to `+10`, saying
which way its year ran. `+10` starts the season ten rating points below the authored
chassis and ends ten above it; `-10` is the mirror. Absent — which is almost every entry
— is a flat year.

```json
{ "teamId": "williams", "engineId": "ford",
  "chassis": { "racing": 86, "qualifying": 86, "consistency": 84, "reliability": 80 },
  "developmentTrend": 6, "drivers": ["jones", "regazzoni"] }
```

The case it exists for is 1979: Ligier arrived with the quickest car on the grid and had
lost it by July, while Williams arrived nowhere and won five of the last seven. One
chassis rating for either team describes a car that never raced.

## Three properties, all load-bearing

1. **It is a rotation, not a bonus.** The swing is symmetric about the middle of the
   calendar, so the authored chassis is what the car is worth at mid-season and a trend
   adds nothing to the year's *average* pace. That is what makes it an authoring
   statement about **shape**, and it is why the existing ratings did not need re-fitting
   to accept one.
2. **It is not points-neutral, and cannot be.** Points are convex in pace: being ten
   points quick for half a year wins more than being ten points slow for the other half
   loses. So any non-zero trend is worth slightly more championship points than a flat
   car of the same rating. That is the effect being modelled, not an artefact — a season
   with a strong phase in it *is* worth more than unbroken mediocrity — but it means a
   trend is not free, and handing every car one would inflate the whole grid.
3. **Pace only.** `racing` and `qualifying` move; `reliability` and `consistency` do
   not, so retirements are untouched and every season's fitted `retirementFactor` still
   describes the same number of them. A team that solved its reliability over a year is
   a different story, told by the authored rating.

## How it reaches a race

`RoundContext.seasonProgress` — 0 at the opener, 1 at the finale — is the only thing
that says *when* a race is. `simulateSeason` stamps it on from the calendar index and
**writes over anything the caller put there**: the position in the array is the answer,
and a second authored copy would be a second answer.

`development.ts` in the engine owns the arithmetic: `seasonProgress(round, rounds)`,
`developmentSwing(trend, progress, constants)` and `developedCar(car, trend, progress)`,
which `simulateRace` applies to the output of `powertrain()`. `developmentSwingPerPoint`
(1.0) is the whole magnitude lever — at 1 the tag reads directly, and the place to make
development matter more is there, not by inflating every tag. It is deliberately **not**
scaled by the randomness level: a car's arc is a fact about the season, not the dice.

Two things it does not do. It **draws no randomness**, so a trend cannot shift anyone
else's weekend through the RNG stream. And it does **not clamp at 100** — a 98-rated car
with `+10` finishes the year notionally above it, because capping would mute the gain
while leaving the opener's loss at full size, quietly turning a symmetric rotation into a
pace penalty for the best cars.

**A lone race feels nothing.** `simulateRace` with no `seasonProgress` is mid-season,
where every trend is worth exactly zero and the race is scored precisely as it was before
this existed.

## The harnesses

- **`pnpm calibrate` and `pnpm race` are mid-season by default**, and therefore measure
  what they always measured — which is why the tables in `.claude/rules/calibration.md`
  still describe them and why nothing needed re-tuning. `--phase start` / `--phase end`
  opt in to the two ends (`tools/calibrate/src/phase.ts`).
- **`pnpm calibrate-season`, `pnpm season`, `pnpm fit` and `pnpm retirements` all run a
  real calendar**, so development is on throughout. The season harness is the honest
  measure of what a trend is worth; `retirements` is unaffected either way, since
  reliability does not move.
- **The tuner (`pnpm tune`) races fields it builds by hand and carries no trends.** It
  fits ratings at the neutral mid-season point, which is the same point the trend rotates
  about — consistent, but worth knowing before reading a proposal for a car that has one.

## The UI

The team popover on the grid shows it below the chassis and engine panels, as a bar that
fills from the **middle** rather than the left, because zero is a real value here and not
the bottom of a scale.

**It is deliberately not part of `carOverall`.** The headline number says how good a car
is, and a trend rotates its pace about mid-season — so what the overall already reports
*is* the average of the year. Folding a trend in would double-count the rating in one
direction and libel the car in the other. A web test renders the same grid with a trend
on every car and asserts the markup is byte-identical.

## Authoring one

`validateSeedData` requires a whole number in `-10..10`; the field sits after `chassis`
and before `drivers`, which is also where `writeSeason.ts` (the `pnpm fit --write`
substituter) expects not to find it. Authored so far: 1979 Williams `+6` and Ligier `-7`,
2026 McLaren `+4`. **Adding one is an authoring judgement about a real season, not a
tuning knob** — the no-re-calibration invariant in `CLAUDE.md` covers it exactly as it
covers a chassis rating.
