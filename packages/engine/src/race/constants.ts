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
   * Consistency's spread lever, applied to both sessions: a combined
   * consistency of 0 multiplies the noise by `consistencyNoiseMultiplierAtZero`,
   * 100 by `consistencyNoiseMultiplierAtHundred`, interpolated linearly.
   *
   * Deliberately flat (both 1.0) as of the pace-penalty model. Any gap between
   * these two numbers hands a low-consistency car a taller upper tail, and a
   * taller upper tail means *more* wins for a car that has no business winning
   * - a win is an upper-tail event, so nothing applied to the mean can fully
   * offset it. Consistency therefore expresses itself purely through
   * `consistencyPacePenalty*` below, which shifts the whole distribution and so
   * makes an erratic pairing worse on every measure at once.
   *
   * Kept as a lever rather than deleted: reopening the gap is how you would
   * trade strict dominance back for streakier, more upset-prone racing.
   */
  readonly consistencyNoiseMultiplierAtZero: number;
  readonly consistencyNoiseMultiplierAtHundred: number;

  /**
   * Pace lost to inconsistency, in rating points, subtracted from both the
   * qualifying and the race score. Interpolated from combined consistency: 0
   * costs `consistencyPacePenaltyAtZero`, 100 costs
   * `consistencyPacePenaltyAtHundred`.
   *
   * This is what makes consistency a genuine handicap rather than a lottery
   * ticket. Because it moves the mean and leaves the spread alone, a less
   * consistent pairing is strictly worse off: fewer wins, fewer poles, worse
   * average finish, and no compensating upside anywhere. A uniform shift across
   * the whole field would be invisible - only the differences between cars
   * matter - so what these endpoints really set is the spread of penalties
   * across the grid.
   */
  readonly consistencyPacePenaltyAtZero: number;
  readonly consistencyPacePenaltyAtHundred: number;

  /**
   * How much of each session's noise is shared "weekend form" rather than
   * session-specific luck, as a share of variance in [0, 1].
   *
   * A driver who has found something in the car on Saturday tends to still have
   * it on Sunday, so the two sessions should not be independent coin flips. One
   * standard-normal form draw per car per weekend is reused by both sessions,
   * weighted `sqrt(share)`, with an independent draw per session weighted
   * `sqrt(1 - share)`. That leaves each session's total sigma exactly as
   * `qualifyingNoise` / `racingNoise` specify, and makes the correlation between
   * the two noise terms equal to this value.
   *
   * 0 restores fully independent sessions. 1 makes the race a deterministic
   * function of qualifying - every race processional - so it is a bound to stay
   * well clear of, not a target.
   */
  readonly weekendFormShare: number;

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
 * race noise sigma of 5.0, so they trade wins rather than one car running away
 * with every race.
 *
 * Combined consistency across the 1980 grid runs roughly 46-90, so the penalty
 * endpoints at 0 and 100 are extrapolation anchors rather than values anyone
 * actually sits on. Over that real range they cost between ~2.2 and ~0.4 points,
 * a ~1.8 point spread - worth about six driver rating points at the 0.3 race
 * weighting, and enough to separate a metronome from a wildcard without
 * swamping the car.
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

  consistencyNoiseMultiplierAtZero: 1.0,
  consistencyNoiseMultiplierAtHundred: 1.0,

  consistencyPacePenaltyAtZero: 4.0,
  consistencyPacePenaltyAtHundred: 0.0,

  weekendFormShare: 0.4,

  gridAdvantagePole: 3.0,
  gridAdvantageDecayPlaces: 6.0,

  mechanicalDnfAtZeroReliability: 0.75,
  mechanicalDnfAtFullReliability: 0.12,

  driverErrorDnfAtZeroComposure: 0.3,
  driverErrorDnfAtFullComposure: 0.03,

  mechanicalDnfEraScale: 1.0,
});
