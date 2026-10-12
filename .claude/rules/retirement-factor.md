---
paths:
  - "packages/engine/src/race/retirement.ts"
  - "packages/engine/src/race/breakdowns.ts"
  - "packages/data/src/seasonConstants.ts"
  - "packages/data/src/seasons/**"
  - "tools/calibrate/src/retirements.ts"
  - "tools/calibrate/src/realRetirements.ts"
---

# Retirement factor

A season's authored 1–10 `retirementFactor`, and the run settings that bend it.

- **`seasonConstants` in `@alt-hist/data` is the one place** a season's factor, the
  randomness level and the run settings are composed. Every runner of a season (the app
  store, every harness that takes a year) goes through it; never compose `with*` helpers
  by hand at a call site. A caller racing unwritten constants (the tuner's `--noise`)
  passes them as `base`.
- The authored reliability ratings carry little of the era; the factor does that work.
  **Don't "fix" it by re-authoring reliability ratings**: that needs the author's word.
- Driver error is scaled by the factor too, but never by the Mechanical failures or
  *Cars as reliable as* settings: composure is a driver rating.
- **A DNQ is neither a retirement nor a starter**, in the engine and in the real record:
  the rate is `retirements / (retirements + classifiedCount)`. Count anything new that way.
- `pnpm retirements` is one of two harnesses whose output is acted on, and only for this
  number. Nothing it prints is a reason to move a chassis, engine or driver rating.
- **Adding a season means authoring its factor**: start at 5, run
  `pnpm retirements --sweep --year <n>`, take the best. `validateSeedData` rejects
  anything but a whole 1–10.
