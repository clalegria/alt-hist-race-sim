/**
 * Chassis plus engine, as one car.
 *
 * A team's authored `CarSpec` describes the chassis it built; the `EngineSpec`
 * describes the unit in the back of it. What the race model actually scores is
 * the two blended, `weightChassis` of one and `weightEngine` of the other, on
 * `racing`, `qualifying` and `reliability`. Consistency comes through untouched
 * — an engine has none of its own.
 *
 * This lives in the engine package, and is exported, because it is the *model's*
 * answer to "what is this car worth", and the grid page needs the same number.
 * A second copy of the blend in the UI would be a second answer, and the one the
 * reader is shown would be the one nothing races on.
 *
 * Pure, total, and identity when there is no engine: a field built without
 * engines is scored exactly as it was before they existed, which is what keeps
 * every pre-engine field and test meaningful.
 */

import type { CarSpec, EngineSpec } from "../model/ratings.js";
import { RACE_CONSTANTS, type RaceConstants } from "./constants.js";

export function powertrain(
  car: CarSpec,
  engine?: EngineSpec,
  constants: RaceConstants = RACE_CONSTANTS,
): CarSpec {
  if (engine === undefined) {
    return car;
  }
  const blend = (chassis: number, unit: number): number =>
    constants.weightChassis * chassis + constants.weightEngine * unit;

  return {
    racing: blend(car.racing, engine.racing),
    qualifying: blend(car.qualifying, engine.qualifying),
    reliability: blend(car.reliability, engine.reliability),
    // The chassis alone. Blending in a number the engine does not have would
    // mean inventing one, and every engine would then have the same one.
    consistency: car.consistency,
  };
}
