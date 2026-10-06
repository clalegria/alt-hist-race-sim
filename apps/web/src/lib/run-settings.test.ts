/**
 * Run settings: the points tables offered, and what is accepted back from
 * storage. Every table is read off the seed data rather than written down.
 */

import { describe, expect, it } from "vitest";
import {
  HISTORICAL_SETTINGS,
  parseRunSettings,
  pointsTableOf,
  pointsTables,
  pointsValues,
  samePoints,
  whatIfsOf,
} from "./run-settings.js";
import { PLAYABLE_SEASONS, seasonSeed } from "./seasons.js";

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
    expect(parseRunSettings({ points: null })).toEqual(HISTORICAL_SETTINGS);
    for (const table of pointsTables()) {
      // Through JSON, as storage hands it back: equal by value, not identity.
      expect(parseRunSettings(JSON.parse(JSON.stringify({ points: table.scale })))).toEqual({
        points: table.scale,
      });
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
    ];
    for (const raw of junk) {
      expect(parseRunSettings(raw), JSON.stringify(raw)).toBeNull();
    }
  });
});

describe("the what-ifs a run states", () => {
  it("states nothing for a historical run", () => {
    expect(whatIfsOf(HISTORICAL_SETTINGS)).toEqual([]);
  });

  it("names a fixed points table by its values", () => {
    const scale = pointsTables()[0]?.scale ?? [];
    expect(whatIfsOf({ points: scale })).toEqual([{ name: "Points", value: pointsValues(scale) }]);
  });
});
