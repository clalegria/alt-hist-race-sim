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
 * **Racing carries nearly two thirds, because that is what the model does with
 * it.** A racing point goes into the race score at `weightCarRacing` (0.62) and
 * the race score is the finishing order; nothing else on this list comes close.
 * The earlier split let the other three outvote it — a fragile quick car and a
 * durable slow one landed on the same overall, when only one of them wins
 * races.
 *
 * Qualifying is worth about a third of racing, not a quarter of the number.
 * Its rating points buy grid position, and grid position is only worth up to
 * `gridAdvantagePole` (3.0 points) at the front, decaying down the order — real,
 * and an order of magnitude smaller than pace itself.
 *
 * Reliability is the one that used to be overweight. It touches no score at
 * all: it decides whether the car finishes. A ten-point gain buys roughly six
 * per cent more finishes, where ten points of racing is six points of race pace
 * — the difference between a midfielder and a winner. It keeps a real share
 * because ~42% of the 1980 field failed to finish and a retirement forfeits a
 * whole race, but it is a points-over-a-season term, not a wins term, and 0.25
 * priced it as though it were both.
 *
 * Consistency is the smallest by a distance. It costs pace through the
 * `consistencyPacePenalty` spread — under two points across the entire grid —
 * and what it buys back in a narrower spread is upside a slower car actually
 * wants. It is a texture rating, not a performance one.
 */
const CAR_WEIGHTS: Readonly<Record<keyof CarSpec, number>> = {
  racing: 0.62,
  qualifying: 0.19,
  reliability: 0.14,
  consistency: 0.05,
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
