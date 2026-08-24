import { describe, expect, it } from "vitest";
import {
  type Driver,
  drivers,
  driversById,
  engines,
  enginesById,
  FIRST_AUTHORED_SEASON,
  type SeasonSeed,
  seasonSeed,
  seasons,
  teams,
  teamsById,
  validateSeedData,
} from "./index.js";

/** One authored season, as a fixture. Which one is not the point. */
const SEED = seasonSeed(FIRST_AUTHORED_SEASON);

describe("seed data", () => {
  it("loads a pool, a paddock and a season", () => {
    // Counts are deliberately not asserted: the grid grows, and a test that
    // says "41 drivers" fails for a reason that is not a bug.
    expect(drivers.length).toBeGreaterThan(0);
    expect(teams.length).toBeGreaterThan(0);
    expect(SEED.year).toBe(FIRST_AUTHORED_SEASON);
    expect(SEED.entries.length).toBeGreaterThan(0);
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
const knownEngine = engines[0]?.id ?? "";

describe("validateSeedData", () => {
  it("accepts the bundled seed", () => {
    expect(() => {
      validateSeedData();
    }).not.toThrow();
  });

  it("numbers every authored calendar in order, with every round named", () => {
    expect(seasons.size).toBeGreaterThan(0);
    for (const season of seasons.values()) {
      expect(season.calendar.length, `${season.year}`).toBeGreaterThan(0);
      expect(
        season.calendar.map((race) => race.round),
        `${season.year}`,
      ).toEqual(season.calendar.map((_, index) => index + 1));
      for (const race of season.calendar) {
        expect(race.name.trim(), `${season.year} round ${race.round}`).not.toBe("");
        expect(race.circuit.trim(), `${season.year} round ${race.round}`).not.toBe("");
      }
    }
  });

  it("allows seatless drivers and single-car entries", () => {
    // The rule, against a fixture — not a season that happens to have a
    // one-car team today. Whether any authored year has one is data, and the
    // point here is that validation permits it.
    const seatless: SeasonSeed = {
      year: 1980,
      calendar: [],
      engines: [engineSpec()],
      entries: [
        { teamId: knownTeam, engineId: knownEngine, car: carSpec(), drivers: [knownDriver] },
      ],
    };
    expect(() => {
      validateSeedData(drivers, teams, [seatless]);
    }).not.toThrow();
    const seated = new Set(SEED.entries.flatMap((entry) => entry.drivers));
    expect(seated.size).toBeLessThan(drivers.length);
  });

  it("lets a driver hold a seat in more than one season", () => {
    // The one-seat rule is per season. A career spanning years is the point of
    // the whole thing, and validation that forbade it would be nonsense.
    const seatsPerSeason = [...seasons.values()].map(
      (season) => new Set(season.entries.flatMap((entry) => entry.drivers)),
    );
    if (seatsPerSeason.length < 2) {
      return;
    }
    const [first, ...rest] = seatsPerSeason;
    const returning = [...(first ?? [])].filter((id) => rest.some((other) => other.has(id)));
    expect(returning.length, "no driver appears in two seasons").toBeGreaterThan(0);
  });

  it("rejects an entry referencing an unknown driver", () => {
    const broken: SeasonSeed = {
      year: 1980,
      calendar: [],
      engines: [engineSpec()],
      entries: [{ teamId: knownTeam, engineId: knownEngine, car: carSpec(), drivers: ["ghost"] }],
    };
    expect(() => {
      validateSeedData(drivers, teams, [broken]);
    }).toThrow(/unknown driver "ghost"/);
  });

  it("rejects an entry referencing an unknown team", () => {
    const broken: SeasonSeed = {
      year: 1980,
      calendar: [],
      engines: [engineSpec()],
      entries: [
        { teamId: "phantom", engineId: knownEngine, car: carSpec(), drivers: [knownDriver] },
      ],
    };
    expect(() => {
      validateSeedData(drivers, teams, [broken]);
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
      engines: [engineSpec()],
      entries: [],
    };
    expect(() => {
      validateSeedData(drivers, teams, [broken]);
    }).toThrow(/round 3 sits at position 2/);
  });

  it("rejects a calendar race whose country is not an ISO alpha-2 code", () => {
    const broken: SeasonSeed = {
      year: 1980,
      calendar: [{ round: 1, name: "Argentine GP", circuit: "Buenos Aires", country: "ARG" }],
      engines: [engineSpec()],
      entries: [],
    };
    expect(() => {
      validateSeedData(drivers, teams, [broken]);
    }).toThrow(/not an ISO alpha-2 code/);
  });

  it("rejects a calendar race with no name or no circuit", () => {
    const withName = (name: string, circuit: string): SeasonSeed => ({
      year: 1980,
      calendar: [{ round: 1, name, circuit, country: "AR" }],
      engines: [engineSpec()],
      entries: [],
    });
    expect(() => {
      validateSeedData(drivers, teams, [withName("  ", "Buenos Aires")]);
    }).toThrow(/missing a name or circuit/);
    expect(() => {
      validateSeedData(drivers, teams, [withName("Argentine GP", "")]);
    }).toThrow(/missing a name or circuit/);
  });

  it("rejects a driver seated at two teams", () => {
    const broken: SeasonSeed = {
      year: 1980,
      calendar: [],
      engines: [engineSpec()],
      entries: [
        { teamId: knownTeam, engineId: knownEngine, car: carSpec(), drivers: [knownDriver] },
        { teamId: otherTeam, engineId: knownEngine, car: carSpec(), drivers: [knownDriver] },
      ],
    };
    expect(() => {
      validateSeedData(drivers, teams, [broken]);
    }).toThrow(/seated at both/);
  });

  it("rejects duplicate driver ids in the pool", () => {
    const first = drivers[0];
    if (first === undefined) {
      throw new Error("expected a seeded driver");
    }
    const pool: readonly Driver[] = [...drivers, first];
    expect(() => {
      validateSeedData(pool, teams, [SEED]);
    }).toThrow(`Duplicate driver ids: ${first.id}`);
  });
});

function carSpec() {
  return { racing: 50, qualifying: 50, consistency: 50, reliability: 50 };
}

/** The season menu every fixture entry draws its engine from. */
function engineSpec() {
  return { engineId: knownEngine, racing: 50, qualifying: 50, reliability: 50 };
}

describe("engines", () => {
  it("loads a pool of manufacturers and indexes them by id", () => {
    expect(engines.length).toBeGreaterThan(0);
    for (const maker of engines) {
      expect(enginesById().get(maker.id), maker.id).toBe(maker);
    }
    expect(enginesById().get("nobody")).toBeUndefined();
  });

  it("rates at least one engine in every authored season, and every entry runs one", () => {
    for (const season of seasons.values()) {
      expect(season.engines.length, `${season.year}`).toBeGreaterThan(0);
      const rated = new Set(season.engines.map((engine) => engine.engineId));
      for (const entry of season.entries) {
        expect(rated.has(entry.engineId), `${season.year} ${entry.teamId}`).toBe(true);
      }
    }
  });

  it("rejects a season rating an engine nobody makes", () => {
    const broken: SeasonSeed = {
      year: 1980,
      calendar: [],
      engines: [{ engineId: "phlogiston", racing: 50, qualifying: 50, reliability: 50 }],
      entries: [],
    };
    expect(() => {
      validateSeedData(drivers, teams, [broken]);
    }).toThrow(/unknown engine "phlogiston"/);
  });

  it("rejects an entry running an engine the season does not rate", () => {
    const broken: SeasonSeed = {
      year: 1980,
      calendar: [],
      engines: [],
      entries: [
        { teamId: knownTeam, engineId: knownEngine, car: carSpec(), drivers: [knownDriver] },
      ],
    };
    expect(() => {
      validateSeedData(drivers, teams, [broken]);
    }).toThrow(/which the season does not rate/);
  });

  it("rejects the same engine rated twice in one season", () => {
    const broken: SeasonSeed = {
      year: 1980,
      calendar: [],
      engines: [engineSpec(), engineSpec()],
      entries: [],
    };
    expect(() => {
      validateSeedData(drivers, teams, [broken]);
    }).toThrow(/rates these engines twice/);
  });

  it("rejects duplicate manufacturer ids in the pool", () => {
    const first = engines[0];
    if (first === undefined) {
      throw new Error("expected a seeded engine manufacturer");
    }
    expect(() => {
      validateSeedData(drivers, teams, [SEED], [...engines, first]);
    }).toThrow(`Duplicate engine ids: ${first.id}`);
  });
});
