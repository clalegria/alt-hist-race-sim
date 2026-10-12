/**
 * Run settings: the points tables offered, and what is accepted back from
 * storage. Every table is read off the seed data rather than written down.
 */

import {
  AGE_RANGE,
  ARRANGEMENT_KINDS,
  drivers,
  driversWithoutCareerEvents,
  flatTrends,
  randomChassis,
  randomEngines,
  randomTrends,
  variedChassis,
  variedEngines,
} from "@alt-hist/data";
import { createRng, deriveSeed } from "@alt-hist/engine";
import { describe, expect, it } from "vitest";
import {
  ARRANGEMENT_LABELS,
  BREAKDOWNS_LABELS,
  CAR_PERFORMANCE_STREAM,
  CAR_VARIATION_BASES,
  CAR_VARIATION_SPREADS,
  DEVELOPMENT_STREAM,
  driverPoolOf,
  ENGINE_PERFORMANCE_STREAM,
  emptySeatRules,
  enginesWalkFromLastYear,
  HISTORICAL_SETTINGS,
  historicalSettings,
  OPENING_DRIVER_POOL,
  OPENING_TEAMS,
  parseRunSettings,
  pointsTableOf,
  pointsTables,
  pointsValues,
  type RunSettings,
  rememberedAfterSeason,
  rolledChassisOf,
  rolledEnginesOf,
  samePoints,
  seasonSettings,
  seatingArrangement,
  settingsInForce,
  trendsOf,
  walksFromLastYear,
  whatIfsOf,
} from "./run-settings.js";
import { FIRST_SEASON, PLAYABLE_SEASONS, seasonSeed } from "./seasons.js";

describe("the points tables offered", () => {
  it("lists each table once", () => {
    const tables = pointsTables();
    for (const [i, a] of tables.entries()) {
      for (const b of tables.slice(i + 1)) {
        expect(samePoints(a.scale, b.scale), a.label).toBe(false);
      }
    }
  });

  it("includes every playable year's own table, labelled with that year", () => {
    for (const year of PLAYABLE_SEASONS) {
      const table = pointsTableOf(year);
      expect(table, `${year}`).toBeDefined();
      expect(samePoints(table?.scale ?? [], seasonSeed(year).points)).toBe(true);
      const spans = (table?.years ?? "").split(", ").map((span) => span.split("–").map(Number));
      expect(
        spans.some(([from, to]) => from !== undefined && year >= from && year <= (to ?? from)),
        `${year} in ${table?.years}`,
      ).toBe(true);
    }
  });

  it("labels a table by its years, then its values", () => {
    for (const table of pointsTables()) {
      expect(table.label).toBe(`${table.years} · ${pointsValues(table.scale)}`);
    }
  });
});

describe("parsing stored settings", () => {
  it("accepts each year's own, and every table offered", () => {
    expect(parseRunSettings(HISTORICAL_SETTINGS)).toEqual(HISTORICAL_SETTINGS);
    for (const table of pointsTables()) {
      const settings = { ...HISTORICAL_SETTINGS, points: table.scale };
      // Through JSON, as storage hands it back: equal by value, not identity.
      expect(parseRunSettings(JSON.parse(JSON.stringify(settings)))).toEqual(settings);
    }
  });

  it("accepts both Breakdowns what-ifs and every playable year's reliability", () => {
    for (const breakdowns of ["fewer", "none"] as const) {
      const settings = { ...HISTORICAL_SETTINGS, breakdowns };
      expect(parseRunSettings(settings)).toEqual(settings);
    }
    for (const reliability of PLAYABLE_SEASONS) {
      const settings = { ...HISTORICAL_SETTINGS, reliability };
      expect(parseRunSettings(settings)).toEqual(settings);
    }
  });

  it("accepts Car performance: Random, and Varied at every spread and base offered", () => {
    const random = { ...HISTORICAL_SETTINGS, carPerformance: { kind: "random" } };
    expect(parseRunSettings(random)).toEqual(random);
    for (const spread of CAR_VARIATION_SPREADS) {
      for (const from of CAR_VARIATION_BASES) {
        const varied = {
          ...HISTORICAL_SETTINGS,
          carPerformance: { kind: "varied", spread, from },
        };
        expect(parseRunSettings(varied)).toEqual(varied);
      }
    }
  });

  it("accepts Career events: None", () => {
    const settings = { ...HISTORICAL_SETTINGS, careerEvents: "none" };
    expect(parseRunSettings(settings)).toEqual(settings);
  });

  it("accepts Team names: Keep the first", () => {
    const settings = { ...HISTORICAL_SETTINGS, teamNames: "first" };
    expect(parseRunSettings(settings)).toEqual(settings);
  });

  it("accepts Livery and Engine supplier changes: No, and both In-season development what-ifs", () => {
    for (const settings of [
      { ...HISTORICAL_SETTINGS, liveries: "first" },
      { ...HISTORICAL_SETTINGS, engineSuppliers: "first" },
      { ...HISTORICAL_SETTINGS, development: "random" },
      { ...HISTORICAL_SETTINGS, development: "none" },
    ]) {
      expect(parseRunSettings(settings), JSON.stringify(settings)).toEqual(settings);
    }
  });

  it("accepts Engine performance: Random, and Varied at every spread and base offered", () => {
    expect(
      parseRunSettings({ ...HISTORICAL_SETTINGS, enginePerformance: { kind: "random" } }),
    ).not.toBeNull();
    for (const spread of CAR_VARIATION_SPREADS) {
      for (const from of CAR_VARIATION_BASES) {
        const settings = {
          ...HISTORICAL_SETTINGS,
          enginePerformance: { kind: "varied", spread, from },
        };
        expect(parseRunSettings(settings)).toEqual(settings);
      }
    }
  });

  it("accepts Teams under both fills, every seating rule, and any pool the range holds", () => {
    const answers: Partial<RunSettings>[] = [
      { teams: OPENING_TEAMS },
      { teams: { fill: "best" } },
      ...ARRANGEMENT_KINDS.flatMap((kind) => [
        { seating: { kind, includeUnemployed: false } },
        { seating: { kind, includeUnemployed: true } },
      ]),
      { driverPool: { ...OPENING_DRIVER_POOL, activeOnly: false } },
      { driverPool: { minAge: AGE_RANGE.min, maxAge: AGE_RANGE.max, activeOnly: true } },
      { driverPool: { minAge: 30, maxAge: 30, activeOnly: true } },
    ];
    for (const answer of answers) {
      const settings = { ...HISTORICAL_SETTINGS, ...answer };
      expect(parseRunSettings(settings), JSON.stringify(answer)).toEqual(settings);
    }
  });

  it("reads the shape from before Teams, Who drives where and the pool split", () => {
    const { teams: _teams, seating: _seating, driverPool: _pool, ...before } = HISTORICAL_SETTINGS;
    expect(parseRunSettings({ ...before, teamsAndSeats: null })).toEqual(HISTORICAL_SETTINGS);
    expect(
      parseRunSettings({
        ...before,
        teamsAndSeats: { fill: "best", minAge: 20, maxAge: 35, activeOnly: false },
      }),
    ).toEqual({
      ...HISTORICAL_SETTINGS,
      teams: { fill: "best" },
      driverPool: { minAge: 20, maxAge: 35, activeOnly: false },
    });
    expect(parseRunSettings({ ...before, teamsAndSeats: { fill: "nobody" } })).toBeNull();
  });

  it("refuses anything else", () => {
    const table = pointsTables()[0]?.scale ?? [];
    const { teams: _teams, ...withoutTeams } = HISTORICAL_SETTINGS;
    const { seating: _seating, ...withoutSeating } = HISTORICAL_SETTINGS;
    const { driverPool: _pool, ...withoutPool } = HISTORICAL_SETTINGS;
    const {
      enginePerformance: _engines,
      development: _development,
      liveries: _liveries,
      engineSuppliers: _suppliers,
      ...beforeEngines
    } = HISTORICAL_SETTINGS;
    const pool = (changes: Record<string, unknown>) => ({
      ...HISTORICAL_SETTINGS,
      driverPool: { ...OPENING_DRIVER_POOL, ...changes },
    });
    const junk: unknown[] = [
      null,
      undefined,
      "x",
      [],
      {},
      { points: "own" },
      { points: 10 },
      { points: [] },
      // A table nobody authored: one more point for the winner of the first.
      { points: table.map((points, index) => (index === 0 ? points + 1 : points)) },
      { points: [...table, 0.5] },
      // Settings from before Breakdowns and Reliability, and each field wrong in turn.
      { points: null },
      { ...HISTORICAL_SETTINGS, breakdowns: "realistic" },
      { ...HISTORICAL_SETTINGS, breakdowns: "None" },
      { ...HISTORICAL_SETTINGS, reliability: FIRST_SEASON - 1 },
      { ...HISTORICAL_SETTINGS, reliability: (PLAYABLE_SEASONS[0] ?? 0) + 0.5 },
      { ...HISTORICAL_SETTINGS, reliability: String(PLAYABLE_SEASONS[0]) },
      // Settings from before Career events, and its historical answer spelled out.
      { breakdowns: null, reliability: null, points: null },
      { ...HISTORICAL_SETTINGS, careerEvents: "historical" },
      { ...HISTORICAL_SETTINGS, careerEvents: false },
      // Settings from before Team names, and its historical answer spelled out.
      { breakdowns: null, reliability: null, points: null, careerEvents: null },
      { ...HISTORICAL_SETTINGS, teamNames: "historical" },
      { ...HISTORICAL_SETTINGS, teamNames: true },
      // Settings from before Car performance, and its answers misspelled.
      { ...HISTORICAL_SETTINGS, carPerformance: undefined },
      { ...HISTORICAL_SETTINGS, carPerformance: "random" },
      { ...HISTORICAL_SETTINGS, carPerformance: { kind: "historical" } },
      { ...HISTORICAL_SETTINGS, carPerformance: { kind: "varied" } },
      { ...HISTORICAL_SETTINGS, carPerformance: { kind: "varied", spread: 7, from: "real" } },
      { ...HISTORICAL_SETTINGS, carPerformance: { kind: "varied", spread: "10", from: "real" } },
      // Varied from before its base, and a base it does not offer.
      { ...HISTORICAL_SETTINGS, carPerformance: { kind: "varied", spread: 10 } },
      { ...HISTORICAL_SETTINGS, carPerformance: { kind: "varied", spread: 10, from: "first" } },
      { ...HISTORICAL_SETTINGS, carPerformance: { kind: "varied", spread: 10, from: null } },
      { ...HISTORICAL_SETTINGS, carPerformance: [] },
      // Each of Teams, Who drives where and the pool missing, and each wrong
      // in turn: a fill or a rule nobody offers, and ages outside the range,
      // crossed or fractional.
      withoutTeams,
      withoutSeating,
      withoutPool,
      { ...HISTORICAL_SETTINGS, teams: "first" },
      { ...HISTORICAL_SETTINGS, teams: { fill: "nobody" } },
      { ...HISTORICAL_SETTINGS, teams: { fill: "Last" } },
      { ...HISTORICAL_SETTINGS, seating: "random" },
      { ...HISTORICAL_SETTINGS, seating: { kind: "slowest", includeUnemployed: false } },
      { ...HISTORICAL_SETTINGS, seating: { kind: "random" } },
      { ...HISTORICAL_SETTINGS, seating: { kind: "random", includeUnemployed: "yes" } },
      { ...HISTORICAL_SETTINGS, driverPool: null },
      pool({ minAge: AGE_RANGE.min - 1 }),
      pool({ maxAge: AGE_RANGE.max + 1 }),
      pool({ minAge: 40, maxAge: 30 }),
      pool({ maxAge: 40.5 }),
      pool({ activeOnly: "yes" }),
      pool({ activeOnly: undefined }),
      // Settings from before Engine performance, In-season development, Livery
      // and Engine supplier changes, and each answer misspelled.
      beforeEngines,
      { ...HISTORICAL_SETTINGS, enginePerformance: "random" },
      { ...HISTORICAL_SETTINGS, enginePerformance: { kind: "varied", spread: 7, from: "real" } },
      { ...HISTORICAL_SETTINGS, development: "historical" },
      { ...HISTORICAL_SETTINGS, development: "off" },
      { ...HISTORICAL_SETTINGS, liveries: "historical" },
      { ...HISTORICAL_SETTINGS, liveries: true },
      { ...HISTORICAL_SETTINGS, engineSuppliers: "last" },
    ];
    for (const raw of junk) {
      expect(parseRunSettings(raw), JSON.stringify(raw)).toBeNull();
    }
  });
});

describe("the settings in force", () => {
  const year = PLAYABLE_SEASONS[0] ?? 0;

  it("drops Reliability under Breakdowns: None, where no car can break down", () => {
    expect(
      settingsInForce({ ...HISTORICAL_SETTINGS, breakdowns: "none", reliability: year }),
    ).toEqual({ ...HISTORICAL_SETTINGS, breakdowns: "none" });
  });

  it("keeps it under every other answer", () => {
    for (const breakdowns of [null, "fewer"] as const) {
      const settings = { ...HISTORICAL_SETTINGS, breakdowns, reliability: year };
      expect(settingsInForce(settings)).toBe(settings);
    }
  });

  const narrow = { minAge: 25, maxAge: 30, activeOnly: false };
  const shuffled = { kind: "random", includeUnemployed: false } as const;

  it("signs the best available for the kept teams under a reseat, which moves everyone", () => {
    const settings = { ...HISTORICAL_SETTINGS, teams: OPENING_TEAMS, seating: shuffled };
    expect(settingsInForce(settings).teams).toEqual({ fill: "best" });
    const alone = { ...HISTORICAL_SETTINGS, teams: OPENING_TEAMS };
    expect(settingsInForce(alone)).toBe(alone);
  });

  it("puts the pool back on its opening answer while nothing signs drivers", () => {
    for (const seating of [null, shuffled]) {
      expect(
        settingsInForce({ ...HISTORICAL_SETTINGS, seating, driverPool: narrow }).driverPool,
      ).toEqual(OPENING_DRIVER_POOL);
    }
  });

  it("keeps the pool while kept teams or a reseat sign from it", () => {
    for (const signing of [
      { teams: OPENING_TEAMS },
      { seating: { ...shuffled, includeUnemployed: true } },
    ]) {
      const settings = { ...HISTORICAL_SETTINGS, ...signing, driverPool: narrow };
      expect(settingsInForce(settings), JSON.stringify(signing)).toBe(settings);
    }
  });

  it("hands the kept grid its fill with the pool, and the reseat the pool as its filters", () => {
    const settings = {
      ...HISTORICAL_SETTINGS,
      teams: OPENING_TEAMS,
      seating: shuffled,
      driverPool: narrow,
    };
    expect(emptySeatRules(settings)).toEqual({ ...narrow, fill: OPENING_TEAMS.fill });
    expect(seatingArrangement(settings)).toEqual({
      ...shuffled,
      filters: { hideRetired: false, hideFuture: false, minAge: 25, maxAge: 30 },
    });
    expect(emptySeatRules(HISTORICAL_SETTINGS)).toBeNull();
    expect(seatingArrangement(HISTORICAL_SETTINGS)).toBeNull();
  });
});

describe("a standalone season's settings", () => {
  it("keeps Who drives where and the pool, which a season offers too", () => {
    const settings = {
      ...HISTORICAL_SETTINGS,
      seating: { kind: "fastest-in-slowest", includeUnemployed: true },
      driverPool: { minAge: 20, maxAge: 40, activeOnly: false },
    } as const;
    expect(seasonSettings(settings)).toBe(settings);
  });

  it("drops Career events and Team names, which only an era offers", () => {
    const era = {
      ...HISTORICAL_SETTINGS,
      carPerformance: { kind: "random" },
      breakdowns: "fewer",
      careerEvents: "none",
      teamNames: "first",
    } as const;
    expect(seasonSettings(era)).toEqual({ ...era, careerEvents: null, teamNames: null });
    expect(seasonSettings({ ...HISTORICAL_SETTINGS, teamNames: "first" })).toEqual(
      HISTORICAL_SETTINGS,
    );
    expect(seasonSettings({ ...HISTORICAL_SETTINGS, teams: OPENING_TEAMS })).toEqual(
      HISTORICAL_SETTINGS,
    );
    for (const changes of [{ liveries: "first" }, { engineSuppliers: "first" }] as const) {
      expect(seasonSettings({ ...HISTORICAL_SETTINGS, ...changes })).toEqual(HISTORICAL_SETTINGS);
    }
  });

  it("varies an engine walk off the real engine too", () => {
    const walk = {
      ...HISTORICAL_SETTINGS,
      enginePerformance: { kind: "varied", spread: 10, from: "last" },
    } as const;
    expect(seasonSettings(walk)).toEqual({
      ...walk,
      enginePerformance: { kind: "varied", spread: 10, from: "real" },
    });
  });

  it("varies a walk from previous year's car off the real one, which a season has no year before for", () => {
    const walk = {
      ...HISTORICAL_SETTINGS,
      breakdowns: "fewer",
      carPerformance: { kind: "varied", spread: 20, from: "last" },
    } as const;
    expect(seasonSettings(walk)).toEqual({
      ...walk,
      carPerformance: { kind: "varied", spread: 20, from: "real" },
    });
  });

  it("keeps every setting both screens offer", () => {
    for (const settings of [
      { ...HISTORICAL_SETTINGS, breakdowns: "fewer" },
      { ...HISTORICAL_SETTINGS, carPerformance: { kind: "varied", spread: 5, from: "real" } },
      { ...HISTORICAL_SETTINGS, carPerformance: { kind: "random" } },
      { ...HISTORICAL_SETTINGS, enginePerformance: { kind: "random" } },
      { ...HISTORICAL_SETTINGS, development: "random" },
    ] as const) {
      expect(seasonSettings(settings)).toBe(settings);
    }
  });
});

describe("restoring the defaults", () => {
  const whatIfs = {
    carPerformance: { kind: "varied", spread: 5, from: "last" },
    enginePerformance: { kind: "varied", spread: 20, from: "last" },
    development: "none",
    breakdowns: "fewer",
    reliability: FIRST_SEASON,
    points: [3, 2, 1],
    careerEvents: "none",
    teamNames: "first",
    liveries: "first",
    engineSuppliers: "first",
    teams: OPENING_TEAMS,
    seating: { kind: "random", includeUnemployed: true },
    driverPool: { minAge: 20, maxAge: 30, activeOnly: false },
  } as const;

  it("puts every setting an era offers back on its historical answer", () => {
    expect(historicalSettings(whatIfs, true)).toEqual(HISTORICAL_SETTINGS);
  });

  it("keeps the era-only answers a season's screen does not show, and the pool they sign from", () => {
    expect(historicalSettings(whatIfs, false)).toEqual({
      ...HISTORICAL_SETTINGS,
      careerEvents: "none",
      teamNames: "first",
      liveries: "first",
      engineSuppliers: "first",
      teams: OPENING_TEAMS,
      driverPool: whatIfs.driverPool,
    });
    expect(historicalSettings({ ...whatIfs, teams: null }, false).driverPool).toEqual(
      OPENING_DRIVER_POOL,
    );
  });
});

describe("the drivers a run is rated from", () => {
  it("is the pool as authored, unless Career events is None", () => {
    expect(driverPoolOf(HISTORICAL_SETTINGS)).toBe(drivers);
    expect(driverPoolOf({ ...HISTORICAL_SETTINGS, careerEvents: "none" })).toBe(
      driversWithoutCareerEvents(),
    );
  });
});

describe("the cars a run races", () => {
  const season = seasonSeed(PLAYABLE_SEASONS[0] ?? 0);

  it("rolls nothing when Historical", () => {
    expect(rolledChassisOf(season, HISTORICAL_SETTINGS, 5)).toBeNull();
  });

  it("rolls each answer from its own stream off the seed", () => {
    const stream = () => createRng(deriveSeed(5, CAR_PERFORMANCE_STREAM));
    expect(
      rolledChassisOf(season, { ...HISTORICAL_SETTINGS, carPerformance: { kind: "random" } }, 5),
    ).toEqual(randomChassis(season, stream()));
    expect(
      rolledChassisOf(
        season,
        { ...HISTORICAL_SETTINGS, carPerformance: { kind: "varied", spread: 20, from: "real" } },
        5,
      ),
    ).toEqual(variedChassis(season, 20, stream()));
  });

  it("walks off previous year's cars only when Varied says so", () => {
    const stream = () => createRng(deriveSeed(5, CAR_PERFORMANCE_STREAM));
    const lastRaced = rolledChassisOf(
      season,
      { ...HISTORICAL_SETTINGS, carPerformance: { kind: "random" } },
      9,
    );
    const varied = (from: "real" | "last") => ({
      ...HISTORICAL_SETTINGS,
      carPerformance: { kind: "varied", spread: 10, from } as const,
    });
    expect(rolledChassisOf(season, varied("last"), 5, lastRaced)).toEqual(
      variedChassis(season, 10, stream(), lastRaced),
    );
    expect(rolledChassisOf(season, varied("real"), 5, lastRaced)).toEqual(
      variedChassis(season, 10, stream()),
    );
    expect(
      rolledChassisOf(
        season,
        { ...HISTORICAL_SETTINGS, carPerformance: { kind: "random" } },
        5,
        lastRaced,
      ),
    ).toEqual(randomChassis(season, stream()));
    // A run's first year has no year before, and walks off its own cars.
    expect(rolledChassisOf(season, varied("last"), 5)).toEqual(variedChassis(season, 10, stream()));
  });

  it("says which answer walks", () => {
    expect(walksFromLastYear(HISTORICAL_SETTINGS)).toBe(false);
    expect(walksFromLastYear({ ...HISTORICAL_SETTINGS, carPerformance: { kind: "random" } })).toBe(
      false,
    );
    for (const from of CAR_VARIATION_BASES) {
      expect(
        walksFromLastYear({
          ...HISTORICAL_SETTINGS,
          carPerformance: { kind: "varied", spread: 5, from },
        }),
      ).toBe(from === "last");
    }
  });
});

describe("the engines and trends a run races", () => {
  const season = seasonSeed(PLAYABLE_SEASONS[0] ?? 0);
  const engines = (enginePerformance: RunSettings["enginePerformance"]): RunSettings => ({
    ...HISTORICAL_SETTINGS,
    enginePerformance,
  });

  it("rolls no engines when Historical", () => {
    expect(rolledEnginesOf(season, HISTORICAL_SETTINGS, 5)).toBeNull();
  });

  it("rolls each engine answer from its own stream, apart from the chassis' one", () => {
    const stream = () => createRng(deriveSeed(5, ENGINE_PERFORMANCE_STREAM));
    expect(ENGINE_PERFORMANCE_STREAM).not.toBe(CAR_PERFORMANCE_STREAM);
    expect(rolledEnginesOf(season, engines({ kind: "random" }), 5)).toEqual(
      randomEngines(season, stream()),
    );
    expect(
      rolledEnginesOf(season, engines({ kind: "varied", spread: 20, from: "real" }), 5),
    ).toEqual(variedEngines(season, 20, stream()));
  });

  it("walks off last year's engines only when Varied says so", () => {
    const stream = () => createRng(deriveSeed(5, ENGINE_PERFORMANCE_STREAM));
    const lastRaced = rolledEnginesOf(season, engines({ kind: "random" }), 9);
    expect(
      rolledEnginesOf(season, engines({ kind: "varied", spread: 10, from: "last" }), 5, lastRaced),
    ).toEqual(variedEngines(season, 10, stream(), lastRaced));
    expect(
      rolledEnginesOf(season, engines({ kind: "varied", spread: 10, from: "real" }), 5, lastRaced),
    ).toEqual(variedEngines(season, 10, stream()));
    expect(enginesWalkFromLastYear(engines({ kind: "varied", spread: 5, from: "last" }))).toBe(
      true,
    );
    expect(enginesWalkFromLastYear(engines({ kind: "varied", spread: 5, from: "real" }))).toBe(
      false,
    );
  });

  it("draws trends only under Random, on their own stream, and flattens them under Off", () => {
    expect(trendsOf(season, HISTORICAL_SETTINGS, 5)).toBeNull();
    expect(trendsOf(season, { ...HISTORICAL_SETTINGS, development: "none" }, 5)).toEqual(
      flatTrends(season),
    );
    expect(trendsOf(season, { ...HISTORICAL_SETTINGS, development: "random" }, 5)).toEqual(
      randomTrends(season, createRng(deriveSeed(5, DEVELOPMENT_STREAM))),
    );
  });
});

describe("the what-ifs a run states", () => {
  it("states nothing for a historical run", () => {
    expect(whatIfsOf(HISTORICAL_SETTINGS)).toEqual([]);
  });

  it("names a fixed points table by its values", () => {
    const scale = pointsTables()[0]?.scale ?? [];
    expect(whatIfsOf({ ...HISTORICAL_SETTINGS, points: scale })).toEqual([
      { name: "Points system", value: pointsValues(scale) },
    ]);
  });

  it("names Mechanical failures and Cars as reliable as, in the order the card lists them", () => {
    const year = PLAYABLE_SEASONS[0] ?? 0;
    expect(
      whatIfsOf({ ...HISTORICAL_SETTINGS, breakdowns: "fewer", reliability: year }).map(
        (line) => line.name,
      ),
    ).toEqual(["Mechanical failures", "Cars as reliable as"]);
    // Under None no car breaks down to be measured, so the year changes nothing.
    expect(
      whatIfsOf({ ...HISTORICAL_SETTINGS, breakdowns: "none", reliability: year }).map(
        (line) => line.name,
      ),
    ).toEqual(["Mechanical failures"]);
    expect(whatIfsOf({ ...HISTORICAL_SETTINGS, reliability: year })).toEqual([
      { name: "Cars as reliable as", value: String(year) },
    ]);
    expect(whatIfsOf({ ...HISTORICAL_SETTINGS, breakdowns: "fewer" })).toEqual([
      { name: "Mechanical failures", value: BREAKDOWNS_LABELS.fewer },
    ]);
  });

  it("names each Chassis performance answer", () => {
    expect(
      whatIfsOf({
        ...HISTORICAL_SETTINGS,
        carPerformance: { kind: "varied", spread: 10, from: "real" },
      }),
    ).toEqual([{ name: "Chassis performance", value: "Random factor ±10" }]);
    expect(
      whatIfsOf({
        ...HISTORICAL_SETTINGS,
        carPerformance: { kind: "varied", spread: 10, from: "last" },
      }),
    ).toEqual([
      { name: "Chassis performance", value: "Random factor ±10 from last year's chassis" },
    ]);
    expect(whatIfsOf({ ...HISTORICAL_SETTINGS, carPerformance: { kind: "random" } })).toEqual([
      { name: "Chassis performance", value: "Totally random" },
    ]);
  });

  it("names every what-if in the form's order: Races, Drivers, Cars, Over the years", () => {
    const scale = pointsTables()[0]?.scale ?? [];
    expect(
      whatIfsOf({
        ...HISTORICAL_SETTINGS,
        points: scale,
        seating: { kind: "random", includeUnemployed: true },
        driverPool: { ...OPENING_DRIVER_POOL, activeOnly: false },
        carPerformance: { kind: "random" },
        enginePerformance: { kind: "varied", spread: 5, from: "last" },
        development: "random",
        breakdowns: "fewer",
        careerEvents: "none",
        teamNames: "first",
        liveries: "first",
        engineSuppliers: "first",
        teams: OPENING_TEAMS,
      }).map((line) => line.name),
    ).toEqual([
      "Points system",
      "Who drives where",
      "Drivers who can be signed",
      "Driver career events",
      "Chassis performance",
      "Engine performance",
      "In-season development",
      "Mechanical failures",
      "Teams",
      "Team name changes",
      "Livery changes",
      "Engine supplier changes",
    ]);
    expect(
      whatIfsOf({
        ...HISTORICAL_SETTINGS,
        enginePerformance: { kind: "varied", spread: 5, from: "last" },
        development: "none",
      }),
    ).toEqual([
      { name: "Engine performance", value: "Random factor ±5 from last year's engine" },
      { name: "In-season development", value: "Off" },
    ]);
  });

  it("names the rule Who drives where reseats by", () => {
    for (const kind of ARRANGEMENT_KINDS) {
      expect(
        whatIfsOf({ ...HISTORICAL_SETTINGS, seating: { kind, includeUnemployed: false } }),
      ).toEqual([{ name: "Who drives where", value: ARRANGEMENT_LABELS[kind] }]);
    }
  });

  it("names the signing pool only when something signs and it is not the opening one", () => {
    const pool = { minAge: 20, maxAge: 30, activeOnly: false };
    const signing = { kind: "random", includeUnemployed: true } as const;
    const named = (settings: RunSettings) =>
      whatIfsOf(settings).some((line) => line.name === "Drivers who can be signed");
    expect(named({ ...HISTORICAL_SETTINGS, seating: signing, driverPool: pool })).toBe(true);
    expect(named({ ...HISTORICAL_SETTINGS, teams: OPENING_TEAMS, driverPool: pool })).toBe(true);
    // Nothing signs: a reseat of the drivers already seated, or no what-if at all.
    expect(
      named({
        ...HISTORICAL_SETTINGS,
        seating: { ...signing, includeUnemployed: false },
        driverPool: pool,
      }),
    ).toBe(false);
    expect(named({ ...HISTORICAL_SETTINGS, driverPool: pool })).toBe(false);
    // Something signs, from the pool it opens on.
    expect(named({ ...HISTORICAL_SETTINGS, seating: signing })).toBe(false);
    expect(
      whatIfsOf({ ...HISTORICAL_SETTINGS, seating: signing, driverPool: pool }).at(-1),
    ).toEqual({ name: "Drivers who can be signed", value: "Ages 20–30, from any year" });
    expect(
      whatIfsOf({
        ...HISTORICAL_SETTINGS,
        seating: signing,
        driverPool: { ...pool, activeOnly: true },
      }).at(-1)?.value,
    ).toBe("Ages 20–30, racing that year");
  });

  it("names Teams, with the fill only where the form shows it", () => {
    const teams = (settings: RunSettings) =>
      whatIfsOf(settings).find((line) => line.name === "Teams")?.value;
    expect(teams({ ...HISTORICAL_SETTINGS, teams: OPENING_TEAMS })).toBe("First season's");
    expect(teams({ ...HISTORICAL_SETTINGS, teams: { fill: "best" } })).toBe(
      "First season's · best available",
    );
    // Under a reseat the fill is hidden, and in force as the best available.
    expect(
      teams({
        ...HISTORICAL_SETTINGS,
        teams: { fill: "last" },
        seating: { kind: "random", includeUnemployed: false },
      }),
    ).toBe("First season's");
  });
});

describe("remembering a standalone season's settings", () => {
  const stored = {
    ...HISTORICAL_SETTINGS,
    carPerformance: { kind: "varied", spread: 10, from: "last" },
    enginePerformance: { kind: "varied", spread: 5, from: "last" },
    careerEvents: "none",
    teamNames: "first",
    liveries: "first",
    engineSuppliers: "first",
    teams: OPENING_TEAMS,
  } as const;

  it("keeps the era-only answers the season never showed", () => {
    const after = rememberedAfterSeason(stored, { ...seasonSettings(stored), breakdowns: "none" });
    expect(after.breakdowns).toBe("none");
    expect(after.careerEvents).toBe("none");
    expect(after.teamNames).toBe("first");
    expect(after.liveries).toBe("first");
    expect(after.engineSuppliers).toBe("first");
    expect(after.teams).toEqual(OPENING_TEAMS);
  });

  it("keeps an era's walk the season only read as its own real car", () => {
    const after = rememberedAfterSeason(stored, seasonSettings(stored));
    expect(after.carPerformance).toEqual(stored.carPerformance);
    expect(after.enginePerformance).toEqual(stored.enginePerformance);
  });

  it("takes the season's car answer once the reader changed it", () => {
    const random = { ...seasonSettings(stored), carPerformance: { kind: "random" } } as const;
    expect(rememberedAfterSeason(stored, random).carPerformance).toEqual({ kind: "random" });
  });
});
