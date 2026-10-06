/**
 * Run settings: the points tables offered, and what is accepted back from
 * storage. Every table is read off the seed data rather than written down.
 */

import { describe, expect, it } from "vitest";
import {
  BREAKDOWNS_LABELS,
  HISTORICAL_SETTINGS,
  parseRunSettings,
  pointsTableOf,
  pointsTables,
  pointsValues,
  samePoints,
  settingsInForce,
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

  it("refuses anything else", () => {
    const table = pointsTables()[0]?.scale ?? [];
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
});
