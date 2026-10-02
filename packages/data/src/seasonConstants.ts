/**
 * The race constants one authored season is run on.
 *
 * Two things bend the constants, and they arrive from opposite
 * directions: the **randomness level** is a taste setting the player chooses
 * before a run, and the **retirement factor** is an authored property of the
 * year itself, sitting in the season file next to its points scale. Composing
 * them belongs in one place rather than at each of the five call sites that run
 * a season — the app, `pnpm season`, `pnpm calibrate-season` and the tests
 * behind them have to agree, and two of them quietly disagreeing about whether
 * a year's attrition applied would be invisible in the output.
 *
 * The order does not matter — the two scale disjoint constants, noise sigmas
 * against retirement risks — but stating it once means nobody has to check.
 *
 * This is a `@alt-hist/data` function rather than an engine one because it
 * reads a `SeasonSeed`, and the engine reads no seed data. It is the same seam
 * `buildField` is: authored data in, engine inputs out.
 */

import {
  DEFAULT_RANDOMNESS_LEVEL,
  parseRetirementFactor,
  RACE_CONSTANTS,
  type RaceConstants,
  type RandomnessLevel,
  withRandomness,
  withRetirementFactor,
} from "@alt-hist/engine";
import type { SeasonSeed } from "./types.js";

/**
 * The constants for a season at a randomness level.
 *
 * A season authored at the neutral factor of 5 and run at
 * `UNSCALED_RANDOMNESS_LEVEL` gets `RACE_CONSTANTS` itself, by identity — both
 * helpers return their input unchanged at their neutral setting, and composing
 * them must not lose that. It is the cheap path and the guarantee: no arithmetic
 * between `constants.ts` and the season that runs.
 *
 * **That is not the default level.** `DEFAULT_RANDOMNESS_LEVEL` is `Realistic`,
 * which scales both sigmas, so an unconfigured season is a little quieter than
 * the constants as written. The identity above is a statement about the
 * composition, not about where the slider rests.
 *
 * `parseRetirementFactor` narrows rather than trusting: the JSON's field is
 * typed `number`, and a season whose factor is out of range is caught by
 * `validateSeedData` rather than here.
 *
 * `base` is for a caller racing constants that are not in `constants.ts` yet —
 * the tuner's `--noise` candidates — so they are bent by the season exactly as
 * the written ones would be, rather than composed by hand at the call site.
 */
export function seasonConstants(
  season: SeasonSeed,
  randomness: RandomnessLevel = DEFAULT_RANDOMNESS_LEVEL,
  base: RaceConstants = RACE_CONSTANTS,
): RaceConstants {
  return withRetirementFactor(
    parseRetirementFactor(season.retirementFactor),
    withRandomness(randomness, base),
  );
}
