---
paths:
  - "packages/engine/src/race/powertrain.ts"
  - "packages/engine/src/race/powertrain.test.ts"
  - "packages/data/src/engines.json"
  - "packages/data/src/engines.ts"
---

# The powertrain — blending a chassis with its engine

What the race model does with the car that comes out of this is
`.claude/rules/race-engine.md`; the fitter that proposes the two halves as a pair is
`.claude/rules/calibration.md`.

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

**A chassis rating and its engine's rating are one judgement in two halves.** Neither
is separately observable — what a season records is the package — so moving one without
the other says something about the car nobody knows to be true. They belong to the
author, together; `pnpm fit <year>` proposes them as a pair for exactly that reason.

