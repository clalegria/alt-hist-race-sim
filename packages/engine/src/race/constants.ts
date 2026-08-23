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
   * How much of a car's performance is the chassis and how much is the engine
   * bolted into the back of it. Sums to 1, so blending the two leaves the
   * result on the same 0-100 scale as either input.
   *
   * The engine's share is deliberately small. A season's authored car rating is
   * a judgement about the whole package as it raced, so most of what an engine
   * contributed is already inside it; this weight is the part that moves when a
   * team changes supplier. Small also keeps the blend honest across a grid where
   * one engine is shared by ten teams — the 1980 Cosworth DFV ran in cars rated
   * from 42 to 91, and a larger share would drag all of them toward one number.
   *
   * Applied to `racing`, `qualifying` and `reliability`. Consistency is left to
   * the chassis alone: an engine has none of its own (see `EngineSpec`).
   *
   * An entrant with no engine is scored on its chassis alone, exactly as every
   * field was before engines existed — these weights are not consulted at all.
   */
  readonly weightChassis: number;
  readonly weightEngine: number;

  /**
   * Consistency is blended 50/50: a fragile chassis and an erratic driver both
   * widen the spread, and neither obviously dominates the other.
   */
  readonly weightCarConsistency: number;
  readonly weightDriverConsistency: number;

  /**
   * Standard deviation of qualifying noise, in rating points, before
   * modulation. `weekendFormShare` splits it: `sqrt(share)` of it is the car's
   * form for the whole weekend and `sqrt(1 - share)` is luck on the day, so
   * raising this sigma and the share together moves weekend-to-weekend form
   * without touching session-to-session scatter.
   */
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
   *
   * This is the only lever that is *about* weekend-to-weekend form rather than
   * randomness in general, but on its own it only redistributes a fixed sigma:
   * raising it alone buys form by taking the same amount out of session luck.
   * To make a car's level actually swing more between weekends, raise this and
   * the two sigmas together, holding `sqrt(1 - share) * sigma` roughly constant
   * - which is how 0.4/3.0/5.0 became 0.5/3.4/5.6, about a quarter more form
   * for unchanged session scatter.
   */
  readonly weekendFormShare: number;

  /**
   * How many cars the race itself takes. Everyone entered runs qualifying; only
   * the fastest `maxStarters` take the start, and anyone slower is classified
   * DNQ and does not appear in the results.
   *
   * 26 is the 1980 limit, which is why fields were routinely over-subscribed and
   * pre-qualifying existed. A field at or under the limit is unaffected, so this
   * is inert for small or modern grids rather than something to switch off.
   */
  readonly maxStarters: number;

  /**
   * Track position, in rating points added to the race score. The advantage
   * decays exponentially down the grid: the gap from P1 to P2 is worth far more
   * than P15 to P16, especially in an era where overtaking was hard.
   */
  readonly gridAdvantagePole: number;
  /** Places over which the grid advantage decays by a factor of e. */
  readonly gridAdvantageDecayPlaces: number;

  /**
   * Home advantage, in rating points added to *both* session scores when a
   * round is held in the driver's own country and when it is held in the
   * team's. They stack: an Italian in a Ferrari at Monza collects both.
   *
   * Small on purpose. A home race is worth a tenth or two on a good day —
   * crowd, familiarity, a team that slept in its own beds — not a car upgrade,
   * and the driver's share is the larger of the two because it is the driver
   * the crowd is shouting for. Set either to 0 to switch that half off.
   *
   * Nearly a whole grid can share a country (most of the 1980 field was
   * British), and a bonus everyone gets is invisible — only differences between
   * cars move a result — so what these really price is the *visitor's*
   * disadvantage at a round where the paddock is at home.
   */
  readonly homeAdvantageDriver: number;
  readonly homeAdvantageTeam: number;
  /**
   * The engine's share of the same thing, when the round is held where the unit
   * was built. Smallest of the three, and deliberately so: a supplier is the
   * most distant of an entry's three allegiances — it brought engineers and a
   * truck, not a factory that slept in its own beds — and it is the one a crowd
   * is least likely to be shouting for.
   *
   * It stacks with the other two, so a French driver in a French car with a
   * French engine collects all three at Paul Ricard. That is the *ceiling*, and
   * it is the number to look at when weighing these: 1.75 rating points, well
   * under half the spread the consistency penalty covers.
   *
   * Worth even less in practice than it looks, for the reason the other two are:
   * a bonus most of the field shares is invisible. Ten of the fifteen 1980
   * entries ran a Cosworth, so at Brands Hatch this pays almost everyone.
   */
  readonly homeAdvantageEngine: number;

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
   * Seconds per rating point of qualifying deficit. Purely cosmetic: it turns
   * an abstract score gap into a readable "+0.213s" and changes nothing about
   * the order, which is already fixed by the scores themselves.
   *
   * Linear, because a real qualifying sheet is roughly linear and nobody gets
   * lapped on a flying lap. Across the 1980 grid the pole-to-last score gap
   * averages ~50 points, so this puts the back of the field ~7.5s off pole.
   */
  readonly qualifyingGapSecondsPerPoint: number;

  /**
   * Race gaps, as `raceGapSecondsAtOnePoint * deficit ** raceGapExponent`
   * seconds behind the winner. Also purely cosmetic.
   *
   * The exponent is the point of this: a single seconds-per-point factor cannot
   * be right at both ends, because the winner-to-second score gap runs ~3 points
   * while winner-to-last runs ~45. Linear either bunches the whole field within
   * a few seconds or puts the runner-up a minute back. An exponent above 1 keeps
   * the lead battle tight in seconds while the tail stretches out into whole
   * laps, which is what a race classification actually looks like. At 1.0 the
   * map is linear again.
   *
   * `raceGapSecondsAtOnePoint` is the gap at a one-point deficit, which is where
   * the curve is anchored — not a per-point rate, since the exponent means there
   * isn't one.
   */
  readonly raceGapSecondsAtOnePoint: number;
  readonly raceGapExponent: number;

  /**
   * Lap length in seconds, used only to convert a large cosmetic race gap into
   * "+1 lap", "+2 laps". One nominal value stands in for every circuit: the sim
   * has no calendar and no track data, and gaps are decoration, not physics.
   */
  readonly nominalLapSeconds: number;

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
 * race noise sigma of 5.6, so they trade wins rather than one car running away
 * with every race.
 *
 * Half of that sigma's variance is weekend form and half is session luck, which
 * puts ~4.0 points of swing on a car's level for the weekend. Measured over
 * 20,000 races the change from the earlier 0.4/3.0/5.0 costs about a point of
 * Williams win share (43.4% to 42.1%, against a 42.9% target) and gains about
 * the same for Ligier (15.1% to 16.2%, against 14.3%); poles and the 41.1%
 * retirement rate are unmoved.
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

  weightChassis: 0.8,
  weightEngine: 0.2,

  weightCarConsistency: 0.5,
  weightDriverConsistency: 0.5,

  qualifyingNoise: 3.4,
  racingNoise: 5.6,

  consistencyNoiseMultiplierAtZero: 1.0,
  consistencyNoiseMultiplierAtHundred: 1.0,

  consistencyPacePenaltyAtZero: 4.0,
  consistencyPacePenaltyAtHundred: 0.0,

  weekendFormShare: 0.5,

  maxStarters: 26,

  gridAdvantagePole: 3.0,
  gridAdvantageDecayPlaces: 6.0,

  homeAdvantageDriver: 1.0,
  homeAdvantageTeam: 0.5,
  homeAdvantageEngine: 0.25,

  mechanicalDnfAtZeroReliability: 0.75,
  mechanicalDnfAtFullReliability: 0.12,

  driverErrorDnfAtZeroComposure: 0.3,
  driverErrorDnfAtFullComposure: 0.03,

  qualifyingGapSecondsPerPoint: 0.15,

  raceGapSecondsAtOnePoint: 0.9,
  raceGapExponent: 1.5,
  nominalLapSeconds: 90,

  mechanicalDnfEraScale: 1.0,
});
