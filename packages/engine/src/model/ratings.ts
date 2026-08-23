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
}

/** A team's car for one season. */
export interface CarSpec {
  readonly racing: number;
  readonly qualifying: number;
  readonly consistency: number;
  readonly reliability: number;
}

/**
 * An engine manufacturer's unit for one season.
 *
 * Three ratings, not four: an engine has no consistency of its own. What
 * "consistency" means in this model is how repeatable a car's pace is from lap
 * to lap and session to session, which is a chassis and setup property — an
 * engine either makes its power or breaks, and the second of those is
 * `reliability`.
 *
 * Same 1-100 scale and same polarity as `CarSpec`, because the two are blended
 * into one another: see `powertrain()` in `race/powertrain.ts`.
 */
export interface EngineSpec {
  readonly racing: number;
  readonly qualifying: number;
  readonly reliability: number;
}
