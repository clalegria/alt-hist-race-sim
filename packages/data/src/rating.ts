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

import {
  type CarSpec,
  type ChassisSpec,
  type DriverRatings,
  type EngineSpec,
  powertrain,
} from "@alt-hist/engine";

/**
 * Driver weights.
 *
 * **Racing dominates, and by more than it used to.** It is the only rating that
 * feeds the race score directly, and the race score is the whole result — the
 * earlier 0.5 understated it badly next to what the model actually does with a
 * rating point. Everything else was toned down to pay for the rise to 0.6.
 *
 * Qualifying earns its share through grid position, which is worth up to three
 * points of race pace at pole. Composure sets the driver-error retirement rate,
 * and a retirement costs a whole race. Consistency is real but small — the pace
 * penalty spans roughly 1.8 points across the entire grid.
 *
 * Wet weather is the newest and the smallest of the four that count. It is not
 * small because it does not matter — in a wet race it carries three quarters of
 * the driver's pace — but because only about one race in seven is wet, and an
 * overall is an average over a season. 0.05 is roughly "the wet share of a
 * year, weighted by how much of a wet race it decides", which is the honest
 * reading of a number that is otherwise invisible for six rounds out of seven.
 *
 * Adaptability is still zero because nothing reads it. Giving it weight would
 * make the overall claim a driver is better for something the sim never asks of
 * them. When the transfer market lands, this is the first number to revisit.
 */
const DRIVER_WEIGHTS: Readonly<Record<keyof DriverRatings, number>> = {
  racing: 0.6,
  qualifying: 0.18,
  composure: 0.1,
  consistency: 0.07,
  wetWeather: 0.05,
  adaptability: 0,
};

/**
 * Car weights.
 *
 * Applied to the *blended* car — chassis and engine as `powertrain()` leaves
 * them — never to a bare chassis, so the headline number describes the thing
 * that races.
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

/**
 * How good a car is: a chassis with the engine folded into it.
 *
 * The engine is folded in through the model's own `powertrain()` rather than
 * given weights of its own here, so the headline number on the grid page is a
 * summary of the car that will actually be raced — not of the chassis drawing
 * the wrong conclusions about the package. That matters more now that the two
 * blend unevenly: a strong chassis behind a fragile engine loses half its
 * reliability to the swap but only a third of its pace, and only the blend
 * shows it. Omit the engine and this is the bare chassis.
 */
export function carOverall(chassis: ChassisSpec, engine?: EngineSpec): number {
  return weighted(powertrain(chassis, engine), CAR_WEIGHTS);
}
