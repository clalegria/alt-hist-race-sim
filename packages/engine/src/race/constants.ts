/**
 * Every tunable number in the race model, in one place.
 *
 * These are calibration targets, not truths. They are meant to be swept by
 * `tools/calibrate` and adjusted from the resulting distributions — never
 * guessed at the call site. No literal magic numbers belong in the race logic.
 *
 * Scores are kept on the same 0-100 scale as the ratings that feed them, so a
 * constant expressed in "points" is directly comparable to a rating difference.
 */

export interface RaceConstants {
  /**
   * How much the car versus the driver decides pace. Each pair sums to 1, which
   * keeps scores on the 0-100 rating scale.
   *
   * The car is weighted heavily on purpose: a great driver in a poor car should
   * be a points-scorer, not a winner. Qualifying leans slightly further toward
   * the car than the race does, because a single flying lap gives the driver
   * less room to express racecraft or tyre management.
   */
  readonly weightCarQualifying: number;
  readonly weightDriverQualifying: number;
  readonly weightCarRacing: number;
  readonly weightDriverRacing: number;

  /**
   * Consistency is blended 50/50: a fragile chassis and an erratic driver both
   * widen the spread, and neither obviously dominates the other.
   */
  readonly weightCarConsistency: number;
  readonly weightDriverConsistency: number;

  /** Standard deviation of qualifying noise, in rating points, before modulation. */
  readonly qualifyingNoise: number;
  /** Standard deviation of race noise, in rating points, before modulation. */
  readonly racingNoise: number;

  /**
   * Consistency scales the noise. A combined consistency of 0 multiplies the
   * spread by `consistencyNoiseMultiplierAtZero`; 100 multiplies it by
   * `consistencyNoiseMultiplierAtHundred`. Interpolated linearly between.
   */
  readonly consistencyNoiseMultiplierAtZero: number;
  readonly consistencyNoiseMultiplierAtHundred: number;

  /**
   * Track position, in rating points added to the race score. The advantage
   * decays exponentially down the grid: the gap from P1 to P2 is worth far more
   * than P15 to P16, especially in an era where overtaking was hard.
   */
  readonly gridAdvantagePole: number;
  /** Places over which the grid advantage decays by a factor of e. */
  readonly gridAdvantageDecayPlaces: number;

  /**
   * Mechanical failure probability, interpolated from a car's reliability
   * rating: a 0-rated car fails with probability `mechanicalDnfAtZeroReliability`,
   * a 100-rated one with `mechanicalDnfAtFullReliability`.
   */
  readonly mechanicalDnfAtZeroReliability: number;
  readonly mechanicalDnfAtFullReliability: number;

  /**
   * Driver-error retirement probability, interpolated from composure the same
   * way. This is what makes a fast but wild driver expensive to run.
   */
  readonly driverErrorDnfAtZeroComposure: number;
  readonly driverErrorDnfAtFullComposure: number;

  /**
   * Era multiplier on mechanical failure, applied after the reliability
   * interpolation and clamped into [0, 1].
   *
   * 1.0 is 1980, when roughly half a field could fail to see the flag. Rising
   * reliability *ratings* alone do not capture the shift — a 95-rated car still
   * fails far too often under period-accurate endpoints — so the mapping itself
   * has to tighten as the sport matures. Later seasons pass a smaller value
   * through the constants override.
   *
   * The per-season curve is deliberately not defined here: it belongs to the
   * progression model, and picking it is an open decision.
   */
  readonly mechanicalDnfEraScale: number;
}

/**
 * Default constants, calibrated for the 1980 season.
 *
 * Race pace weighting puts the 1980 top five inside a ~3.2 point band against a
 * race noise sigma of ~3.2-4.7 after consistency modulation, so they trade wins
 * rather than one car running away with every race.
 */
export const RACE_CONSTANTS: RaceConstants = Object.freeze({
  weightCarQualifying: 0.72,
  weightDriverQualifying: 0.28,
  weightCarRacing: 0.7,
  weightDriverRacing: 0.3,

  weightCarConsistency: 0.5,
  weightDriverConsistency: 0.5,

  qualifyingNoise: 3.0,
  racingNoise: 5.0,

  consistencyNoiseMultiplierAtZero: 1.6,
  consistencyNoiseMultiplierAtHundred: 0.5,

  gridAdvantagePole: 3.0,
  gridAdvantageDecayPlaces: 6.0,

  mechanicalDnfAtZeroReliability: 0.75,
  mechanicalDnfAtFullReliability: 0.12,

  driverErrorDnfAtZeroComposure: 0.3,
  driverErrorDnfAtFullComposure: 0.03,

  mechanicalDnfEraScale: 1.0,
});
