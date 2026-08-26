/**
 * Every tunable number in the ageing curve, in one place.
 *
 * The curve is **deterministic**: same career in, same ratings out, no PRNG
 * anywhere. Two drivers with identical authored careers age identically, and a
 * driver ages the same way in every seed. That is a deliberate simplification —
 * per-run scatter on the realized peak is a later decision, and the
 * realize-once-and-store invariant exists for the day it lands.
 *
 * The model has two halves, and the split is the point:
 *
 * - **`CANONICAL_ABILITY` owns the shape.** One population curve — what a career
 *   looks like for the average driver — as ability against age. It says how much
 *   a year off peak costs, and nothing a driver is authored with can change that.
 * - **The rates below own the placement.** `developmentSpeed` and `declineSpeed`
 *   warp the *age axis* only: they say when a driver reaches the plateau and how
 *   quickly they run off the end of it, never how steep the fall is once they do.
 *
 * A driver who peaks at 30 with a plateau as wide as the canonical one and both
 * traits at 5 is warped by the identity — they *are* the canonical curve.
 * Everything else is that curve read faster or slower.
 *
 * **`peakSeasons` is a literal count and is not a lever here.** Author 7 and the
 * driver holds a seven-season plateau; nothing in this file scales it. An
 * earlier version made it a nudge against a nominal width, which turned an
 * authored 7 into 17 seasons and stretched the curve's flat top across all of
 * them. Do not reintroduce a mapping between what is authored and what is used.
 *
 * Deficits are fractions of the peak rating: 0.20 means "20% below peak". They
 * are accumulated into three buckets — development, decline and form — because
 * each bucket hits the five attributes differently (see the sensitivity tables).
 */

import type { DriverRatings } from "../model/index.js";

/** Per-attribute multipliers on a deficit. 1.0 = the attribute tracks it exactly. */
export type AttributeSensitivity = Readonly<Record<keyof DriverRatings, number>>;

/** One point on the population curve: an age, and ability as a fraction of peak. */
export interface AbilityAnchor {
  readonly age: number;
  readonly ability: number;
}

/**
 * The population ability curve: what an average driving career looks like.
 *
 * Read as fractions of the driver's own peak, against **canonical** age — the
 * age the warp maps a real age onto, not the age on the driver's licence. Points
 * are joined by straight lines and held flat beyond both ends, which is what
 * stops a swept table bottoming out at the rating floor.
 *
 * The shape is authored, not fitted, and it encodes four claims:
 *
 * - Improvement peaks in the mid-teens and eases from there into the plateau,
 *   ramping *in* below it rather than starting at its steepest: a 16-year-old
 *   gains eight points a year, an 18-year-old five, a 24-year-old under three.
 * - 28 to 33 is genuinely flat. A driver is at their best for years, not for a
 *   season, and the plateau either side of that is within a few percent.
 * - 35 to 42 is a *gentle* slope: nine percent over seven years. This is the
 *   number that most shapes how the sim feels, because it decides whether a
 *   35-year-old champion is finished or merely no longer favourite.
 * - Past the plateau no segment is gentler than the one before it, all the way
 *   to the end of the table: the fall runs from one point a year at 35 to seven
 *   at 53, so decline accelerates without needing an exponent anywhere.
 *
 *   **The table reaches its floor at its last anchor rather than easing onto
 *   one, and it has to.** A fall that keeps steepening must cross zero, so a
 *   tail that lands softly on a floor has to decelerate on the way in — which
 *   is exactly what an earlier version did between 47 and 55. Ending at 0.1 at
 *   55 and letting `canonicalAbility` hold flat past it buys the property back.
 *   Anyone beyond canonical 55 sits at the floor, which for the fastest
 *   decliners is real age 42 and up; they are long retired by any measure the
 *   sim has. Do not re-add an anchor past 55 without re-deriving the whole tail.
 */
export const CANONICAL_ABILITY: readonly AbilityAnchor[] = [
  { age: 8, ability: 0.1 },
  { age: 12, ability: 0.3 },
  { age: 15, ability: 0.505 },
  { age: 17, ability: 0.665 },
  { age: 19, ability: 0.765 },
  { age: 21, ability: 0.84 },
  { age: 23, ability: 0.905 },
  { age: 25, ability: 0.96 },
  { age: 27, ability: 0.992 },
  { age: 28, ability: 1.0 },
  { age: 30, ability: 1.0 },
  { age: 32, ability: 0.995 },
  { age: 33, ability: 0.99 },
  { age: 35, ability: 0.97 },
  { age: 37, ability: 0.95 },
  { age: 39, ability: 0.9 },
  { age: 41, ability: 0.85 },
  { age: 43, ability: 0.8 },
  { age: 45, ability: 0.7 },
  { age: 47, ability: 0.6 },
  { age: 49, ability: 0.49 },
  { age: 51, ability: 0.37 },
  { age: 53, ability: 0.24 },
  { age: 55, ability: 0.1 },
];

/**
 * The three canonical ages the warp pins a driver's own career to.
 *
 * Every driver's authored plateau, however many seasons it is, is stretched or
 * squeezed onto `plateauStart`–`plateauEnd`, with the peak season landing on
 * `peak`. That is what keeps `peakSeasons` a literal count.
 *
 * **Both plateau ends want to sit where the curve is already within a percent of
 * peak**, and 27–34 is chosen for exactly that: an authored plateau should read
 * back as a plateau. Widening this interval towards the curve's real shoulders
 * makes every authored plateau report shorter than it was written, because its
 * outermost seasons land on ability the reader would not call a peak. It also
 * widens the step into the peak season for a driver with no season authored
 * before it — `peakSeasons` 1 or 2 — which is a third of the pool.
 */
export interface CanonicalAges {
  /** Where the plateau opens. Must sit on the rising side of the curve. */
  readonly plateauStart: number;
  /** The single canonical age at which ability is exactly 1.0. */
  readonly peak: number;
  /** Where the plateau closes and decline begins. */
  readonly plateauEnd: number;
}

export interface AgeingConstants {
  /** The population curve. `CANONICAL_ABILITY` unless a caller substitutes one. */
  readonly canonicalAbility: readonly AbilityAnchor[];
  readonly canonical: CanonicalAges;

  /**
   * How many canonical years one real year covers on the rising side, by
   * `developmentSpeed`. **Below 1 is the fast developer**: three real years short
   * of his plateau read as one and a half canonical years short, so he is nearly
   * there already. Above 1 is the slow burner, whose real years buy less.
   *
   * This is why the rates are on the age axis and not the value axis — a fast
   * developer does not climb a different curve, he climbs the same one sooner.
   */
  readonly riseRateAtSpeedOne: number;
  readonly riseRateAtSpeedFive: number;
  readonly riseRateAtSpeedTen: number;

  /**
   * The same idea past the plateau, by `declineSpeed`, and the reason a driver
   * can still be worth a seat at 45. At 0.35 a real decade past the plateau is
   * three and a half canonical years — Fangio, Alonso. At 2.5 it is twenty-five,
   * and the driver is gone inside five seasons.
   */
  readonly declineRateAtSpeedOne: number;
  readonly declineRateAtSpeedFive: number;
  readonly declineRateAtSpeedTen: number;

  /**
   * Being new to the sport, as distinct from being young.
   *
   * Age and experience are separate axes because the data authors them
   * separately: a 28-year-old rookie is on the plateau of the ability curve and
   * still does not know the job, and a 21-year-old in his fourth season does.
   * The full penalty lands in the debut season — and in every season before it,
   * so the curve never rewards a driver for not having started yet — then fades
   * linearly over the adaptation seasons.
   *
   * Both halves are scaled by `developmentSpeed`, which is the whole complaint
   * the split answers: it is the trait that means "learns fast", so it has to
   * reach the rookie season itself, not merely the shape of the years after it.
   * At speed 10 the relief leaves 15% of the penalty and it is gone by season
   * two; at speed 1 it lands in full and takes five seasons to clear.
   */
  readonly rookieSeasonPenalty: number;
  readonly rookieReliefAtSpeedTen: number;
  readonly adaptationSeasonsAtSpeedOne: number;
  readonly adaptationSeasonsAtSpeedFive: number;
  readonly adaptationSeasonsAtSpeedTen: number;

  /** Full-severity magnitudes for the two authored career events. */
  readonly stepDownMaxDrop: number;
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
   * In decline it inverts. One-lap pace goes first — `qualifying` carries the
   * heaviest multiplier — while the judgement built over a career barely erodes,
   * which is `composure` alone at 0.75. Racing, consistency and adaptability
   * track the deficit as it is. This is what makes a 40-year-old a different
   * driver rather than simply a worse one.
   */
  readonly declineSensitivity: AttributeSensitivity;

  /** Ratings are clamped into this range after the deficit is applied. */
  readonly minRating: number;
  readonly maxRating: number;
}

export const AGEING_CONSTANTS: AgeingConstants = {
  canonicalAbility: CANONICAL_ABILITY,
  canonical: { plateauStart: 27, peak: 30, plateauEnd: 34 },

  riseRateAtSpeedOne: 1.9,
  riseRateAtSpeedFive: 1.0,
  riseRateAtSpeedTen: 0.5,

  declineRateAtSpeedOne: 0.35,
  declineRateAtSpeedFive: 1.0,
  declineRateAtSpeedTen: 2.5,

  rookieSeasonPenalty: 0.16,
  rookieReliefAtSpeedTen: 0.85,
  adaptationSeasonsAtSpeedOne: 5,
  adaptationSeasonsAtSpeedFive: 3,
  adaptationSeasonsAtSpeedTen: 1,

  stepDownMaxDrop: 0.3,
  offSeasonMaxDrop: 0.12,

  developmentSensitivity: {
    racing: 0.9,
    qualifying: 0.7,
    consistency: 1.25,
    adaptability: 1.0,
    composure: 1.25,
  },
  declineSensitivity: {
    racing: 1.0,
    qualifying: 1.3,
    consistency: 1.0,
    adaptability: 1.0,
    composure: 0.75,
  },

  minRating: 1,
  maxRating: 100,
};
