import { createRng, DEVELOPMENT_TREND_LIMIT } from "@alt-hist/engine";
import { describe, expect, it } from "vitest";
import { flatTrends, randomTrends, withTrends } from "./development.js";
import { FIRST_AUTHORED_SEASON, seasonSeed } from "./index.js";
import type { SeasonSeed } from "./types.js";

/**
 * An authored season with a synthetic trend on its first car, so a test can
 * see a trend replaced and one removed without reading an authored value.
 */
const SEASON: SeasonSeed = (() => {
  const seed = seasonSeed(FIRST_AUTHORED_SEASON);
  return {
    ...seed,
    entries: seed.entries.map((entry, index) => {
      const { developmentTrend: _authored, ...rest } = entry;
      return index === 0 ? { ...rest, developmentTrend: 5 } : rest;
    }),
  };
})();
const TEAMS = SEASON.entries.map((entry) => entry.teamId);

describe("randomTrends", () => {
  it("gives every car one whole-number trend within the authored limit", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const trends = randomTrends(SEASON, createRng(seed));
      expect(Object.keys(trends)).toEqual(TEAMS);
      for (const trend of Object.values(trends)) {
        expect(Number.isInteger(trend)).toBe(true);
        expect(Math.abs(trend)).toBeLessThanOrEqual(DEVELOPMENT_TREND_LIMIT);
      }
    }
  });

  it("reaches both ends of the range, not only the middle", () => {
    const drawn = new Set<number>();
    for (let seed = 1; seed <= 40; seed++) {
      for (const trend of Object.values(randomTrends(SEASON, createRng(seed)))) {
        drawn.add(trend);
      }
    }
    expect(drawn.has(DEVELOPMENT_TREND_LIMIT)).toBe(true);
    expect(drawn.has(-DEVELOPMENT_TREND_LIMIT)).toBe(true);
  });

  it("is the same draw for the same seed", () => {
    expect(randomTrends(SEASON, createRng(7))).toEqual(randomTrends(SEASON, createRng(7)));
  });
});

describe("flatTrends and withTrends", () => {
  it("flattens every car, leaving no trend on any entry", () => {
    const flat = withTrends(SEASON, flatTrends(SEASON));
    expect(flat.entries.every((entry) => entry.developmentTrend === undefined)).toBe(true);
    expect(flat.entries.map((entry) => entry.teamId)).toEqual(TEAMS);
  });

  it("sets each car's trend to its team's", () => {
    const trends = randomTrends(SEASON, createRng(3));
    const set = withTrends(SEASON, trends);
    for (const entry of set.entries) {
      const expected = trends[entry.teamId];
      expect(entry.developmentTrend ?? 0, entry.teamId).toBe(expected);
    }
  });

  it("keeps a team's own trend when it is missing from the map", () => {
    const [first] = TEAMS;
    const set = withTrends(SEASON, {});
    expect(set.entries.find((entry) => entry.teamId === first)?.developmentTrend).toBe(5);
  });
});
