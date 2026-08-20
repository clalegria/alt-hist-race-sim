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
  it("loads every authored record", () => {
    expect(drivers).toHaveLength(41);
    expect(teams).toHaveLength(15);
    expect(season1980.year).toBe(1980);
    expect(season1980.entries).toHaveLength(15);
  });

  it("indexes drivers and teams by id", () => {
    expect(driversById().get("prost")?.name).toBe("Alain Prost");
    expect(teamsById().get("ferrari")?.base).toBe("IT");
    expect(driversById().get("nobody")).toBeUndefined();
  });

  it("keeps nominal career values as authored", () => {
    const villeneuve = driversById().get("villeneuve_g");
    expect(villeneuve?.debutSeason).toBe(1977);
    expect(villeneuve?.peak.season).toBe(1981);
    expect(villeneuve?.peak.composure).toBe(62);
  });
});

describe("validateSeedData", () => {
  it("accepts the bundled seed", () => {
    expect(() => {
      validateSeedData();
    }).not.toThrow();
  });

  it("carries the fourteen rounds of the real 1980 season", () => {
    expect(season1980.calendar).toHaveLength(14);
    expect(season1980.calendar.map((race) => race.round)).toEqual(
      Array.from({ length: 14 }, (_, i) => i + 1),
    );
    expect(season1980.calendar[0]?.name).toBe("Argentine Grand Prix");
    expect(season1980.calendar[13]?.circuit).toBe("Watkins Glen");
    // 1980 ran the Italian Grand Prix at Imola, not Monza — the one year it did.
    expect(season1980.calendar[11]).toEqual({
      round: 12,
      name: "Italian Grand Prix",
      circuit: "Imola",
    });
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
      entries: [{ teamId: "ferrari", car: carSpec(), drivers: ["ghost"] }],
    };
    expect(() => {
      validateSeedData(drivers, teams, broken);
    }).toThrow(/unknown driver "ghost"/);
  });

  it("rejects an entry referencing an unknown team", () => {
    const broken: SeasonSeed = {
      year: 1980,
      calendar: [],
      entries: [{ teamId: "phantom", car: carSpec(), drivers: ["prost"] }],
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
        { round: 1, name: "Argentine Grand Prix", circuit: "Buenos Aires" },
        { round: 3, name: "Brazilian Grand Prix", circuit: "Interlagos" },
      ],
      entries: [],
    };
    expect(() => {
      validateSeedData(drivers, teams, broken);
    }).toThrow(/round 3 sits at position 2/);
  });

  it("rejects a calendar race with no name or no circuit", () => {
    const withName = (name: string, circuit: string): SeasonSeed => ({
      year: 1980,
      calendar: [{ round: 1, name, circuit }],
      entries: [],
    });
    expect(() => {
      validateSeedData(drivers, teams, withName("  ", "Buenos Aires"));
    }).toThrow(/missing a name or circuit/);
    expect(() => {
      validateSeedData(drivers, teams, withName("Argentine Grand Prix", ""));
    }).toThrow(/missing a name or circuit/);
  });

  it("rejects a driver seated at two teams", () => {
    const broken: SeasonSeed = {
      year: 1980,
      calendar: [],
      entries: [
        { teamId: "ferrari", car: carSpec(), drivers: ["prost"] },
        { teamId: "mclaren", car: carSpec(), drivers: ["prost"] },
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
    }).toThrow(/Duplicate driver ids: jones/);
  });
});

function carSpec() {
  return { racing: 50, qualifying: 50, consistency: 50, reliability: 50 };
}
