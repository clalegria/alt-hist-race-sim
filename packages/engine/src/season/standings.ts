import type { RaceEntryResult } from "../race/types.js";
import { SEASON_CONSTANTS, type SeasonConstants } from "./constants.js";
import type { ConstructorStanding, DriverStanding, SeasonResult } from "./types.js";

/**
 * Championship points for a finishing position, one-based.
 *
 * Anything past the end of the scale scores nothing, which is also how a
 * non-integer or nonsense position is treated rather than throwing: standings
 * are derived on read, and a display path is a bad place to explode.
 */
export function pointsForPosition(
  position: number,
  constants: SeasonConstants = SEASON_CONSTANTS,
): number {
  if (!Number.isInteger(position) || position < 1) {
    return 0;
  }
  return constants.pointsByPosition[position - 1] ?? 0;
}

/** Mutable accumulator; the exported shape is readonly. */
interface Tally {
  /** Whatever the table is keyed on — a driver id or a team id. */
  key: string;
  /** The team of the most recent entry. Only meaningful on a driver tally. */
  teamId: string;
  points: number;
  poles: number;
  starts: number;
  retirements: number;
  nonQualifications: number;
  finishCounts: number[];
}

/**
 * Compares two entries on countback: most wins, then most seconds, and so on.
 *
 * Returns a value for the caller's sort, negative when `a` places ahead.
 */
function compareCountback(a: Tally, b: Tally): number {
  const places = Math.max(a.finishCounts.length, b.finishCounts.length);
  for (let i = 0; i < places; i += 1) {
    const difference = (b.finishCounts[i] ?? 0) - (a.finishCounts[i] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}

/** The first position they ever finished in, or null if they never finished. */
function bestFinishOf(finishCounts: readonly number[]): number | null {
  const index = finishCounts.findIndex((count) => count > 0);
  return index === -1 ? null : index + 1;
}

/**
 * Accumulates a season into one tally per key, then orders them.
 *
 * Drivers and constructors are the same table keyed differently, so they share
 * this: points, poles and countback are counted from the same result rows, and
 * a team's row is simply both of its cars added together. That is the post-1979
 * rule and the only one this sim needs — before then a constructor scored only
 * its best-placed car, and the sim starts in 1980 and runs forward.
 *
 * Ordered by points, then countback, then key, so the order is total and never
 * depends on the sort implementation.
 */
function tallySeason(
  season: SeasonResult,
  keyOf: (entry: RaceEntryResult) => string,
  constants: SeasonConstants,
): Tally[] {
  const tallies = new Map<string, Tally>();

  for (const race of season.races) {
    for (const entry of race.entries) {
      const key = keyOf(entry);
      let tally = tallies.get(key);
      if (tally === undefined) {
        tally = {
          key,
          teamId: entry.teamId,
          points: 0,
          poles: 0,
          starts: 0,
          retirements: 0,
          nonQualifications: 0,
          finishCounts: [],
        };
        tallies.set(key, tally);
      }
      tally.teamId = entry.teamId;

      // Pole is a Saturday result, so it counts even for a car that never
      // started — which cannot happen while the cut is at 26, but would the
      // moment a limit smaller than the front row existed.
      if (entry.driverId === race.poleDriverId) {
        tally.poles += 1;
      }

      if (!entry.started) {
        tally.nonQualifications += 1;
        continue;
      }
      tally.starts += 1;
      if (entry.retired) {
        tally.retirements += 1;
        continue;
      }

      const position = entry.finishPosition;
      if (position === null) {
        continue;
      }
      tally.points += pointsForPosition(position, constants);
      while (tally.finishCounts.length < position) {
        tally.finishCounts.push(0);
      }
      tally.finishCounts[position - 1] = (tally.finishCounts[position - 1] ?? 0) + 1;
    }
  }

  return [...tallies.values()].sort(
    (a, b) => b.points - a.points || compareCountback(a, b) || (a.key < b.key ? -1 : 1),
  );
}

/** The parts of a standing that drivers and constructors share. */
function summarise(tally: Tally): Omit<DriverStanding, "driverId" | "teamId"> {
  return {
    points: tally.points,
    wins: tally.finishCounts[0] ?? 0,
    podiums:
      (tally.finishCounts[0] ?? 0) + (tally.finishCounts[1] ?? 0) + (tally.finishCounts[2] ?? 0),
    poles: tally.poles,
    starts: tally.starts,
    retirements: tally.retirements,
    nonQualifications: tally.nonQualifications,
    bestFinish: bestFinishOf(tally.finishCounts),
    finishCounts: tally.finishCounts,
  };
}

/**
 * Builds the drivers' championship table from a season's results.
 *
 * Pure and derived: pass the same results and you get the same table, and the
 * results themselves are never modified.
 *
 * Every driver who appears in any race appears exactly once, including one who
 * failed to qualify for all of them — a season with no starts is a fact about
 * that driver's year, not a reason to hide them.
 */
export function championshipStandings(
  season: SeasonResult,
  constants: SeasonConstants = SEASON_CONSTANTS,
): readonly DriverStanding[] {
  return tallySeason(season, (entry) => entry.driverId, constants).map((tally) => ({
    driverId: tally.key,
    teamId: tally.teamId,
    ...summarise(tally),
  }));
}

/**
 * The most cars each team entered in any one round.
 *
 * Taken as a maximum rather than an average because it bounds what a future
 * round can be worth to them, and a team that ran two cars once can do so again.
 */
function carsPerTeam(season: SeasonResult): ReadonlyMap<string, number> {
  const most = new Map<string, number>();
  for (const race of season.races) {
    const thisRound = new Map<string, number>();
    for (const entry of race.entries) {
      thisRound.set(entry.teamId, (thisRound.get(entry.teamId) ?? 0) + 1);
    }
    for (const [teamId, count] of thisRound) {
      most.set(teamId, Math.max(most.get(teamId) ?? 0, count));
    }
  }
  return most;
}

/**
 * Builds the constructors' championship table from the same results.
 *
 * Both of a team's cars score, which is the rule from 1979 onward. `starts`,
 * `retirements` and the rest are therefore per car, not per race: a two-car team
 * that saw the flag with both cars in all fourteen rounds has 28 starts.
 *
 * `poles` counts races, not cars — only one car can start from pole.
 */
export function constructorStandings(
  season: SeasonResult,
  constants: SeasonConstants = SEASON_CONSTANTS,
): readonly ConstructorStanding[] {
  const cars = carsPerTeam(season);
  return tallySeason(season, (entry) => entry.teamId, constants).map((tally) => ({
    teamId: tally.key,
    cars: cars.get(tally.key) ?? 0,
    ...summarise(tally),
  }));
}
