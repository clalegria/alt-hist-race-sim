---
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
---

# Tests

Authored numbers and seed outcomes both move; a test must survive either.

- **Assert the rule against synthetic ratings**, never an authored rating or a comparison
  of two. Naming a driver or team as an identity is fine; what they are worth is not.
- **A fixed seed is a fine fixture; asserting its outcome is not.** When a test needs a
  season of a particular shape, search for one (`web-testing.md`).
- **Derive counts** (`field.length`, `season.calendar.length`); never hard-code them.
- **Favour property-style checks**: finish order is a valid permutation, nobody finishes
  twice, DNFs remove cars.
- **Mutation-check statistical tests**: break the implementation on purpose, confirm the
  test fails, revert.
