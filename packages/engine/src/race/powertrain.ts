/**
 * Chassis plus engine, as one car.
 *
 * A team's authored `ChassisSpec` describes the tub it built; the `EngineSpec`
 * describes the unit in the back of it. What the race model actually scores is
 * the two blended into a `CarSpec`, on `racing`, `qualifying` and
 * `reliability`. Consistency comes through untouched — an engine has none of
 * its own.
 *
 * The blend is not one ratio but two. Pace is mostly the car a team built, so
 * `racing` and `qualifying` lean on the chassis; reliability is split evenly,
 * because an engine ends as many races as the chassis around it does. Both
 * pairs live in `constants.ts` and both sum to 1.
 *
 * This lives in the engine package, and is exported, because it is the *model's*
 * answer to "what is this car worth", and the grid page needs the same number.
 * A second copy of the blend in the UI would be a second answer, and the one the
 * reader is shown would be the one nothing races on.
 *
 * Pure, total, and identity when there is no engine: a field built without
 * engines is scored exactly as its chassis was before they existed, which is
 * what keeps every pre-engine field and test meaningful.
 */

import type { CarSpec, ChassisSpec, EngineSpec } from "../model/ratings.js";
import { RACE_CONSTANTS, type RaceConstants } from "./constants.js";

export function powertrain(
  chassis: ChassisSpec,
  engine?: EngineSpec,
  constants: RaceConstants = RACE_CONSTANTS,
): CarSpec {
  if (engine === undefined) {
    return chassis;
  }
  const pace = (tub: number, unit: number): number =>
    constants.weightChassisPerformance * tub + constants.weightEnginePerformance * unit;

  return {
    racing: pace(chassis.racing, engine.racing),
    qualifying: pace(chassis.qualifying, engine.qualifying),
    reliability:
      constants.weightChassisReliability * chassis.reliability +
      constants.weightEngineReliability * engine.reliability,
    // The chassis alone. Blending in a number the engine does not have would
    // mean inventing one, and every engine would then have the same one.
    consistency: chassis.consistency,
  };
}
