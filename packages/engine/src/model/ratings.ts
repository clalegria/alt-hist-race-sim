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
