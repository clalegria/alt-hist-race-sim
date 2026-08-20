/**
 * Cosmetic gap rendering.
 *
 * The race model has no time dimension: `qualifyingScore` and `raceScore` are
 * abstract pace numbers on the rating scale, and the only thing the simulation
 * does with them is sort. These helpers turn a score deficit into seconds so a
 * classification reads like one. They are a presentation transform — monotone in
 * the deficit, and therefore incapable of contradicting the finishing order or
 * of adding any information to it.
 *
 * Both are pure functions of a score difference and the constants, so the UI can
 * re-derive a gap from stored results without re-running anything.
 */

import type { RaceConstants } from "./constants.js";
import type { RaceGap } from "./types.js";

/** Seconds behind pole. Linear in the deficit; pole itself is 0. */
export function qualifyingGapSeconds(
  poleScore: number,
  score: number,
  constants: RaceConstants,
): number {
  const deficit = Math.max(0, poleScore - score);
  return deficit * constants.qualifyingGapSecondsPerPoint;
}

/**
 * Seconds behind the winner, or whole laps once the deficit passes one lap.
 *
 * The winner is `{ kind: "time", seconds: 0 }` rather than a special case, so
 * callers can format every classified car the same way.
 */
export function raceGap(winnerScore: number, score: number, constants: RaceConstants): RaceGap {
  const deficit = Math.max(0, winnerScore - score);
  const seconds = constants.raceGapSecondsAtOnePoint * deficit ** constants.raceGapExponent;

  // A zero or negative lap length would make every gap infinitely many laps
  // down; clamp so a mistuned constant degrades to "everyone on the lead lap".
  const lapSeconds = Math.max(constants.nominalLapSeconds, Number.EPSILON);
  const lapsDown = Math.floor(seconds / lapSeconds);

  return lapsDown > 0 ? { kind: "laps", laps: lapsDown } : { kind: "time", seconds };
}
