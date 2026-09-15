/**
 * Whether it rained, how hard, and what that does to a race.
 *
 * Three jobs, one module, because they are one idea:
 *
 * 1. `rollWeather` decides a round's weather from the seeded stream.
 * 2. `wetConstants` derives the constants that round is raced on — the same
 *    "scale factor over the constants, never an edit to them" pattern
 *    `withRandomness` and `withRetirementFactor` already follow, and it
 *    composes with both by construction.
 * 3. `wetDriver` derives the ratings a driver races it on, which is the one
 *    part that cannot be expressed as a constant because it is per entrant.
 *
 * A dry race returns its inputs *by identity* from both derivations, which is
 * the same guarantee level 2 of the randomness slider makes: 85% of rounds are
 * scored by precisely the constants as written, with no arithmetic
 * between it and them.
 */

import type { DriverRatings } from "../model/ratings.js";
import type { RaceConstants } from "../race/constants.js";
import type { Rng } from "../rng/types.js";
import { WEATHER_CONSTANTS, type WeatherConstants } from "./constants.js";

/**
 * What the sky did on one afternoon.
 *
 * Part of the result rather than only an input: a classification that does not
 * say the race was wet is a classification that cannot be read, and every
 * screen showing a round reads this off the result rather than re-rolling
 * anything.
 */
export interface RaceWeather {
  /** Whether the round was declared wet at all. */
  readonly wet: boolean;
  /**
   * How wet, from 0 to 1 — a damp patch at the bottom of the range, a race run
   * behind the safety car at the top. Exactly 0 on a dry round, and never below
   * `wetnessFloor` on a wet one.
   *
   * The UI shows it as a percentage, which is the honest reading: it is not
   * millimetres of rain, it is how far this race moved toward being decided by
   * the conditions rather than by the cars.
   */
  readonly wetness: number;
}

/** A dry afternoon. Shared, frozen, and what every dry round returns. */
export const DRY: RaceWeather = Object.freeze({ wet: false, wetness: 0 });

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

/** Linear interpolation from 1 to `atFull` across a 0-1 wetness. */
function scaleAt(wetness: number, atFull: number): number {
  return 1 + (atFull - 1) * wetness;
}

/**
 * Rolls one round's weather.
 *
 * **Always draws exactly two values**, wet or dry, for the same reason every
 * other pass in the race model draws a fixed count per car: a stream position
 * that depended on the outcome would make a seed's later rounds depend on
 * whether an earlier one rained.
 *
 * `chance` overrides the base probability for this round only — absent, the
 * constants decide. That is the seam a circuit's own climate will arrive
 * through; nothing authored uses it yet.
 */
export function rollWeather(
  rng: Rng,
  constants: WeatherConstants = WEATHER_CONSTANTS,
  chance?: number,
): RaceWeather {
  const probability = clamp(chance ?? constants.wetRaceProbability, 0, 1);
  const declared = rng.next();
  const depth = rng.next();
  if (declared >= probability) {
    return DRY;
  }
  // Skewed toward the floor: most wet races are a shower, not a monsoon.
  const span = Math.max(constants.wetnessCeiling - constants.wetnessFloor, 0);
  const skew = Math.max(constants.wetnessSkew, 0);
  const wetness = clamp(constants.wetnessFloor + span * depth ** skew, 0, 1);
  return { wet: true, wetness };
}

/**
 * The constants a round of this weather is raced on.
 *
 * Four things move, all of them in proportion to how wet it is:
 *
 * - both noise sigmas, multiplied — the field reorders;
 * - both retirement risks, driver error much the harder;
 * - the car/driver split of both session scores, toward the driver;
 * - the chassis/engine split of a car's pace, toward the chassis.
 *
 * Every pair that summed to 1 before still sums to 1, so scores stay on the
 * 0-100 rating scale. The weights are shifted rather than replaced, and the
 * shift is capped by what there is to give, so a large one cannot invert a
 * weight.
 *
 * A dry round gets `constants` back by identity.
 */
export function wetConstants(
  weather: RaceWeather,
  constants: RaceConstants,
  weatherConstants: WeatherConstants = WEATHER_CONSTANTS,
): RaceConstants {
  if (!weather.wet || weather.wetness <= 0) {
    return constants;
  }
  const wetness = clamp(weather.wetness, 0, 1);
  const noise = scaleAt(wetness, weatherConstants.noiseScaleAtFullWetness);
  const driverShift = clamp(
    weatherConstants.driverWeightShiftAtFullWetness * wetness,
    0,
    Math.min(constants.weightCarQualifying, constants.weightCarRacing),
  );
  const chassisShift = clamp(
    weatherConstants.chassisWeightShiftAtFullWetness * wetness,
    0,
    constants.weightEnginePerformance,
  );

  return Object.freeze({
    ...constants,
    weightCarQualifying: constants.weightCarQualifying - driverShift,
    weightDriverQualifying: constants.weightDriverQualifying + driverShift,
    weightCarRacing: constants.weightCarRacing - driverShift,
    weightDriverRacing: constants.weightDriverRacing + driverShift,

    weightChassisPerformance: constants.weightChassisPerformance + chassisShift,
    weightEnginePerformance: constants.weightEnginePerformance - chassisShift,

    qualifyingNoise: constants.qualifyingNoise * noise,
    racingNoise: constants.racingNoise * noise,

    // Scaled where the risks are *defined* rather than where they are rolled,
    // exactly as the retirement factor does it — so the race model needs no
    // knowledge that weather exists, and the two compose as plain multipliers.
    mechanicalDnfEraScale:
      constants.mechanicalDnfEraScale *
      scaleAt(wetness, weatherConstants.mechanicalScaleAtFullWetness),
    driverErrorDnfAtZeroComposure:
      constants.driverErrorDnfAtZeroComposure *
      scaleAt(wetness, weatherConstants.driverErrorScaleAtFullWetness),
    driverErrorDnfAtFullComposure:
      constants.driverErrorDnfAtFullComposure *
      scaleAt(wetness, weatherConstants.driverErrorScaleAtFullWetness),
  });
}

/**
 * The ratings a driver races this weather on.
 *
 * `racing` and `qualifying` are blended toward `wetWeather` by
 * `abilityShareAtFullWetness · wetness`, and `composure` toward it by a smaller
 * share, so the wet rating decides part of the pace *and* part of who keeps it
 * out of the barrier. Nothing else moves: consistency is about a car and a
 * driver repeating themselves, which the rain does not change, and adaptability
 * is still read by nothing.
 *
 * A driver whose wet rating matches their dry one comes back unchanged at every
 * wetness, which is the majority of the pool by design — this term exists for
 * the exceptions.
 *
 * A dry round gets `driver` back by identity.
 */
export function wetDriver(
  driver: DriverRatings,
  weather: RaceWeather,
  weatherConstants: WeatherConstants = WEATHER_CONSTANTS,
): DriverRatings {
  if (!weather.wet || weather.wetness <= 0) {
    return driver;
  }
  const wetness = clamp(weather.wetness, 0, 1);
  const paceShare = clamp(weatherConstants.abilityShareAtFullWetness * wetness, 0, 1);
  const composureShare = clamp(weatherConstants.composureShareAtFullWetness * wetness, 0, 1);
  const toward = (rating: number, share: number): number =>
    rating + (driver.wetWeather - rating) * share;

  return {
    ...driver,
    racing: toward(driver.racing, paceShare),
    qualifying: toward(driver.qualifying, paceShare),
    composure: toward(driver.composure, composureShare),
  };
}
