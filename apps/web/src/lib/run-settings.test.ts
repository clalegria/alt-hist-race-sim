/**
 * Run settings: the points tables offered, and what is accepted back from
 * storage. Every table is read off the seed data rather than written down.
 */

import {
  AGE_RANGE,
  drivers,
  driversWithoutCareerEvents,
  randomChassis,
  variedChassis,
} from "@alt-hist/data";
import { createRng, deriveSeed } from "@alt-hist/engine";
import { describe, expect, it } from "vitest";
import {
  BREAKDOWNS_LABELS,
  CAR_PERFORMANCE_STREAM,
  CAR_VARIATION_BASES,
  CAR_VARIATION_SPREADS,
  driverPoolOf,
  HISTORICAL_SETTINGS,
  OPENING_SEAT_RULES,
  parseRunSettings,
  pointsTableOf,
  pointsTables,
  pointsValues,
  rolledChassisOf,
  samePoints,
  seasonSettings,
  settingsInForce,
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

  it("accepts Teams and seats: Keep, under both fills, at any ages the range holds", () => {
    for (const teamsAndSeats of [
      OPENING_SEAT_RULES,
      { ...OPENING_SEAT_RULES, fill: "best", activeOnly: false },
      { ...OPENING_SEAT_RULES, minAge: AGE_RANGE.min, maxAge: AGE_RANGE.max },
      { ...OPENING_SEAT_RULES, minAge: 30, maxAge: 30 },
    ] as const) {
      const settings = { ...HISTORICAL_SETTINGS, teamsAndSeats };
      expect(parseRunSettings(settings), JSON.stringify(teamsAndSeats)).toEqual(settings);
    }
  });

  it("refuses anything else", () => {
    const table = pointsTables()[0]?.scale ?? [];
    const { teamsAndSeats: _new, ...beforeTeamsAndSeats } = HISTORICAL_SETTINGS;
    const seats = (changes: Record<string, unknown>) => ({
      ...HISTORICAL_SETTINGS,
      teamsAndSeats: { ...OPENING_SEAT_RULES, ...changes },
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
      // Settings from before Teams and seats, and its rules wrong in turn: a
      // fill nobody offers, ages outside the range, crossed or fractional, and
      // a field missing.
      beforeTeamsAndSeats,
      { ...HISTORICAL_SETTINGS, teamsAndSeats: "keep" },
      seats({ fill: "nobody" }),
      seats({ fill: "Last" }),
      seats({ minAge: AGE_RANGE.min - 1 }),
      seats({ maxAge: AGE_RANGE.max + 1 }),
      seats({ minAge: 40, maxAge: 30 }),
      seats({ maxAge: 40.5 }),
      seats({ activeOnly: "yes" }),
      seats({ activeOnly: undefined }),
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
});

describe("a standalone season's settings", () => {
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
    expect(seasonSettings({ ...HISTORICAL_SETTINGS, teamsAndSeats: OPENING_SEAT_RULES })).toEqual(
      HISTORICAL_SETTINGS,
    );
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
    ] as const) {
      expect(seasonSettings(settings)).toBe(settings);
    }
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

describe("the what-ifs a run states", () => {
  it("states nothing for a historical run", () => {
    expect(whatIfsOf(HISTORICAL_SETTINGS)).toEqual([]);
  });

  it("names a fixed points table by its values", () => {
    const scale = pointsTables()[0]?.scale ?? [];
    expect(whatIfsOf({ ...HISTORICAL_SETTINGS, points: scale })).toEqual([
      { name: "Points", value: pointsValues(scale) },
    ]);
  });

  it("names Breakdowns and Reliability, in the order the card lists them", () => {
    const year = PLAYABLE_SEASONS[0] ?? 0;
    expect(
      whatIfsOf({ ...HISTORICAL_SETTINGS, breakdowns: "none", reliability: year }).map(
        (line) => line.name,
      ),
    ).toEqual(["Breakdowns", "Reliability"]);
    expect(whatIfsOf({ ...HISTORICAL_SETTINGS, reliability: year })).toEqual([
      { name: "Reliability", value: `as in ${year}` },
    ]);
    expect(whatIfsOf({ ...HISTORICAL_SETTINGS, breakdowns: "fewer" })).toEqual([
      { name: "Breakdowns", value: BREAKDOWNS_LABELS.fewer },
    ]);
  });

  it("names Car performance after the Races group and before the Drivers group", () => {
    expect(
      whatIfsOf({
        ...HISTORICAL_SETTINGS,
        breakdowns: "fewer",
        carPerformance: { kind: "varied", spread: 10, from: "real" },
        careerEvents: "none",
      }).map((line) => line.name),
    ).toEqual(["Breakdowns", "Car performance", "Career events"]);
    expect(
      whatIfsOf({
        ...HISTORICAL_SETTINGS,
        carPerformance: { kind: "varied", spread: 10, from: "real" },
      }),
    ).toEqual([{ name: "Car performance", value: "Varied ±10" }]);
    expect(
      whatIfsOf({
        ...HISTORICAL_SETTINGS,
        carPerformance: { kind: "varied", spread: 10, from: "last" },
      }),
    ).toEqual([{ name: "Car performance", value: "Varied ±10 from previous year's car" }]);
    expect(whatIfsOf({ ...HISTORICAL_SETTINGS, carPerformance: { kind: "random" } })).toEqual([
      { name: "Car performance", value: "Random" },
    ]);
  });

  it("names Career events after the Races group", () => {
    expect(
      whatIfsOf({ ...HISTORICAL_SETTINGS, breakdowns: "fewer", careerEvents: "none" }),
    ).toEqual([
      { name: "Breakdowns", value: BREAKDOWNS_LABELS.fewer },
      { name: "Career events", value: "None" },
    ]);
  });

  it("names Teams and seats after Team names, with its rules", () => {
    expect(
      whatIfsOf({ ...HISTORICAL_SETTINGS, teamNames: "first", teamsAndSeats: OPENING_SEAT_RULES }),
    ).toEqual([
      { name: "Team names", value: "Keep the first" },
      {
        name: "Teams and seats",
        value: `Keep the starting grid · previous year's drivers first · ages ${OPENING_SEAT_RULES.minAge}–${OPENING_SEAT_RULES.maxAge} · active drivers only`,
      },
    ]);
  });

  it("names Team names last, after the Drivers group", () => {
    expect(whatIfsOf({ ...HISTORICAL_SETTINGS, careerEvents: "none", teamNames: "first" })).toEqual(
      [
        { name: "Career events", value: "None" },
        { name: "Team names", value: "Keep the first" },
      ],
    );
  });
});
