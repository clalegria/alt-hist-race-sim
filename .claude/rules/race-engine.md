---
paths:
  - "packages/engine/src/race/**"
---

# Race model

`simulateRace` and its modules; each constant's reasoning is its doc comment.

## The RNG stream
- **Append-independence**: adding a car to the end of the field must not change anyone
  else's weekend. Every pass draws a fixed count per car whatever happens: the weather's
  two draws first, wet or dry; a non-qualifier's race noise and both DNF rolls, discarded;
  a team's four draws lazily, at its first car. A new random term draws unconditionally,
  in field order.
- Deterministic terms (home advantage, the powertrain blend, development) draw nothing,
  so a field with and without them leaves the stream identical. Keep new ones that way.

## Derived constants
- The model reads one `RaceConstants` and knows nothing of seasons, settings or weather:
  `withRandomness`, `withRetirementFactor`, `withBreakdowns` and `wetConstants` each bend
  it beforehand into a frozen copy. A new setting follows the same shape: scale where the
  value is defined, never edit `constants.ts` at runtime, never branch in the model.
- **Each returns its input by identity at its neutral setting**, asserted with `toBe`,
  so the constants as written are what an untouched run races. They scale disjoint
  fields or multiply the same one, so order never matters.
- Everything after `powertrain()` and `developedCar()` reads `runner.car`, never
  `entrant.chassis`.

## Noise and consistency
- Consistency costs pace (the penalty) and widens spread. **Don't replace the penalty
  with a spread-only or skewed-noise scheme**: spread is mean-neutral and inverts win
  rates (a wider upper tail hands a slow car wins), and skewing only the bad half fixes
  average finish but cannot fix wins.
- Changing the driver's penalty span must not change what a chassis's consistency is
  worth: every season's chassis ratings assume the car's half as it stands.
- *Team form* (`teamFormShare`, `teamFormBoost`) is to be renamed: *form* belongs to the
  planned driver market (`docs/design/era-advanced.md`).

## The cut
- One `maxStarters` for every era, on purpose: per-era limits, pre-qualifying and
  round-by-round entry lists are not modelled. A DNQ is not a retirement and not a starter.

## Randomness slider (`randomness.ts`)
- **Only `DEFAULT_RANDOMNESS_LEVEL` means anything about the model.** Never argue for a
  constant from a run at any other level; level 2 is merely where the scale is 1.
- Scale both sigmas together or not at all: one alone re-weights form against luck.

## Driver error (`composure.ts`)
- `driverErrorRisk` is the only composure-to-probability mapping; `pnpm fit` calls it.
- Don't raise `composureSpreadGain` because one season looks wrong: a driver-error count
  is noisy at any gain. Making composure visible race by race needs a second channel
  that costs pace, which changes what the rating means: ask the author first.

## Gaps (`gaps.ts`)
- Gaps are decoration, a monotone relabelling of the score. Nothing reads them back;
  never build classification or championship logic on them.
