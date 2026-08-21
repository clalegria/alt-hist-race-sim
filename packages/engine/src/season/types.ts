import type { RaceResult } from "../race/types.js";

/**
 * A season's worth of races, in order. A race's position in the array is its
 * round number, one-based.
 *
 * This is the season's *primary* data and the only thing worth storing: every
 * championship number is derived from it on read by `championshipStandings`.
 * Nothing here caches a points total, because a cached total is a second source
 * of truth waiting to disagree with the first.
 */
export interface SeasonResult {
  readonly races: readonly RaceResult[];
}

/** What a driver and a constructor both accumulate over a season. */
interface SeasonTotals {
  readonly points: number;
  readonly wins: number;
  readonly podiums: number;
  readonly poles: number;
  /** Races started, retired from, and failed to qualify for. */
  readonly starts: number;
  readonly retirements: number;
  readonly nonQualifications: number;
  /** Best finishing position of the season, or null if they never finished. */
  readonly bestFinish: number | null;
  /**
   * How many times they finished in each position, best first: index 0 is wins.
   * Runs as far as their *worst* finish, so leading entries can be zero — a
   * driver who finished 8th and 2nd has `[0, 1, 0, 0, 0, 0, 0, 1]`.
   *
   * This is what settles a tie on points — most wins, then most seconds, and so
   * on down, which is how 1980 separated equal totals.
   */
  readonly finishCounts: readonly number[];
}

/** One driver's season, derived from the results. Never stored. */
export interface DriverStanding extends SeasonTotals {
  readonly driverId: string;
  /**
   * The team of their most recent entry. Once the transfer market exists a
   * driver may hold more than one seat in a season, and this becomes "who they
   * finished the year with" rather than a fact about the season.
   */
  readonly teamId: string;
}

/**
 * One constructor's season, derived from the same results. Never stored.
 *
 * Both of a team's cars score, which is the rule from 1979 onward, so `starts`,
 * `retirements`, `wins` and `podiums` are per car rather than per race: a
 * two-car team that finished every round with both cars has 28 starts. `poles`
 * counts races, since only one car can start from pole.
 */
export interface ConstructorStanding extends SeasonTotals {
  readonly teamId: string;
  /**
   * The most cars the team entered in any single round.
   *
   * The bound on what a round can still be worth to them, which is what decides
   * whether a championship is mathematically settled: a two-car team can take a
   * one-two, a single-car entry cannot.
   */
  readonly cars: number;
}
