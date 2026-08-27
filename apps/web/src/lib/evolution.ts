/**
 * A championship as it stood after every round.
 *
 * The tables on the summary say who won; this says *when*. Both are the same
 * arithmetic over the same result rows — the engine derives a championship from
 * a `SeasonResult`, and `{ races: races.slice(0, n) }` is that championship
 * after n rounds — so nothing here is stored, no engine change was needed, and
 * a chart cannot disagree with the table under it.
 *
 * Display-side rather than in the engine for the same reason `results.ts` is:
 * this is a shape for drawing, not a fact about the season. What it does *not*
 * do is decide anything about colour, names or axes; that is
 * `StandingsEvolution.tsx`, and keeping the split means the fold is testable
 * where the chart itself is not (Recharts renders nothing without a DOM).
 */

import {
  championshipStandings,
  constructorStandings,
  type PointsScale,
  type SeasonResult,
} from "@alt-hist/engine";
import { type Standing, standingKey } from "./standings.js";

/**
 * How many drivers and how many teams are drawn.
 *
 * Six and four: enough that a title fight has its supporting cast in it, few
 * enough that the legend stays readable and the lines stay apart. The series
 * are the top six **at season end**, not the top six at any point — the reader
 * arrives at this chart already knowing who mattered, and a legend that grows
 * every time a midfielder has one good afternoon is a worse trade than the
 * honesty it buys.
 */
export const TOP_DRIVERS = 6;
export const TOP_TEAMS = 4;

/** One line: who it is, whose colours it wears, and its points after each round. */
export interface EvolutionSeries {
  /** A driver id or a team id, depending on the table. */
  readonly key: string;
  /**
   * The team whose livery the line is drawn in — the competitor itself on the
   * constructors' side, and on the drivers' side the team they finished the
   * year with, which is what the standings row says too.
   */
  readonly teamId: string;
  /** Cumulative championship points, one entry per round, in calendar order. */
  readonly points: readonly number[];
}

/** The tables the engine derives, as this module consumes them. */
type Table = (season: SeasonResult, points: PointsScale) => readonly Standing[];

/** Points by competitor for one standings table, for a per-round lookup. */
function pointsByKey(standings: readonly Standing[]): ReadonlyMap<string, number> {
  return new Map(standings.map((standing) => [standingKey(standing), standing.points]));
}

/**
 * The top `limit` of a championship, with the running total behind each of them.
 *
 * Runs the table once per round — quadratic in the calendar, which is
 * twenty-odd rounds over a couple of dozen result rows and therefore not worth
 * a hand-rolled fold that could drift from the engine's own tie-breaks and
 * scoring. A competitor who had not entered by round n scores 0 there rather
 * than a gap: they are on the chart because of where they finished the season,
 * and a line that starts in mid-air reads as missing data.
 */
export function standingsEvolution(
  season: SeasonResult,
  points: PointsScale,
  table: Table,
  limit: number,
): EvolutionSeries[] {
  const perRound = season.races.map((_, round) =>
    pointsByKey(table({ races: season.races.slice(0, round + 1) }, points)),
  );
  return table(season, points)
    .slice(0, limit)
    .map((standing) => {
      const key = standingKey(standing);
      return {
        key,
        teamId: standing.teamId,
        points: perRound.map((round) => round.get(key) ?? 0),
      };
    });
}

/** The drivers' championship, round by round, for the top six at season end. */
export function driversEvolution(season: SeasonResult, points: PointsScale): EvolutionSeries[] {
  return standingsEvolution(season, points, championshipStandings, TOP_DRIVERS);
}

/** The constructors' championship, the same way, for the top four. */
export function teamsEvolution(season: SeasonResult, points: PointsScale): EvolutionSeries[] {
  return standingsEvolution(season, points, constructorStandings, TOP_TEAMS);
}

/** One round of a chart: the round number, then a column per series. */
export type EvolutionRow = { round: number } & Record<string, number>;

/**
 * The series transposed into the row-per-round shape a chart library wants.
 *
 * Rounds are 1-based here because that is what an axis is labelled with; the
 * series themselves are indexed from zero like the calendar they came from.
 */
export function evolutionRows(series: readonly EvolutionSeries[]): EvolutionRow[] {
  const rounds = series[0]?.points.length ?? 0;
  return Array.from({ length: rounds }, (_, round) => {
    const row: EvolutionRow = { round: round + 1 };
    for (const line of series) {
      row[line.key] = line.points[round] ?? 0;
    }
    return row;
  });
}
