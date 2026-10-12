---
paths:
  - "packages/engine/src/race/powertrain.ts"
  - "packages/engine/src/race/powertrain.test.ts"
  - "packages/data/src/engines.json"
  - "packages/data/src/engines.ts"
---

# The powertrain

How a chassis and its engine become the one car the model races.

- `powertrain()` is the only blend. `carOverall` in `@alt-hist/data` runs through it; never
  weight a chassis and an engine anywhere else, in the UI or a tool.
- **Chassis and car are separate names for a reason.** `ChassisSpec` (authored tub) and
  `CarSpec` (out of `powertrain()`) are structurally identical, so the name is the only
  signal: the season JSON and `RaceEntrant` say `chassis`, everything after the blend
  says `car`.
- An `EngineSpec` has no `consistency`; don't add one.
- `engineId` on `RaceEntrant` is identity the model never reads; `buildField` fills in
  `engine` from the season's engine table, since the engine package reads no seed data.
- **A chassis rating and its engine's are one judgement in two halves**: neither is
  observable alone, so never move one without the other. They are the author's;
  `pnpm fit <year>` proposes them as a pair.
