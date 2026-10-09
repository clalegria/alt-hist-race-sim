---
paths:
  - "packages/engine/src/race/development.ts"
  - "packages/engine/src/season/**"
  - "packages/data/src/seasons/**"
  - "packages/data/src/types.ts"
  - "packages/data/src/buildField.ts"
  - "tools/calibrate/src/phase.ts"
  - "packages/data/src/development.ts"
  - "apps/web/src/components/DevelopmentSetting.tsx"
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
   not, so retirements are untouched and every season's `retirementFactor` still
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

- **Every harness but `pnpm race` runs a real calendar**, so development is on
  throughout — `pnpm calibrate` and the tuner cycle through its rounds
  (`tools/calibrate/src/calendar.ts`). `retirements` is unaffected either way, since
  reliability does not move.
- **`pnpm race` is mid-season by default**, where a trend is worth exactly zero.
  `--phase start` / `--phase end` opt in to the two ends (`tools/calibrate/src/phase.ts`).

## The UI

The team popover on the grid shows it below the chassis and engine panels, as a bar that
fills from the **middle** rather than the left, because zero is a real value here and not
the bottom of a scale.

**It is deliberately not part of `carOverall`.** The headline number says how good a car
is, and a trend rotates its pace about mid-season — so what the overall already reports
*is* the average of the year. Folding a trend in would double-count the rating in one
direction and libel the car in the other. A web test renders the same grid with a trend
on every car and asserts the markup is byte-identical.

## In the run

*In-season development* is a run setting on both screens: *Historical* / *Random* /
*Off*, `RunSettings.development` null / `"random"` / `"none"`. `trendsOf` in
`lib/run-settings.ts` is the one place it reaches the cars: Off is `flatTrends` (every
car flat), Random is `randomTrends` (`packages/data/src/development.ts`), a whole number
per car uniform in ±`DEVELOPMENT_TREND_LIMIT`, drawn on its own `DEVELOPMENT_STREAM` so
no other roll or race moves. `withTrends` writes them into the season; the result is
`World.baselineTrends`, the year's baseline like `baselineChassis` (`car-performance.md`),
rebuilt from the seed rather than recorded. Under Random every car has a trend, so the
whole grid gets property 2's small points gain: an effect of the what-if, not a tuning.

## Authoring one

`validateSeedData` requires a whole number in `-10..10`; the field sits after `chassis`
and before `drivers`, which is also where `writeSeason.ts` (the `pnpm fit --write`
substituter) expects not to find it. **Adding one is an authoring judgement about a real season, not a
tuning knob** — the tuning invariant in `CLAUDE.md` covers it exactly as it covers a
chassis rating.
