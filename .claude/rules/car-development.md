---
paths:
  - "packages/engine/src/race/development.ts"
  - "packages/data/src/seasons/**"
  - "packages/data/src/types.ts"
  - "packages/data/src/buildField.ts"
  - "tools/calibrate/src/phase.ts"
  - "packages/data/src/development.ts"
  - "apps/web/src/components/DevelopmentSetting.tsx"
---

# In-season car development

A car's authored `developmentTrend`, −10..+10: its pace rotated about mid-season.

- **Where it lives**: the arithmetic in the engine's `race/development.ts`; *when* a race
  is comes only from `RoundContext.seasonProgress`, which `simulateSeason` stamps on; the
  run setting's layer over the seed in `packages/data/src/development.ts`; and `trendsOf`
  in `apps/web/src/lib/run-settings.ts`, the one place the setting reaches the cars. The
  result is `World.baselineTrends`, rebuilt from the seed, never recorded.
- **Random** draws on its own `DEVELOPMENT_STREAM`, so no other roll or race moves.
- **A trend is never free**: points are convex in pace, so any non-zero trend scores
  slightly more than the same car flat. Handing every car one inflates the grid. Under
  Random every car has one: an effect of the what-if, not something to correct.
- **Authoring one** is a judgement about a real season, not a tuning knob: the tuning
  invariant in `CLAUDE.md` covers it like a chassis rating. Whole numbers only
  (`validateSeedData`); the key sits after `chassis` and before `drivers`.
