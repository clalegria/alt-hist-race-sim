/**
 * Composure to a driver-error retirement risk.
 *
 * One line across the rating scale, anchored by `driverErrorDnfAtZeroComposure`
 * and `driverErrorDnfAtFullComposure` — and then rotated about
 * `composureSpreadPivot` by `composureSpreadGain`, which is the part that needs
 * explaining.
 *
 * The two anchors describe the whole 0-100 scale, but a field never occupies it:
 * composure on a real grid sits in a band some forty points wide whose mean has
 * been close to the pivot in every era the seed data covers. Read straight off
 * the anchors, that band spans only a fraction of the line, so the distance
 * between a calm driver and a wild one comes out far smaller than the anchors
 * imply — most of the line is spent on composure nobody is authored with. The
 * gain buys that distance back by steepening the slope while holding the risk at
 * the pivot fixed, which is why it changes the spread inside a field without
 * much changing how many cars that field retires. A gain of 1 is the identity.
 *
 * **The rating axis is deliberately unclamped.** Clamping it into 0-100 would
 * flatten every driver past the point the clamp bites, and at any gain above 1
 * that point is inside the composed end of a real grid — exactly the end this
 * exists to separate. So the line runs on, and only the probability is clamped,
 * which is also what keeps a steep gain from producing a negative risk.
 *
 * Both anchors are scaled elsewhere before they arrive — by the season's
 * `retirementFactor` and by the weather — and the gain composes with both by
 * construction, since it acts on the rating axis and they act on the probability
 * one.
 */

import type { RaceConstants } from "./constants.js";

/**
 * The chance this driver ends their race in the barrier, in [0, 1].
 *
 * Pure arithmetic on a rating and the constants: no randomness, so a harness or
 * the fitter can ask what a driver's risk *is* without running a race. That is
 * why it is exported — `tools/calibrate` needs the same answer the model uses,
 * and a second copy of this formula would be a second answer.
 */
export function driverErrorRisk(composure: number, constants: RaceConstants): number {
  const pivot = constants.composureSpreadPivot;
  const gain = Math.max(constants.composureSpreadGain, 0);
  // Rotated about the pivot, not shifted: a driver n points clear of it is
  // priced as though they were n * gain clear of it.
  const spread = pivot + (composure - pivot) * gain;
  const risk =
    constants.driverErrorDnfAtZeroComposure +
    (constants.driverErrorDnfAtFullComposure - constants.driverErrorDnfAtZeroComposure) *
      (spread / 100);
  return Math.min(Math.max(risk, 0), 1);
}
