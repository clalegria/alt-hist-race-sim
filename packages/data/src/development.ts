/**
 * Which way each car's year runs, as a run would have it.
 *
 * The *In-season development* run setting's layer over a season seed, beside
 * `chassis.ts`: a `SeasonTrends` is each team's `developmentTrend` for one
 * season, and `withTrends(season, trends)` hands back a `SeasonSeed` that
 * `buildField` consumes unchanged. **Random** draws every car one
 * (`randomTrends`); **Off** flattens every car (`flatTrends`). The grid
 * editor's steps are the same record, absolute over the run's own (`stepTrend`,
 * `applyTrends`). What a trend does to a race is the engine's `development.ts`.
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

/**
 * Each car's trend as the season enters it — the override a grid edit starts
 * from. No trend is written as zero, so every team has a key.
 */
export function authoredTrends(season: SeasonSeed): SeasonTrends {
  const trends: Record<string, number> = {};
  for (const entry of season.entries) {
    trends[entry.teamId] = entry.developmentTrend ?? 0;
  }
  return trends;
}

/** Whether an override is the season's own trends, team for team. */
export function isAuthoredTrends(season: SeasonSeed, trends: SeasonTrends): boolean {
  if (Object.keys(trends).length !== season.entries.length) {
    return false;
  }
  return season.entries.every((entry) => trends[entry.teamId] === (entry.developmentTrend ?? 0));
}

/**
 * The season with the reader's trends in it: `withTrends`, but validating
 * rather than trusting, as `applyChassis` does, because an override can arrive
 * from a save file. Every team must be named, each with a whole number within
 * ±`DEVELOPMENT_TREND_LIMIT`.
 */
export function applyTrends(season: SeasonSeed, trends: SeasonTrends): SeasonSeed {
  const known = new Set(season.entries.map((entry) => entry.teamId));
  for (const teamId of Object.keys(trends)) {
    if (!known.has(teamId)) {
      throw new Error(`Trends name team "${teamId}", which does not enter season ${season.year}`);
    }
  }
  for (const entry of season.entries) {
    const trend = trends[entry.teamId];
    if (trend === undefined) {
      throw new Error(`Trends are missing team "${entry.teamId}"`);
    }
    if (
      !Number.isInteger(trend) ||
      trend < -DEVELOPMENT_TREND_LIMIT ||
      trend > DEVELOPMENT_TREND_LIMIT
    ) {
      throw new Error(
        `Trend for "${entry.teamId}" is ${String(trend)}; trends are whole numbers from -${DEVELOPMENT_TREND_LIMIT} to ${DEVELOPMENT_TREND_LIMIT}`,
      );
    }
  }
  return withTrends(season, trends);
}

/** A trend moved by a step, held inside ±`DEVELOPMENT_TREND_LIMIT`. */
function steppedTrend(trend: number, step: 1 | -1): number {
  return Math.min(Math.max(trend + step, -DEVELOPMENT_TREND_LIMIT), DEVELOPMENT_TREND_LIMIT);
}

/**
 * One team's trend a point up or down — the grid editor's step. Hands back the
 * trends it was given when nothing could move, so a press at the limit changes
 * nothing.
 */
export function stepTrend(trends: SeasonTrends, teamId: string, step: 1 | -1): SeasonTrends {
  const current = trends[teamId];
  if (current === undefined) {
    return trends;
  }
  const next = steppedTrend(current, step);
  return next === current ? trends : { ...trends, [teamId]: next };
}

/** Whether a step that way could move this trend at all. */
export function canStepTrend(trend: number, step: 1 | -1): boolean {
  return steppedTrend(trend, step) !== trend;
}

/** One team's re-set trend, both ends, as a `ChassisChange` is for a chassis. */
export interface TrendChange {
  readonly teamId: string;
  /** The trend the season entered with; zero for none. */
  readonly from: number;
  /** As the reader would have it. */
  readonly to: number;
}

/** Every team whose trend differs from the season's, in entry order. */
export function trendChanges(season: SeasonSeed, trends: SeasonTrends): readonly TrendChange[] {
  const changes: TrendChange[] = [];
  for (const entry of season.entries) {
    const from = entry.developmentTrend ?? 0;
    const to = trends[entry.teamId] ?? from;
    if (to !== from) {
      changes.push({ teamId: entry.teamId, from, to });
    }
  }
  return changes;
}
