/**
 * Which way each car's year runs, as a run would have it.
 *
 * The *In-season development* run setting's layer over a season seed, beside
 * `chassis.ts`: a `SeasonTrends` is each team's `developmentTrend` for one
 * season, and `withTrends(season, trends)` hands back a `SeasonSeed` that
 * `buildField` consumes unchanged. **Random** draws every car one
 * (`randomTrends`); **Off** flattens every car (`flatTrends`). What a trend
 * does to a race is the engine's `development.ts`.
 */

import { DEVELOPMENT_TREND_LIMIT, type Rng } from "@alt-hist/engine";
import type { SeasonSeed } from "./types.js";

/** A `developmentTrend` per team id: the same keys as the season's entries. */
export type SeasonTrends = Readonly<Record<string, number>>;

/**
 * Every car a whole-number trend drawn uniformly from the whole range the seed
 * data may author, ±`DEVELOPMENT_TREND_LIMIT`. Draws one number per team, in
 * entry order.
 */
export function randomTrends(season: SeasonSeed, rng: Rng): SeasonTrends {
  const trends: Record<string, number> = {};
  for (const entry of season.entries) {
    trends[entry.teamId] = rng.nextInt(-DEVELOPMENT_TREND_LIMIT, DEVELOPMENT_TREND_LIMIT + 1);
  }
  return trends;
}

/** Every car a flat year: no trend at all. Draws nothing. */
export function flatTrends(season: SeasonSeed): SeasonTrends {
  const trends: Record<string, number> = {};
  for (const entry of season.entries) {
    trends[entry.teamId] = 0;
  }
  return trends;
}

/**
 * The season with each car's trend replaced by its team's in `trends`. A zero
 * is written as no trend at all, the form the seed data uses for a flat year;
 * a team missing from `trends` keeps its own.
 */
export function withTrends(season: SeasonSeed, trends: SeasonTrends): SeasonSeed {
  const entries = season.entries.map((entry) => {
    const trend = trends[entry.teamId];
    if (trend === undefined) {
      return entry;
    }
    const { developmentTrend: _authored, ...rest } = entry;
    return trend === 0 ? rest : { ...rest, developmentTrend: trend };
  });
  return { ...season, entries };
}
