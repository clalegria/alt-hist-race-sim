import { describe, expect, it } from "vitest";
import { buildField } from "./buildField.js";
import { drivers, FIRST_AUTHORED_SEASON, seasonSeed } from "./index.js";
import {
  applyLineup,
  authoredLineup,
  isAuthoredLineup,
  lineupChanges,
  reserveDrivers,
  type SeasonLineup,
  seatedDriverIds,
  seatOf,
  swapDrivers,
} from "./lineup.js";

/** One authored season as a fixture. Which one is not the point. */
const SEED = seasonSeed(FIRST_AUTHORED_SEASON);
const authored = authoredLineup(SEED);

/**
 * Drivers picked out of the data by what they are, not by name.
 *
 * Roadmap 2 adds privateer entries, which turns some of today's reserves into
 * seated drivers — so a test that hard-codes "Mansell has no drive" is a test
 * with an expiry date. See the testing rule in `CLAUDE.md`.
 */
function pick(): {
  seated: string;
  otherTeam: string;
  reserve: string;
  otherReserve: string;
  teamMate: string;
} {
  const twoCar = SEED.entries.find((entry) => entry.drivers.length >= 2);
  const elsewhere = SEED.entries.find(
    (entry) => entry.teamId !== twoCar?.teamId && entry.drivers.length > 0,
  );
  const [free, alsoFree] = reserveDrivers(authored);
  const seated = twoCar?.drivers[0];
  const teamMate = twoCar?.drivers[1];
  const otherTeam = elsewhere?.drivers[0];
  if (
    seated === undefined ||
    teamMate === undefined ||
    otherTeam === undefined ||
    free === undefined ||
    alsoFree === undefined
  ) {
    throw new Error("the season needs two multi-driver teams and two drivers without a seat");
  }
  return { seated, teamMate, otherTeam, reserve: free.id, otherReserve: alsoFree.id };
}

const { seated, teamMate, otherTeam, reserve, otherReserve } = pick();
const seatedTeam = seatOf(authored, seated) ?? "";
const otherTeamId = seatOf(authored, otherTeam) ?? "";
const SEATS = SEED.entries.flatMap((entry) => entry.drivers).length;

describe("the authored lineup", () => {
  it("has a seat for every driver the season enters", () => {
    expect(seatedDriverIds(authored)).toHaveLength(SEATS);
    expect(Object.keys(authored)).toHaveLength(SEED.entries.length);
  });

  it("says who drives for whom, entry for entry", () => {
    for (const entry of SEED.entries) {
      for (const driverId of entry.drivers) {
        expect(seatOf(authored, driverId), driverId).toBe(entry.teamId);
      }
    }
  });

  it("says nothing about a driver without a drive", () => {
    expect(seatOf(authored, reserve)).toBeNull();
  });

  it("leaves the rest of the pool in reserve, alphabetically", () => {
    const spare = reserveDrivers(authored);
    expect(spare).toHaveLength(drivers.length - SEATS);
    expect(spare.map((driver) => driver.id)).not.toContain(seated);
    const names = spare.map((driver) => driver.name);
    expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names);
  });

  it("is recognised as unedited", () => {
    expect(isAuthoredLineup(SEED, authored)).toBe(true);
  });
});

describe("swapping drivers", () => {
  it("puts a reserve driver into a seat and drops the incumbent out", () => {
    const swapped = swapDrivers(authored, seated, reserve);
    expect(seatOf(swapped, reserve)).toBe(seatedTeam);
    expect(seatOf(swapped, seated)).toBeNull();
    expect(reserveDrivers(swapped).map((driver) => driver.id)).toContain(seated);
  });

  it("exchanges two drivers who both hold seats", () => {
    const swapped = swapDrivers(authored, seated, otherTeam);
    expect(seatOf(swapped, otherTeam)).toBe(seatedTeam);
    expect(seatOf(swapped, seated)).toBe(otherTeamId);
  });

  it("never changes the size of the field or of a team", () => {
    // The whole constraint, stated as a property: swaps only, so nobody gains a
    // third car and no seat is left empty.
    let lineup: SeasonLineup = authored;
    const swaps: readonly (readonly [string, string])[] = [
      [seated, reserve],
      [otherTeam, seated],
      [teamMate, otherReserve],
      [otherReserve, otherTeam],
    ];
    for (const [a, b] of swaps) {
      lineup = swapDrivers(lineup, a, b);
      expect(seatedDriverIds(lineup)).toHaveLength(SEATS);
      expect(new Set(seatedDriverIds(lineup)).size).toBe(SEATS);
      for (const entry of SEED.entries) {
        expect(lineup[entry.teamId], entry.teamId).toHaveLength(entry.drivers.length);
      }
    }
  });

  it("keeps the teams and their seat order otherwise untouched", () => {
    const swapped = swapDrivers(authored, seated, reserve);
    expect(Object.keys(swapped)).toEqual(Object.keys(authored));
    expect(swapped[otherTeamId]).toEqual(authored[otherTeamId]);
  });

  it("treats swapping a driver with themselves as nothing at all", () => {
    expect(swapDrivers(authored, seated, seated)).toBe(authored);
  });

  it("refuses to swap two drivers who are both out of the grid", () => {
    // There is no seat involved, so there is no swap — and silently doing
    // nothing would look to a caller like it had worked.
    expect(() => swapDrivers(authored, reserve, otherReserve)).toThrow("nothing to swap");
  });

  it("undoes itself", () => {
    const there = swapDrivers(authored, seated, reserve);
    expect(isAuthoredLineup(SEED, swapDrivers(there, seated, reserve))).toBe(true);
    expect(isAuthoredLineup(SEED, there)).toBe(false);
  });
});

describe("applying a lineup to a season", () => {
  it("hands back the same entries when nothing was changed", () => {
    expect(applyLineup(SEED, authored)).toEqual(SEED);
  });

  it("re-seats the driver in the team's own chassis", () => {
    const season = applyLineup(SEED, swapDrivers(authored, seated, reserve));
    const team = season.entries.find((entry) => entry.teamId === seatedTeam);
    const original = SEED.entries.find((entry) => entry.teamId === seatedTeam);
    expect(team?.drivers).toContain(reserve);
    expect(team?.chassis).toEqual(original?.chassis);
  });

  it("builds a field the engine can race", () => {
    const season = applyLineup(SEED, swapDrivers(authored, seated, reserve));
    const field = buildField(season);
    expect(field).toHaveLength(SEATS);
    const promoted = field.find((entrant) => entrant.driverId === reserve);
    expect(promoted?.teamId).toBe(seatedTeam);
    expect(promoted?.driver.racing).toBeGreaterThan(0);
  });

  it("rejects a team that gained a car", () => {
    // Seat counts derived, not written down: the team picked above enters
    // however many cars the season gave it, and that number changes with the
    // data.
    const seats = authored[seatedTeam] ?? [];
    const overloaded = { ...authored, [seatedTeam]: [...seats, reserve] };
    expect(() => applyLineup(SEED, overloaded)).toThrow(`${seats.length + 1} drivers`);
  });

  it("rejects a team that lost one", () => {
    const seats = authored[seatedTeam] ?? [];
    const short = { ...authored, [seatedTeam]: seats.slice(0, -1) };
    expect(() => applyLineup(SEED, short)).toThrow(`${seats.length} cars`);
  });

  it("rejects a driver seated twice", () => {
    const cloned = {
      ...authored,
      [otherTeamId]: [seated, ...(authored[otherTeamId] ?? []).slice(1)],
    };
    expect(() => applyLineup(SEED, cloned)).toThrow("both");
  });

  it("rejects a team that is missing, or one that never entered", () => {
    const { [seatedTeam]: _removed, ...missing } = authored;
    expect(() => applyLineup(SEED, missing)).toThrow("missing a seat allocation");
    expect(() => applyLineup(SEED, { ...authored, nobodys_team: [] })).toThrow("does not enter");
  });
});

describe("reporting what was changed", () => {
  it("reports nothing for the authored grid", () => {
    expect(lineupChanges(SEED, authored)).toEqual([]);
  });

  it("names who arrived and who left, at the team it happened to", () => {
    const changes = lineupChanges(SEED, swapDrivers(authored, seated, reserve));
    expect(changes).toEqual([{ teamId: seatedTeam, in: [reserve], out: [seated], open: 0 }]);
  });

  it("reports both ends of a swap between two teams", () => {
    const changes = lineupChanges(SEED, swapDrivers(authored, seated, otherTeam));
    expect(changes).toHaveLength(2);
    expect(changes.map((change) => change.teamId).sort()).toEqual([seatedTeam, otherTeamId].sort());
  });

  it("pairs arrivals with departures one for one", () => {
    // Guaranteed by seat counts being preserved, and relied on by the UI, which
    // prints "X for Y" rather than two unrelated lists.
    let lineup = swapDrivers(authored, seated, reserve);
    lineup = swapDrivers(lineup, teamMate, otherReserve);
    lineup = swapDrivers(lineup, otherTeam, seated);
    for (const change of lineupChanges(SEED, lineup)) {
      expect(change.in.length, change.teamId).toBe(change.out.length);
    }
  });

  it("says nothing about a team whose drivers merely traded seats", () => {
    const [first, second] = SEED.entries[0]?.drivers ?? [];
    if (first === undefined || second === undefined) {
      throw new Error("expected a two-car team first on the entry list");
    }
    const reordered = swapDrivers(authored, first, second);
    expect(lineupChanges(SEED, reordered)).toEqual([]);
  });
});
