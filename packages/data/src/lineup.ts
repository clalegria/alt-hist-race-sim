/**
 * Who sits in which seat.
 *
 * A lineup is an override of a season's authored driver allocation: the same
 * teams, each with the same number of seats, different people in them. It
 * exists so a reader can put Villeneuve in the Williams without touching the
 * seed files, and so the season that follows can say what was changed.
 *
 * **Only swaps are representable.** Every operation here preserves each team's
 * seat count and therefore the size of the field. That is not a UI nicety: a
 * team with three cars is not an alternate history, and the field size is what
 * the starting limit and the DNQ arithmetic are calibrated against.
 *
 * Plain data — a record of arrays — because a lineup is part of the saved world
 * alongside the seed and the year.
 */

import { drivers as driverPool } from "./index.js";
import type { Driver, SeasonSeed } from "./types.js";

/**
 * Driver ids per team id: the same keys, and the same seat counts, as the
 * season it overrides.
 */
export type SeasonLineup = Readonly<Record<string, readonly string[]>>;

/** The season as authored — the lineup every edit starts from. */
export function authoredLineup(season: SeasonSeed): SeasonLineup {
  const lineup: Record<string, readonly string[]> = {};
  for (const entry of season.entries) {
    lineup[entry.teamId] = entry.drivers;
  }
  return lineup;
}

/** Every driver holding a seat, in team order then seat order. */
export function seatedDriverIds(lineup: SeasonLineup): readonly string[] {
  return Object.values(lineup).flat();
}

/** The team a driver drives for, or null if they hold no seat. */
export function seatOf(lineup: SeasonLineup, driverId: string): string | null {
  for (const [teamId, ids] of Object.entries(lineup)) {
    if (ids.includes(driverId)) {
      return teamId;
    }
  }
  return null;
}

/**
 * The drivers left out of the grid, alphabetically.
 *
 * Alphabetical rather than by rating, for the same reason the grid lists teams
 * alphabetically: this is a list to find a name in, not a ranking of who
 * deserves a drive.
 */
export function reserveDrivers(
  lineup: SeasonLineup,
  pool: readonly Driver[] = driverPool,
): readonly Driver[] {
  const seated = new Set(seatedDriverIds(lineup));
  return pool
    .filter((driver) => !seated.has(driver.id))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Exchanges two drivers.
 *
 * One of them must hold a seat; the other may be a reserve, in which case they
 * take that seat and the seated driver drops out of the grid. Both seated means
 * they change teams. Swapping a driver with themselves is a no-op rather than an
 * error, because a reader selecting the same name twice means "never mind".
 */
export function swapDrivers(lineup: SeasonLineup, a: string, b: string): SeasonLineup {
  if (a === b) {
    return lineup;
  }
  if (seatOf(lineup, a) === null && seatOf(lineup, b) === null) {
    throw new Error(`Neither "${a}" nor "${b}" holds a seat, so there is nothing to swap`);
  }

  const exchange = (driverId: string): string => {
    if (driverId === a) {
      return b;
    }
    if (driverId === b) {
      return a;
    }
    return driverId;
  };

  const swapped: Record<string, readonly string[]> = {};
  for (const [teamId, ids] of Object.entries(lineup)) {
    swapped[teamId] = ids.map(exchange);
  }
  return swapped;
}

/** Whether a lineup is the authored one, seat for seat. */
export function isAuthoredLineup(season: SeasonSeed, lineup: SeasonLineup): boolean {
  const authored = authoredLineup(season);
  const teamIds = Object.keys(authored);
  if (Object.keys(lineup).length !== teamIds.length) {
    return false;
  }
  return teamIds.every((teamId) => {
    const before = authored[teamId] ?? [];
    const after = lineup[teamId];
    return (
      after !== undefined &&
      after.length === before.length &&
      after.every((driverId, seat) => driverId === before[seat])
    );
  });
}

/**
 * The season with its seats reallocated.
 *
 * Validates rather than trusts: a lineup can arrive from a save file, and a
 * team quietly gaining a third car would show up much later as a field size the
 * calibration never saw.
 */
export function applyLineup(season: SeasonSeed, lineup: SeasonLineup): SeasonSeed {
  const known = new Set(season.entries.map((entry) => entry.teamId));
  for (const teamId of Object.keys(lineup)) {
    if (!known.has(teamId)) {
      throw new Error(`Lineup names team "${teamId}", which does not enter season ${season.year}`);
    }
  }

  const seen = new Map<string, string>();
  const entries = season.entries.map((entry) => {
    const drivers = lineup[entry.teamId];
    if (drivers === undefined) {
      throw new Error(`Lineup is missing a seat allocation for team "${entry.teamId}"`);
    }
    if (drivers.length !== entry.drivers.length) {
      throw new Error(
        `Lineup gives "${entry.teamId}" ${drivers.length} drivers; it enters ${entry.drivers.length} cars`,
      );
    }
    for (const driverId of drivers) {
      const other = seen.get(driverId);
      if (other !== undefined) {
        throw new Error(`Lineup seats "${driverId}" at both "${other}" and "${entry.teamId}"`);
      }
      seen.set(driverId, entry.teamId);
    }
    return { ...entry, drivers };
  });

  return { ...season, entries };
}

/**
 * One team's difference from the authored grid.
 *
 * `in` and `out` are always the same length — seat counts are preserved, so
 * everyone who arrived displaced someone — which is what lets a reader be shown
 * "Alain Prost for Jody Scheckter" rather than two unrelated lists.
 */
export interface SeatChange {
  readonly teamId: string;
  /** Drivers now at this team who were not authored into it. */
  readonly in: readonly string[];
  /** Authored drivers who no longer hold one of its seats. */
  readonly out: readonly string[];
}

/** Every team whose drivers differ from the authored season, in entry order. */
export function lineupChanges(season: SeasonSeed, lineup: SeasonLineup): readonly SeatChange[] {
  const changes: SeatChange[] = [];
  for (const entry of season.entries) {
    const now = lineup[entry.teamId] ?? entry.drivers;
    const arrived = now.filter((driverId) => !entry.drivers.includes(driverId));
    const left = entry.drivers.filter((driverId) => !now.includes(driverId));
    if (arrived.length > 0 || left.length > 0) {
      changes.push({ teamId: entry.teamId, in: arrived, out: left });
    }
  }
  return changes;
}
