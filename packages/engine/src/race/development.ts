/**
 * In-season car development: the arc a car traces from the opener to the finale.
 *
 * A season's chassis rating is one number for a whole year, which is the one
 * thing a real season never is. Ligier arrived in 1979 with the fastest car on
 * the grid and had lost it by mid-season; Williams arrived slow that same year
 * and finished it winning almost everything. Averaging either into a single
 * rating produces a car that was never on track: too slow in the races it
 * dominated, too quick in the ones it was nowhere.
 *
 * So a car carries an optional **development trend**: one authored integer from
 * `-10` to `+10` saying which way its year ran.
 *
 * - `+10` — starts the season 10 rating points below its authored car and
 *   finishes 10 above it, moving linearly in between.
 * - `-10` — the mirror: 10 above at the opener, 10 below at the finale.
 * - `0`, or no trend at all, is a flat year and changes nothing.
 *
 * Three properties, all deliberate:
 *
 * 1. **It is a rotation, not a bonus.** The swing is symmetric about the middle
 *    of the calendar, so the authored rating is what the car is worth at
 *    mid-season and the trend adds nothing to its *average* pace. That is what
 *    keeps a trend an authoring statement about shape rather than a way to make
 *    a car quietly faster, and it is why the existing ratings do not need
 *    re-tuning to accept one.
 * 2. **It is not points-neutral, and cannot be.** Championship points are a
 *    convex function of pace — being 10 points quick for half a year wins more
 *    than being 10 points slow for the other half loses — so a car with any
 *    non-zero trend scores slightly *more* on average than the same car flat.
 *    That is the real effect being modelled, not an artefact: a season with a
 *    strong phase in it is worth more than a season of unbroken mediocrity.
 * 3. **Pace only.** `racing` and `qualifying` move; `reliability` and
 *    `consistency` do not. Development is about how quick the car is, and a team
 *    that solves its reliability over a year is a different story that the
 *    season's retirement factor and the authored rating already tell.
 *
 * Where the season is, is the round's business — `RoundContext.seasonProgress`,
 * which `simulateSeason` fills in from the calendar. A race simulated with no
 * progress at all is a mid-season race and feels no trend, which is why every
 * single-race caller, harness and test that predates this behaves exactly as it
 * did before.
 *
 * Nothing here draws randomness, so an entrant's trend never disturbs the RNG
 * stream: the same seed produces the same draws with and without one.
 */

import type { CarSpec } from "../model/ratings.js";
import { RACE_CONSTANTS, type RaceConstants } from "./constants.js";

/**
 * The largest trend an author may state, either way. A limit rather than a
 * clamp on the arithmetic below: out-of-range values are an authoring error the
 * seed data rejects by name, not something the race model quietly absorbs.
 */
export const DEVELOPMENT_TREND_LIMIT = 10;

/**
 * The neutral point of the calendar: the moment a car is worth exactly its
 * authored rating, whatever its trend. Also what a race with no known progress
 * is assumed to be.
 */
export const MID_SEASON_PROGRESS = 0.5;

/**
 * How far through the calendar a round sits: 0 at the opener, 1 at the finale.
 *
 * A one-round season is mid-season by definition — there is no arc to be at one
 * end of — so it returns the neutral point and no trend applies. `rounds` at or
 * below zero is treated the same way rather than dividing by it.
 *
 * @param round 0-based position in the calendar.
 */
export function seasonProgress(round: number, rounds: number): number {
  if (rounds <= 1) {
    return MID_SEASON_PROGRESS;
  }
  const clamped = Math.min(Math.max(round, 0), rounds - 1);
  return clamped / (rounds - 1);
}

/**
 * The rating points a car's trend is worth at this point in the season.
 *
 * Linear in progress and symmetric about mid-season: `−trend` at the opener,
 * `0` in the middle, `+trend` at the finale, scaled by
 * `developmentSwingPerPoint`. No trend, or no known progress, is worth nothing.
 *
 * Deliberately unclamped at the far end. A 98-rated car with a `+10` trend
 * finishes the year notionally above 100, and letting it is the lesser evil:
 * capping would mute the gain while leaving the early-season loss at full size,
 * which turns a symmetric rotation into a quiet pace penalty for exactly the
 * cars that need it least. Every score in the race model is linear in the
 * rating, so nothing downstream cares.
 */
export function developmentSwing(
  trend: number | undefined,
  progress: number | undefined,
  constants: RaceConstants = RACE_CONSTANTS,
): number {
  if (trend === undefined || trend === 0) {
    return 0;
  }
  const where = Math.min(Math.max(progress ?? MID_SEASON_PROGRESS, 0), 1);
  return trend * constants.developmentSwingPerPoint * (2 * where - 1);
}

/**
 * A car as it was at this point in its season: the blended car with its trend
 * applied to both pace ratings.
 *
 * Identity when there is no trend or no progress — the same object, not a copy —
 * so a field authored without trends is scored exactly as it was before they
 * existed.
 */
export function developedCar(
  car: CarSpec,
  trend: number | undefined,
  progress: number | undefined,
  constants: RaceConstants = RACE_CONSTANTS,
): CarSpec {
  const swing = developmentSwing(trend, progress, constants);
  if (swing === 0) {
    return car;
  }
  return {
    racing: car.racing + swing,
    qualifying: car.qualifying + swing,
    // Untouched: development is pace. See the note at the top of the file.
    reliability: car.reliability,
    consistency: car.consistency,
  };
}
