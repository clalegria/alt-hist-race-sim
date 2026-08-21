/**
 * A single headline number per driver and per car.
 *
 * This is a **display heuristic, not model truth**. Nothing in the engine reads
 * it and no result depends on it — it exists so a grid page can be scanned at a
 * glance instead of five bars at a time. The weights below are chosen to
 * approximate how much each rating actually moves results in the current race
 * model, so the number is honest about the sim it describes; if the model's
 * weights change, these should be revisited.
 *
 * Kept out of the engine on purpose. The engine is the authority on what a
 * rating *does*; collapsing five of them into one is an editorial act, and the
 * engine should not be making editorial claims about its own inputs.
 *
 * It sits in `@alt-hist/data` rather than in the web app because two consumers
 * need the same number — the grid page and the progression tool — and a second
 * copy of these weights would be a second answer to "how good is this driver".
 * `apps/web/src/lib/rating.ts` re-exports it, so the app still reads as though
 * it owns its own display heuristic.
 */

import type { CarSpec, DriverRatings } from "@alt-hist/engine";

/**
 * Driver weights.
 *
 * Racing dominates because it is the only rating that feeds the race score
 * directly. Qualifying earns its share through grid position, which is worth up
 * to three points of race pace at pole. Composure is next: it sets the
 * driver-error retirement rate, and in 1980 a retirement costs a whole race.
 * Consistency is real but small — the pace penalty spans roughly 1.8 points
 * across the entire grid.
 *
 * Adaptability is zero because nothing reads it. Giving it weight would make the
 * overall claim a driver is better for something the sim never asks of them.
 * When the transfer market lands, this is the first number to revisit.
 */
const DRIVER_WEIGHTS: Readonly<Record<keyof DriverRatings, number>> = {
  racing: 0.5,
  qualifying: 0.25,
  composure: 0.15,
  consistency: 0.1,
  adaptability: 0,
};

/**
 * Car weights.
 *
 * Reliability carries a quarter of the number, which looks high next to the race
 * model — where it touches no score at all — and is not. Roughly 42% of the 1980
 * field failed to finish, so a fragile car forfeits points it had the pace to
 * take. Renault is the case in point: quickest car on the grid, fourth in the
 * championship.
 */
const CAR_WEIGHTS: Readonly<Record<keyof CarSpec, number>> = {
  racing: 0.45,
  qualifying: 0.2,
  reliability: 0.25,
  consistency: 0.1,
};

function weighted<T>(ratings: T, weights: Readonly<Record<keyof T, number>>): number {
  let total = 0;
  for (const key of Object.keys(weights) as (keyof T)[]) {
    total += Number(ratings[key]) * weights[key];
  }
  // Rounded, because a grid listing showing 89.05 implies a precision the
  // authored ratings do not have.
  return Math.round(total);
}

export function driverOverall(ratings: DriverRatings): number {
  return weighted(ratings, DRIVER_WEIGHTS);
}

export function carOverall(car: CarSpec): number {
  return weighted(car, CAR_WEIGHTS);
}
