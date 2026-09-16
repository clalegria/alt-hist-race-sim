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
 * **Racing is most of the number, because it is most of the result.** It is the
 * only driver rating the race score reads directly, and the race score *is* the
 * finishing order; everything else on this list reaches a result through some
 * narrower channel. Anything much below 0.7 lets the supporting four speak over
 * it — which is how a driver who is plainly quicker than the man beside him
 * ends up with the lower headline number.
 *
 * Qualifying reaches the result only through grid position, and grid position
 * is worth at most `gridAdvantagePole` (3.0 points of race pace) at the very
 * front, decaying down the order. That is a real effect and a small one: it was
 * priced here as though a qualifying point were a third of a racing point, when
 * the channel it travels through is an order of magnitude narrower than that.
 *
 * Composure sets the driver-error retirement rate, and a retirement forfeits a
 * whole race. Its true worth swings hard with the era — see the note on
 * reliability below, which has the same problem in a sharper form — so like
 * reliability it sits a little under what the high-attrition seasons alone
 * would ask for.
 *
 * Consistency is real but small: the pace penalty spans roughly 1.8 points
 * across the entire grid.
 *
 * Wet weather is the smallest of the five that count. Not because it does not
 * matter — in a wet race it carries three quarters of the driver's pace — but
 * because only about one race in seven is wet, and an overall is an average
 * over a season.
 *
 * Adaptability is still zero because nothing reads it. Giving it weight would
 * make the overall claim a driver is better for something the sim never asks of
 * them. When the transfer market lands, this is the first number to revisit.
 */
const DRIVER_WEIGHTS: Readonly<Record<keyof DriverRatings, number>> = {
  racing: 0.7,
  qualifying: 0.1,
  composure: 0.09,
  consistency: 0.06,
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
 * **Racing is three quarters of the number, because pace is what a car is.** A
 * racing point goes into the race score at `weightCarRacing` and the race score
 * is the finishing order; nothing else on this list reaches a result so
 * directly. The supporting three must not be able to outvote it — a quick,
 * fragile car and a slow, durable one are not the same car, and a reader
 * scanning the grid is asking which one is quick.
 *
 * Qualifying reaches the result only through grid position, worth at most
 * `gridAdvantagePole` at the very front and decaying down the order. Real, and
 * far narrower a channel than pace itself. It used to carry a fifth of the
 * number, which priced a qualifying point at nearly a third of a racing point.
 *
 * **Reliability is the hard one, and this weight is a compromise the eras
 * cannot agree on.** It touches no score at all: it decides whether the car
 * finishes. What that is worth depends entirely on how often cars break, and
 * that is exactly what each season's `retirementFactor` sets — so a reliability
 * point is worth several times more in 1966 than in 2019, while this formula is
 * the same for both. One weight has to serve a run where roughly half the field
 * once failed to see the flag and one where almost nobody does.
 *
 * It sits below the middle of that range on purpose, for two reasons. The first
 * is what the number is for: a grid page is read as "how quick is this car", and
 * a car that breaks is still a quick car. The second is where the error shows.
 * In a high-attrition season results are scattered anyway, so a car ranked a
 * place or two off reads as ordinary bad luck; in a low-attrition season results
 * track pace closely, and the same error is glaring — a durable midfielder
 * outranking a quick one that plainly beat it all year. Under-pricing
 * reliability is therefore the cheaper mistake, and this is deliberately that
 * mistake: in the attrition eras reliability is worth rather more than 0.11, and
 * the overall knowingly does not say so.
 *
 * Consistency is the smallest by a distance. It costs pace through the
 * `consistencyPacePenalty` spread — under two points across the entire grid —
 * and what it buys back in a narrower spread is upside a slower car actually
 * wants. It is a texture rating, not a performance one.
 */
const CAR_WEIGHTS: Readonly<Record<keyof CarSpec, number>> = {
  racing: 0.76,
  qualifying: 0.1,
  reliability: 0.11,
  consistency: 0.03,
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
