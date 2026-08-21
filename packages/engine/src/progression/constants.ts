/**
 * Every tunable number in the ageing curve, in one place.
 *
 * The curve is **deterministic**: same career in, same ratings out, no PRNG
 * anywhere. Two drivers with identical authored careers age identically, and a
 * driver ages the same way in every seed. That is a deliberate simplification —
 * per-run scatter on the realized peak is a later decision, and the
 * realize-once-and-store invariant exists for the day it lands.
 *
 * Deficits are fractions of the peak rating: 0.20 means "20% below peak". They
 * are accumulated into three buckets — development, decline and form — because
 * each bucket hits the five attributes differently (see the sensitivity tables).
 */

import type { DriverRatings } from "../model/index.js";

/** Per-attribute multipliers on a deficit. 1.0 = the attribute tracks it exactly. */
export type AttributeSensitivity = Readonly<Record<keyof DriverRatings, number>>;

export interface AgeingConstants {
  /**
   * How far below peak a driver debuts, per season of runway between their
   * debut and the start of their plateau, capped by `maxRookieDeficit`.
   * A driver who debuts the year their plateau starts is already there.
   */
  readonly deficitPerDevelopmentSeason: number;
  readonly maxRookieDeficit: number;

  /**
   * `developmentSpeed` 1–10 maps linearly onto this exponent range, applied to
   * progress through the development years. A *high* speed gives a *low*
   * exponent: a concave curve that climbs steeply out of the rookie season and
   * flattens into the plateau — the early bloomer. A low speed gives a convex
   * curve: years of little progress, then a late surge.
   */
  readonly developmentExponentAtSpeedOne: number;
  readonly developmentExponentAtSpeedTen: number;

  /**
   * How far below 100% the edges of the plateau sit. A driver is only truly at
   * peak for one season; the rest of the plateau is "very close", which is what
   * this number means. Quadratic across the window, so the seasons either side
   * of the peak are barely off it.
   */
  readonly plateauEdgeDeficit: number;

  /**
   * Decline is `declineBaseRate · (declineSpeed / nominalDeclineSpeed) ·
   * years^declineExponent`, measured from the end of the plateau. The exponent
   * is above 1 so decline accelerates: the first season past peak costs little,
   * the fifth costs a lot.
   */
  readonly declineBaseRate: number;
  readonly declineExponent: number;
  readonly nominalDeclineSpeed: number;

  /** An extra one-off deficit in the debut season itself. */
  readonly rookieSeasonPenalty: number;

  /** Full-severity magnitudes for the two authored career events. */
  readonly steepDeclineMaxDrop: number;
  readonly offSeasonMaxDrop: number;

  /**
   * Young drivers are fast but wild; old drivers are wise but slow. That is the
   * whole point of splitting the deficit into buckets.
   *
   * In development, raw pace arrives first — a rookie is nearly as quick over
   * one lap as he will ever be — while consistency and composure are the last
   * things to come, so they carry the largest share of the deficit.
   */
  readonly developmentSensitivity: AttributeSensitivity;
  /**
   * In decline it inverts. Reflexes and one-lap pace go first; the judgement
   * built over a career barely erodes, so consistency and composure are nearly
   * immune. This is what makes a 40-year-old a different driver rather than
   * simply a worse one.
   */
  readonly declineSensitivity: AttributeSensitivity;

  /** Ratings are clamped into this range after the deficit is applied. */
  readonly minRating: number;
  readonly maxRating: number;
}

export const AGEING_CONSTANTS: AgeingConstants = {
  deficitPerDevelopmentSeason: 0.055,
  maxRookieDeficit: 0.34,

  developmentExponentAtSpeedOne: 1.9,
  developmentExponentAtSpeedTen: 0.55,

  plateauEdgeDeficit: 0.03,

  declineBaseRate: 0.035,
  declineExponent: 1.25,
  nominalDeclineSpeed: 5,

  rookieSeasonPenalty: 0.06,

  steepDeclineMaxDrop: 0.3,
  offSeasonMaxDrop: 0.12,

  developmentSensitivity: {
    racing: 0.9,
    qualifying: 0.7,
    consistency: 1.25,
    adaptability: 0.85,
    composure: 1.35,
  },
  declineSensitivity: {
    racing: 1.0,
    qualifying: 1.3,
    consistency: 0.55,
    adaptability: 1.15,
    composure: 0.5,
  },

  minRating: 1,
  maxRating: 100,
};
