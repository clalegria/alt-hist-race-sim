/**
 * Who sits in which seat.
 *
 * A lineup is an override of a season's authored driver allocation: the same
 * teams, each with the same number of seats, different people in them. It
 * exists so a reader can put Villeneuve in the Williams without touching the
 * seed files, and so the season that follows can say what was changed.
 *
 * **Seat counts never change.** Every operation here preserves each team's seat
 * count and therefore the size of the field. That is not a UI nicety: a team
 * with three cars is not an alternate history, and the field size is what the
 * starting limit and the DNQ arithmetic depend on.
 *
 * There are two shapes of the same thing, and the difference is load-bearing:
 *
 * - a **`SeasonLineup`** has a driver in every seat, and is what a world is run
 *   on and saved with;
 * - a **`LineupDraft`** may hold a `null` — a seat nobody has been put in yet.
 *   Only the editor produces one, and it can never be applied: `filledLineup`
 *   is the gate, and it hands back `null` while a hole remains.
 *
 * A `SeasonLineup` *is* a `LineupDraft` as far as the type system is concerned
 * (a `readonly string[]` is a `readonly (string | null)[]`), so everything that
 * reads a draft reads a lineup too and there is only one of each function.
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

/** One seat of a draft grid: whoever holds it, or `null` for nobody yet. */
export type DraftSeat = string | null;

/**
 * A lineup mid-edit, which may have seats nobody holds.
 *
 * Holes appear the moment a driver is moved somewhere else — copying last
 * season's grid over this one is the operation that makes a dozen of them at
 * once — and the reader resolves each before the grid can be applied.
 */
export type LineupDraft = Readonly<Record<string, readonly DraftSeat[]>>;

/** One seat, addressed: which team, and which of its cars. */
export interface SeatRef {
  readonly teamId: string;
  /** Zero-based index into that team's seats. */
  readonly seat: number;
}

/**
 * What the editor can have hold of: a driver, or an empty seat.
 *
 * Two kinds rather than one, because an empty seat has no driver to name it by
 * and a reserve driver has no seat to name *them* by. Every edit is an exchange
 * between two of these — see `exchangePicks`.
 */
export type GridPick =
  | { readonly kind: "driver"; readonly driverId: string }
  | ({ readonly kind: "seat" } & SeatRef);

/** The season as authored — the lineup every edit starts from. */
export function authoredLineup(season: SeasonSeed): SeasonLineup {
  const lineup: Record<string, readonly string[]> = {};
  for (const entry of season.entries) {
    lineup[entry.teamId] = entry.drivers;
  }
  return lineup;
}

/** Every driver holding a seat, in team order then seat order. An empty seat is nobody. */
export function seatedDriverIds(lineup: LineupDraft): readonly string[] {
  return Object.values(lineup)
    .flat()
    .filter((driverId): driverId is string => driverId !== null);
}

/** The team a driver drives for, or null if they hold no seat. */
export function seatOf(lineup: LineupDraft, driverId: string): string | null {
  return seatRefOf(lineup, driverId)?.teamId ?? null;
}

/** Which seat a driver holds, or null if they hold none. */
export function seatRefOf(lineup: LineupDraft, driverId: string): SeatRef | null {
  for (const [teamId, seats] of Object.entries(lineup)) {
    const seat = seats.indexOf(driverId);
    if (seat !== -1) {
      return { teamId, seat };
    }
  }
  return null;
}

/** Whoever holds a seat: null for an empty one, and for a seat that does not exist. */
export function driverAt(lineup: LineupDraft, ref: SeatRef): string | null {
  return lineup[ref.teamId]?.[ref.seat] ?? null;
}

/** Every seat nobody holds, in team order then seat order. */
export function emptySeats(lineup: LineupDraft): readonly SeatRef[] {
  const empty: SeatRef[] = [];
  for (const [teamId, seats] of Object.entries(lineup)) {
    seats.forEach((driverId, seat) => {
      if (driverId === null) {
        empty.push({ teamId, seat });
      }
    });
  }
  return empty;
}

/**
 * The draft as a lineup a season can be run on, or `null` while a seat is open.
 *
 * The one gate between the editor and the world: a draft with a hole in it is
 * not a grid, and this is what refuses it rather than every caller remembering
 * to check. It narrows rather than validates, so what comes back is *typed* as
 * the thing that may be applied.
 */
export function filledLineup(lineup: LineupDraft): SeasonLineup | null {
  const filled: Record<string, readonly string[]> = {};
  for (const [teamId, seats] of Object.entries(lineup)) {
    const drivers: string[] = [];
    for (const driverId of seats) {
      if (driverId === null) {
        return null;
      }
      drivers.push(driverId);
    }
    filled[teamId] = drivers;
  }
  return filled;
}

/**
 * The drivers left out of the grid, alphabetically.
 *
 * Alphabetical rather than by rating, for the same reason the grid lists teams
 * alphabetically: this is a list to find a name in, not a ranking of who
 * deserves a drive.
 */
export function reserveDrivers(
  lineup: LineupDraft,
  pool: readonly Driver[] = driverPool,
): readonly Driver[] {
  const seated = new Set(seatedDriverIds(lineup));
  return pool
    .filter((driver) => !seated.has(driver.id))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Where a pick sits, if anywhere, and who it is holding. */
function resolve(
  lineup: LineupDraft,
  pick: GridPick,
): { readonly at: SeatRef | null; readonly holds: string | null } {
  if (pick.kind === "seat") {
    return { at: { teamId: pick.teamId, seat: pick.seat }, holds: driverAt(lineup, pick) };
  }
  return { at: seatRefOf(lineup, pick.driverId), holds: pick.driverId };
}

function sameSeat(a: SeatRef | null, b: SeatRef | null): boolean {
  return a !== null && b !== null && a.teamId === b.teamId && a.seat === b.seat;
}

/**
 * Exchanges what two picks hold.
 *
 * This is the whole of editing, and every case falls out of one rule: whatever
 * `a` holds goes to `b`'s seat, and whatever `b` holds goes to `a`'s. A pick
 * with no seat — a driver in the pool — has nowhere to write back to, so
 * whoever they displaced simply leaves the grid.
 *
 * So: two seated drivers change teams; a reserve takes a seat and its holder
 * drops into the pool; a seated driver moves to an open seat and leaves an open
 * one behind; a reserve fills an open seat and nobody is displaced. Seat counts
 * are untouched in all four, which is the invariant this file is built around.
 *
 * Two picks holding no seat between them are nothing to exchange — what a
 * second click on the pool means is the caller's decision, and `pickUp` treats
 * it as changing the selection.
 */
export function exchangePicks(lineup: LineupDraft, a: GridPick, b: GridPick): LineupDraft {
  const left = resolve(lineup, a);
  const right = resolve(lineup, b);
  if (left.at === null && right.at === null) {
    throw new Error("Neither pick holds a seat, so there is nothing to exchange");
  }
  if (sameSeat(left.at, right.at)) {
    return lineup;
  }

  const exchanged: Record<string, readonly DraftSeat[]> = {};
  for (const [teamId, seats] of Object.entries(lineup)) {
    exchanged[teamId] = seats.map((driverId, seat) => {
      const here = { teamId, seat };
      if (sameSeat(left.at, here)) {
        return right.holds;
      }
      if (sameSeat(right.at, here)) {
        return left.holds;
      }
      return driverId;
    });
  }
  return exchanged;
}

/**
 * Exchanges two drivers.
 *
 * One of them must hold a seat; the other may be a reserve, in which case they
 * take that seat and the seated driver drops out of the grid. Both seated means
 * they change teams. Swapping a driver with themselves is a no-op rather than an
 * error, because a reader selecting the same name twice means "never mind".
 *
 * The driver-only face of `exchangePicks`, and it cannot open a seat: both picks
 * name somebody, so no seat is left holding nobody.
 */
export function swapDrivers(lineup: SeasonLineup, a: string, b: string): SeasonLineup {
  if (a === b) {
    return lineup;
  }
  if (seatOf(lineup, a) === null && seatOf(lineup, b) === null) {
    throw new Error(`Neither "${a}" nor "${b}" holds a seat, so there is nothing to swap`);
  }
  const exchanged = exchangePicks(
    lineup,
    { kind: "driver", driverId: a },
    { kind: "driver", driverId: b },
  );
  // Never null: both picks name a driver, so nothing can be emptied.
  return filledLineup(exchanged) ?? lineup;
}

/** Whether a lineup is the authored one, seat for seat. A draft with a hole never is. */
export function isAuthoredLineup(season: SeasonSeed, lineup: LineupDraft): boolean {
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
 * team quietly gaining a third car would show up much later as a field size
 * nothing else expects.
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
 * The season a *draft* describes, with its open seats simply not entered.
 *
 * For previewing only — the grid on screen while the reader is still filling
 * holes in — which is why it is a separate function rather than a flag on
 * `applyLineup`. A season that quietly shrank because a save file had a hole in
 * it is exactly what that function's length check exists to catch, and that
 * check stays exact.
 */
export function applyDraft(season: SeasonSeed, lineup: LineupDraft): SeasonSeed {
  const entries = season.entries.map((entry) => {
    const seats = lineup[entry.teamId];
    return seats === undefined
      ? entry
      : { ...entry, drivers: seats.filter((driverId): driverId is string => driverId !== null) };
  });
  return { ...season, entries };
}

/**
 * One team's difference from the authored grid.
 *
 * `in` and `out` pair up one for one while every seat is filled — seat counts
 * are preserved, so everyone who arrived displaced someone — which is what lets
 * a reader be shown "Alain Prost for Jody Scheckter" rather than two unrelated
 * lists. A draft with an open seat is the one case where `out` runs longer:
 * somebody left and nobody has taken their place yet, and `open` counts those.
 */
export interface SeatChange {
  readonly teamId: string;
  /** Drivers now at this team who were not authored into it. */
  readonly in: readonly string[];
  /** Authored drivers who no longer hold one of its seats. */
  readonly out: readonly string[];
  /** How many of its cars nobody has been put in. Zero on any applied grid. */
  readonly open: number;
}

/** Every team whose drivers differ from the authored season, in entry order. */
export function lineupChanges(season: SeasonSeed, lineup: LineupDraft): readonly SeatChange[] {
  const changes: SeatChange[] = [];
  for (const entry of season.entries) {
    const seats = lineup[entry.teamId] ?? entry.drivers;
    const now = seats.filter((driverId): driverId is string => driverId !== null);
    const open = seats.length - now.length;
    const arrived = now.filter((driverId) => !entry.drivers.includes(driverId));
    const left = entry.drivers.filter((driverId) => !now.includes(driverId));
    if (arrived.length > 0 || left.length > 0 || open > 0) {
      changes.push({ teamId: entry.teamId, in: arrived, out: left, open });
    }
  }
  return changes;
}
