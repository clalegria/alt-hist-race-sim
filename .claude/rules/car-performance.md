---
paths:
  - "apps/web/src/components/CarPerformanceSetting.tsx"
  - "apps/web/src/components/EnginePerformanceSetting.tsx"
  - "apps/web/src/components/PerformanceSetting.tsx"
  - "apps/web/src/lib/run-settings.ts"
  - "apps/web/src/lib/seasons.ts"
  - "packages/data/src/chassis.ts"
  - "packages/data/src/engines.ts"
  - "packages/engine/src/rng/index.ts"
---

# Chassis and Engine performance: a run's own cars

The two run settings that roll a run's chassis and engine ratings (`rolledChassisOf`,
`rolledEnginesOf`), and the walk that carries them year to year.

- **Every roll draws on its own stream**, `createRng(deriveSeed(seed, key))` under its
  own key (`CAR_PERFORMANCE_STREAM`, …), never the race stream: Historical draws
  nothing, and turning one on moves no other roll and no race. A new roll gets a new
  key. `deriveSeed` is the start of the substreams `docs/design/era-advanced.md` §2
  proposes.
- **A roll draws the same numbers whatever it moves off**: a walk changes the base,
  never the draw count.
- **The rolls are the year's baseline, not an edit** (`web-store.md`): rolled once in
  `createWorld`, kept on the world, never re-rolled on read, not in the recipe. A
  reader's `chassis` stays absolute ratings over them. `setGrid` keeps the seed and so
  the rolls; every other rebuild draws a new seed and re-rolls.
- **The walk carries what raced** (`racedChassis`, `racedEngineRatings`), the reader's
  chassis edit included: the one way an edit crosses a year. A team or engine new to
  the run moves off its own authored values, unpulled.
- **The pull is towards the season's field average, never the team's real car**, so
  history stays alternate. It draws nothing.
- **A standalone season never walks**: `seasonSettings` turns `"last"` into `"real"`,
  and its screen draws no *Each year starts from* row.
- The notes say what the reader sees, in rating points, never how a roll is drawn.
