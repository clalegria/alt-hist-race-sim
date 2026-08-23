import { describe, expect, it } from "vitest";
import {
  DEFAULT_SEASON,
  FIRST_SEASON,
  isPlayable,
  LAST_SEASON,
  PLAYABLE_SEASONS,
  SEASON_YEARS,
  seasonSeed,
} from "./seasons.js";

describe("the season range", () => {
  it("runs from the first season to the last, with no gaps", () => {
    expect(SEASON_YEARS[0]).toBe(FIRST_SEASON);
    expect(SEASON_YEARS.at(-1)).toBe(LAST_SEASON);
    expect(SEASON_YEARS).toHaveLength(LAST_SEASON - FIRST_SEASON + 1);
    expect(SEASON_YEARS.every((year, index) => year === FIRST_SEASON + index)).toBe(true);
  });
});

describe("which seasons can be run", () => {
  it("is 1980, and nothing else yet", () => {
    expect(PLAYABLE_SEASONS).toEqual([1980]);
    expect(isPlayable(1980)).toBe(true);
    expect(isPlayable(1981)).toBe(false);
    expect(isPlayable(LAST_SEASON)).toBe(false);
  });

  it("only ever offers a year the picker lists", () => {
    // A typo'd key in the authored map would otherwise make a season playable
    // that no button exists for — reachable by nothing, and invisible.
    for (const year of PLAYABLE_SEASONS) {
      expect(SEASON_YEARS, `${year} is playable but unlisted`).toContain(year);
    }
  });

  it("opens on a year that actually works", () => {
    expect(isPlayable(DEFAULT_SEASON)).toBe(true);
  });
});

describe("the seed behind a season", () => {
  it("hands back the authored data, calendar and all", () => {
    const seed = seasonSeed(1980);
    expect(seed.year).toBe(1980);
    expect(seed.calendar.length).toBeGreaterThan(0);
    expect(seed.entries.length).toBeGreaterThan(0);
  });

  it("throws for a year nobody has authored, naming it", () => {
    expect(() => seasonSeed(1999)).toThrow("1999");
  });
});
