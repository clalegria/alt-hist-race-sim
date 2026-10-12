---
paths:
  - "packages/engine/src/race/home.ts"
  - "packages/engine/src/race/home.test.ts"
  - "apps/web/src/lib/home.ts"
  - "apps/web/src/components/HomeAdvantage.tsx"
  - "apps/web/src/components/home.test.tsx"
---

# Home advantage

One rule with two readers: the race model pays the bonus, the sheets star the cars it paid.

- **Anything asking who is at home calls the engine's `homeAllegiances`**, on the entrant
  as it was raced; never compare country codes yourself. A second spelling would mark
  different cars from the ones the race paid.
- The ordering driver > team > engine supplier is the claim, and a test asserts it.
- The three countries ride on `RaceEntrant`, set by `buildField` from the driver's
  `nationality`, the team's `base` and the engine manufacturer's. A field built
  without them races everywhere as a visitor.
- A test counting `<svg>` on a race or qualifying screen must count the stars too,
  derived from the field and calendar, never a written number (`App.test.tsx`).
