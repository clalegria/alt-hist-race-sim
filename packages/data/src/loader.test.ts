import { describe, expect, it } from "vitest";
import {
  type Driver,
  drivers,
  driversById,
  type SeasonSeed,
  season1980,
  teams,
  teamsById,
  validateSeedData,
} from "./index.js";

describe("seed data", () => {
  it("loads a pool, a paddock and a season", () => {
    // Counts are deliberately not asserted: the grid grows, and a test that
    // says "41 drivers" fails for a reason that is not a bug.
    expect(drivers.length).toBeGreaterThan(0);
    expect(teams.length).toBeGreaterThan(0);
    expect(season1980.year).toBe(1980);
    expect(season1980.entries.length).toBeGreaterThan(0);
  });

  it("indexes drivers and teams by id", () => {
    for (const record of drivers) {
      expect(driversById().get(record.id), record.id).toBe(record);
    }
    for (const team of teams) {
      expect(teamsById().get(team.id), team.id).toBe(team);
    }
    expect(driversById().get("nobody")).toBeUndefined();
  });
});

/** Real ids, so a fixture's *other* field is the one under test. */
const knownDriver = drivers[0]?.id ?? "";
const knownTeam = teams[0]?.id ?? "";
const otherTeam = teams[1]?.id ?? "";

describe("validateSeedData", () => {
  it("accepts the bundled seed", () => {
    expect(() => {
      validateSeedData();
    }).not.toThrow();
  });

  it("numbers the authored calendar in order, with every round named", () => {
    expect(season1980.calendar.length).toBeGreaterThan(0);
    expect(season1980.calendar.map((race) => race.round)).toEqual(
      season1980.calendar.map((_, index) => index + 1),
    );
    for (const race of season1980.calendar) {
      expect(race.name.trim(), `round ${race.round}`).not.toBe("");
      expect(race.circuit.trim(), `round ${race.round}`).not.toBe("");
    }
  });

  it("allows seatless drivers and single-car entries", () => {
    const seated = new Set(season1980.entries.flatMap((entry) => entry.drivers));
    expect(seated.size).toBeLessThan(drivers.length);
    expect(season1980.entries.some((entry) => entry.drivers.length === 1)).toBe(true);
  });

  it("rejects an entry referencing an unknown driver", () => {
    const broken: SeasonSeed = {
      year: 1980,
      calendar: [],
      entries: [{ teamId: knownTeam, car: carSpec(), drivers: ["ghost"] }],
    };
    expect(() => {
      validateSeedData(drivers, teams, broken);
    }).toThrow(/unknown driver "ghost"/);
  });

  it("rejects an entry referencing an unknown team", () => {
    const broken: SeasonSeed = {
      year: 1980,
      calendar: [],
      entries: [{ teamId: "phantom", car: carSpec(), drivers: [knownDriver] }],
    };
    expect(() => {
      validateSeedData(drivers, teams, broken);
    }).toThrow(/unknown team "phantom"/);
  });

  it("rejects a calendar whose round numbers do not match their order", () => {
    // Cosmetic data still has to be right: a round number out of step with its
    // position mislabels every result printed against it.
    const broken: SeasonSeed = {
      year: 1980,
      calendar: [
        { round: 1, name: "Argentine GP", circuit: "Buenos Aires", country: "AR" },
        { round: 3, name: "Brazilian GP", circuit: "Interlagos", country: "BR" },
      ],
      entries: [],
    };
    expect(() => {
      validateSeedData(drivers, teams, broken);
    }).toThrow(/round 3 sits at position 2/);
  });

  it("rejects a calendar race whose country is not an ISO alpha-2 code", () => {
    const broken: SeasonSeed = {
      year: 1980,
      calendar: [{ round: 1, name: "Argentine GP", circuit: "Buenos Aires", country: "ARG" }],
      entries: [],
    };
    expect(() => {
      validateSeedData(drivers, teams, broken);
    }).toThrow(/not an ISO alpha-2 code/);
  });

  it("rejects a calendar race with no name or no circuit", () => {
    const withName = (name: string, circuit: string): SeasonSeed => ({
      year: 1980,
      calendar: [{ round: 1, name, circuit, country: "AR" }],
      entries: [],
    });
    expect(() => {
      validateSeedData(drivers, teams, withName("  ", "Buenos Aires"));
    }).toThrow(/missing a name or circuit/);
    expect(() => {
      validateSeedData(drivers, teams, withName("Argentine GP", ""));
    }).toThrow(/missing a name or circuit/);
  });

  it("rejects a driver seated at two teams", () => {
    const broken: SeasonSeed = {
      year: 1980,
      calendar: [],
      entries: [
        { teamId: knownTeam, car: carSpec(), drivers: [knownDriver] },
        { teamId: otherTeam, car: carSpec(), drivers: [knownDriver] },
      ],
    };
    expect(() => {
      validateSeedData(drivers, teams, broken);
    }).toThrow(/seated at both/);
  });

  it("rejects duplicate driver ids in the pool", () => {
    const first = drivers[0];
    if (first === undefined) {
      throw new Error("expected a seeded driver");
    }
    const pool: readonly Driver[] = [...drivers, first];
    expect(() => {
      validateSeedData(pool, teams, season1980);
    }).toThrow(`Duplicate driver ids: ${first.id}`);
  });
});

function carSpec() {
  return { racing: 50, qualifying: 50, consistency: 50, reliability: 50 };
}
