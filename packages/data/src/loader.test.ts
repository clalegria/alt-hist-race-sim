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

  it("gives every authored season a points scale that only ever falls", () => {
    // The rule, not the eras: which scale a year pays is history and lives in
    // its own file, but *every* year must pay a winner something and must never
    // pay a lower place more than a higher one.
    expect(seasons.size).toBeGreaterThan(0);
    for (const season of seasons.values()) {
      expect(season.points.length, `${season.year}`).toBeGreaterThan(0);
      expect(season.points[0] ?? 0, `${season.year} pays nothing for a win`).toBeGreaterThan(0);
      for (const [index, points] of season.points.entries()) {
        expect(points, `${season.year} position ${index + 1}`).toBeGreaterThanOrEqual(0);
        expect(points, `${season.year} position ${index + 1}`).toBeLessThanOrEqual(
          season.points[index - 1] ?? Number.POSITIVE_INFINITY,
        );
      }
    }
  });

  it("rejects a season with no points scale", () => {
    const broken: SeasonSeed = {
      year: 1980,
      points: [],
      calendar: [],
      engines: [engineSpec()],
      entries: [],
    };
    expect(() => {
      validateSeedData(drivers, teams, [broken]);
    }).toThrow(/no points scale/);
  });

  it("rejects a scale that pays a lower place more than a higher one", () => {
    const broken: SeasonSeed = {
      year: 1980,
      points: [9, 6, 4, 5],
      calendar: [],
      engines: [engineSpec()],
      entries: [],
    };
    expect(() => {
      validateSeedData(drivers, teams, [broken]);
    }).toThrow(/must never rise/);
  });

  it("rejects negative points", () => {
    const broken: SeasonSeed = {
      year: 1980,
      points: [9, 6, -1],
      calendar: [],
      engines: [engineSpec()],
      entries: [],
    };
    expect(() => {
      validateSeedData(drivers, teams, [broken]);
    }).toThrow(/non-negative/);
  });

  it("allows seatless drivers and single-car entries", () => {
    // The rule, against a fixture — not a season that happens to have a
    // one-car team today. Whether any authored year has one is data, and the
    // point here is that validation permits it.
    const seatless: SeasonSeed = {
      year: 1980,
      points: pointsScale(),
      calendar: [],
      engines: [engineSpec()],
      entries: [
        {
          teamId: knownTeam,
          engineId: knownEngine,
          chassis: chassisSpec(),
          drivers: [knownDriver],
        },
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
      points: pointsScale(),
      calendar: [],
      engines: [engineSpec()],
      entries: [
        { teamId: knownTeam, engineId: knownEngine, chassis: chassisSpec(), drivers: ["ghost"] },
      ],
    };
    expect(() => {
      validateSeedData(drivers, teams, [broken]);
    }).toThrow(/unknown driver "ghost"/);
  });

  it("rejects an entry referencing an unknown team", () => {
    const broken: SeasonSeed = {
      year: 1980,
      points: pointsScale(),
      calendar: [],
      engines: [engineSpec()],
      entries: [
        {
          teamId: "phantom",
          engineId: knownEngine,
          chassis: chassisSpec(),
          drivers: [knownDriver],
        },
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
      points: pointsScale(),
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
      points: pointsScale(),
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
      points: pointsScale(),
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
      points: pointsScale(),
      calendar: [],
      engines: [engineSpec()],
      entries: [
        {
          teamId: knownTeam,
          engineId: knownEngine,
          chassis: chassisSpec(),
          drivers: [knownDriver],
        },
        {
          teamId: otherTeam,
          engineId: knownEngine,
          chassis: chassisSpec(),
          drivers: [knownDriver],
        },
      ],
    };
    expect(() => {
      validateSeedData(drivers, teams, [broken]);
    }).toThrow(/seated at both/);
  });

  /**
   * The season half of what `type-checks.ts` does for the pools, and the reason
   * it moved: a season is discovered from disk, so a compile-time check means
   * naming its file — and the next year authored would be the one nobody
   * checked. These run over every season on disk instead.
   *
   * Each case is a real authoring slip: a rating that never made it into the
   * file, one typed as text, one out of range, and a field somebody added that
   * nothing reads. All four look like data and none of them would surface as an
   * error — they would surface as a car that is quietly wrong.
   */
  it("rejects a chassis or engine rating that is missing, not a number, or out of range", () => {
    const withChassis = (chassis: Record<string, unknown>): SeasonSeed => ({
      year: 1980,
      points: pointsScale(),
      calendar: [{ round: 1, name: "Argentine GP", circuit: "Buenos Aires", country: "AR" }],
      engines: [engineSpec()],
      entries: [
        { teamId: knownTeam, engineId: knownEngine, chassis, drivers: [] },
      ] as unknown as SeasonSeed["entries"],
    });
    const { racing: _dropped, ...noRacing } = chassisSpec();
    expect(() => {
      validateSeedData(drivers, teams, [withChassis(noRacing)]);
    }).toThrow(/racing "undefined"; every rating must be a number/);
    expect(() => {
      validateSeedData(drivers, teams, [withChassis({ ...chassisSpec(), qualifying: "quick" })]);
    }).toThrow(/every rating must be a number/);
    expect(() => {
      validateSeedData(drivers, teams, [withChassis({ ...chassisSpec(), reliability: 140 })]);
    }).toThrow(/ratings run from 0 to 100/);

    const badEngine: SeasonSeed = {
      year: 1980,
      points: pointsScale(),
      calendar: [{ round: 1, name: "Argentine GP", circuit: "Buenos Aires", country: "AR" }],
      engines: [{ ...engineSpec(), reliability: -1 }],
      entries: [],
    };
    expect(() => {
      validateSeedData(drivers, teams, [badEngine]);
    }).toThrow(/ratings run from 0 to 100/);
  });

  it("rejects a season, entry, chassis, engine or round carrying a field nothing reads", () => {
    // Built loose and cast once, because the whole point of each case is a
    // field the type does not have: a typed fixture cannot express one.
    const withExtra = (place: string, key: string): SeasonSeed => {
      const season: Record<string, unknown> = {
        year: 1980,
        points: pointsScale(),
        calendar: [{ round: 1, name: "Argentine GP", circuit: "Buenos Aires", country: "AR" }],
        engines: [engineSpec()],
        entries: [
          { teamId: knownTeam, engineId: knownEngine, chassis: chassisSpec(), drivers: [] },
        ],
      };
      const targets: Record<string, Record<string, unknown>> = {
        season,
        entry: (season.entries as Record<string, unknown>[])[0] ?? {},
        chassis: ((season.entries as Record<string, unknown>[])[0]?.chassis ?? {}) as Record<
          string,
          unknown
        >,
        engine: (season.engines as Record<string, unknown>[])[0] ?? {},
        round: (season.calendar as Record<string, unknown>[])[0] ?? {},
      };
      (targets[place] ?? {})[key] = 1;
      return season as unknown as SeasonSeed;
    };

    expect(() => {
      validateSeedData(drivers, teams, [withExtra("season", "notes")]);
    }).toThrow(/Season 1980 has fields nothing reads: notes/);
    expect(() => {
      validateSeedData(drivers, teams, [withExtra("entry", "budget")]);
    }).toThrow(/entry "[^"]+" has fields nothing reads: budget/);
    expect(() => {
      validateSeedData(drivers, teams, [withExtra("chassis", "downforce")]);
    }).toThrow(/chassis has fields nothing reads: downforce/);
    expect(() => {
      validateSeedData(drivers, teams, [withExtra("engine", "consistency")]);
    }).toThrow(/engine "[^"]+" has fields nothing reads: consistency/);
    expect(() => {
      validateSeedData(drivers, teams, [withExtra("round", "laps")]);
    }).toThrow(/round 1 has fields nothing reads: laps/);
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

function chassisSpec() {
  return { racing: 50, qualifying: 50, consistency: 50, reliability: 50 };
}

/** A scale for fixtures that are not about the scale. Shape, not history. */
function pointsScale() {
  return [9, 6, 4, 3, 2, 1];
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
      points: pointsScale(),
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
      points: pointsScale(),
      calendar: [],
      engines: [],
      entries: [
        {
          teamId: knownTeam,
          engineId: knownEngine,
          chassis: chassisSpec(),
          drivers: [knownDriver],
        },
      ],
    };
    expect(() => {
      validateSeedData(drivers, teams, [broken]);
    }).toThrow(/which the season does not rate/);
  });

  it("rejects the same engine rated twice in one season", () => {
    const broken: SeasonSeed = {
      year: 1980,
      points: pointsScale(),
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
