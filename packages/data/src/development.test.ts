import { createRng, DEVELOPMENT_TREND_LIMIT } from "@alt-hist/engine";
import { describe, expect, it } from "vitest";
import {
  applyTrends,
  authoredTrends,
  canStepTrend,
  flatTrends,
  isAuthoredTrends,
  randomTrends,
  stepTrend,
  trendChanges,
  withTrends,
} from "./development.js";
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

describe("a grid edit's trends", () => {
  const authored = authoredTrends(SEASON);
  const [first = "", second = ""] = TEAMS;

  it("start from the season's own, a car with none at zero", () => {
    expect(Object.keys(authored)).toEqual(TEAMS);
    expect(authored[first]).toBe(5);
    expect(authored[second]).toBe(0);
    expect(isAuthoredTrends(SEASON, authored)).toBe(true);
    expect(trendChanges(SEASON, authored)).toEqual([]);
  });

  it("step one team a point either way, and say how it moved", () => {
    const up = stepTrend(authored, second, 1);
    expect(up[second]).toBe(1);
    expect(up[first]).toBe(5);
    expect(isAuthoredTrends(SEASON, up)).toBe(false);
    expect(trendChanges(SEASON, up)).toEqual([{ teamId: second, from: 0, to: 1 }]);
    expect(stepTrend(stepTrend(authored, first, -1), first, 1)).toEqual(authored);
  });

  it("stop at the limit, handing back what they were given", () => {
    const top = { ...authored, [second]: DEVELOPMENT_TREND_LIMIT };
    const bottom = { ...authored, [second]: -DEVELOPMENT_TREND_LIMIT };
    expect(stepTrend(top, second, 1)).toBe(top);
    expect(stepTrend(bottom, second, -1)).toBe(bottom);
    expect(canStepTrend(DEVELOPMENT_TREND_LIMIT, 1)).toBe(false);
    expect(canStepTrend(DEVELOPMENT_TREND_LIMIT, -1)).toBe(true);
    expect(canStepTrend(-DEVELOPMENT_TREND_LIMIT, -1)).toBe(false);
    expect(canStepTrend(0, 1)).toBe(true);
  });

  it("are applied as trends, a zero as none", () => {
    const edited = applyTrends(SEASON, { ...authored, [first]: 0, [second]: -3 });
    expect(edited.entries[0]?.developmentTrend).toBeUndefined();
    expect(edited.entries[1]?.developmentTrend).toBe(-3);
  });

  it("are refused when a save file's do not fit the season", () => {
    expect(() => applyTrends(SEASON, { ...authored, nobody: 0 })).toThrow(/nobody/);
    const { [first]: _missing, ...short } = authored;
    expect(() => applyTrends(SEASON, short)).toThrow(/missing/);
    expect(() => applyTrends(SEASON, { ...authored, [first]: 1.5 })).toThrow(/whole numbers/);
    expect(() =>
      applyTrends(SEASON, { ...authored, [first]: DEVELOPMENT_TREND_LIMIT + 1 }),
    ).toThrow(/whole numbers/);
  });
});
