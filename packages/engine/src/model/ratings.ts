/**
 * Rating types shared across the simulation.
 *
 * All ratings run 1-100 and share polarity: higher is always better. That
 * includes `composure` — low composure means crash-prone.
 */

/** A driver's current ability. Distinct from their immutable identity. */
export interface DriverRatings {
  readonly racing: number;
  readonly qualifying: number;
  readonly consistency: number;
  /** How well a driver adjusts to a new car or team. Unused by the v1 race model. */
  readonly adaptability: number;
  /** Resistance to mistakes under pressure. Low composure = crash-prone. */
  readonly composure: number;
  /**
   * How good a driver is when the track is wet.
   *
   * A rating in its own right rather than a modifier on the others, because it
   * is the one attribute the sport routinely finds *uncorrelated* with dry
   * pace: Senna and Schumacher were better in the rain than anywhere else, and
   * plenty of quick drivers were visibly worse. Most of the pool is authored
   * close to `racing` — the correlation is real and high — and the exceptions
   * are the point of the field existing.
   *
   * Read only when a round is wet, and then in proportion to how wet: it
   * displaces part of `racing` and `qualifying` in the score and part of
   * `composure` in the driver-error roll. A dry race never consults it. See
   * `weather/wet.ts`.
   */
  readonly wetWeather: number;
}

/**
 * A team's *chassis* for one season — the tub they built, with nothing in the
 * back of it. This is the authored rating: what `packages/data` stores per
 * entry, and what a reader edits.
 *
 * It is not what the race model scores. Blend it with an `EngineSpec` through
 * `powertrain()` and you get a `CarSpec`, which is.
 */
export interface ChassisSpec {
  readonly racing: number;
  readonly qualifying: number;
  readonly consistency: number;
  readonly reliability: number;
}

/**
 * A whole car for one season: a chassis with an engine in it, as scored.
 *
 * Structurally a `ChassisSpec` — same four ratings, same 1-100 scale — because
 * blending does not add or remove any. The separate name is the point: it marks
 * the values that have been through `powertrain()` from the authored ones that
 * have not, so a reader can tell at the type whether they are looking at what a
 * team built or at what it races. A chassis with no engine is its own car.
 */
export type CarSpec = ChassisSpec;

/**
 * An engine manufacturer's unit for one season.
 *
 * Three ratings, not four: an engine has no consistency of its own. What
 * "consistency" means in this model is how repeatable a car's pace is from lap
 * to lap and session to session, which is a chassis and setup property — an
 * engine either makes its power or breaks, and the second of those is
 * `reliability`.
 *
 * Same 1-100 scale and same polarity as `ChassisSpec`, because the two are
 * blended into one another: see `powertrain()` in `race/powertrain.ts`.
 */
export interface EngineSpec {
  readonly racing: number;
  readonly qualifying: number;
  readonly reliability: number;
}
