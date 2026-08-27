import { authoredSeasons } from "@alt-hist/data";
import { describe, expect, it } from "vitest";
import {
  adjacentSeason,
  FIRST_SEASON,
  isPlayable,
  LAST_SEASON,
  PLAYABLE_SEASONS,
  playableSummary,
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
  it("is exactly what the data package has authored", () => {
    // No second list to fall out of step: the picker asks the seed data.
    expect(PLAYABLE_SEASONS).toEqual(authoredSeasons);
    expect(PLAYABLE_SEASONS.length).toBeGreaterThan(0);
    for (const year of PLAYABLE_SEASONS) {
      expect(isPlayable(year), `${year}`).toBe(true);
    }
  });

  it("is not open-ended — a year off the end of the range is not playable", () => {
    // Every year in the range is authored today, so the check that still means
    // something is that `isPlayable` says no to one outside it.
    expect(isPlayable(LAST_SEASON + 1)).toBe(false);
    expect(isPlayable(FIRST_SEASON - 1)).toBe(false);
  });

  it("only ever offers a year the picker lists", () => {
    // A typo'd key in the authored map would otherwise make a season playable
    // that no button exists for — reachable by nothing, and invisible.
    for (const year of PLAYABLE_SEASONS) {
      expect(SEASON_YEARS, `${year} is playable but unlisted`).toContain(year);
    }
  });
});

describe("the seed behind a season", () => {
  it("hands back the authored data for every playable year, calendar and all", () => {
    for (const year of PLAYABLE_SEASONS) {
      const seed = seasonSeed(year);
      expect(seed.year, `${year}`).toBe(year);
      expect(seed.calendar.length, `${year}`).toBeGreaterThan(0);
      expect(seed.entries.length, `${year}`).toBeGreaterThan(0);
    }
  });

  it("throws for a year nobody has authored, naming it", () => {
    const unauthored = SEASON_YEARS.find((year) => !isPlayable(year)) ?? 0;
    expect(() => seasonSeed(unauthored)).toThrow(String(unauthored));
  });
});

describe("saying which seasons are playable", () => {
  it("collapses a run of consecutive years into a range", () => {
    // The end state is forty-odd consecutive years; a comma-separated list of
    // them is not a sentence.
    expect(playableSummary([1980, 1981, 1982])).toBe("1980–1982 are playable so far");
    expect(playableSummary([1980, 1981])).toBe("1980–1981 are playable so far");
  });

  it("keeps gaps visible rather than papering over them", () => {
    expect(playableSummary([1980, 1981, 1985])).toBe("1980–1981 and 1985 are playable so far");
    expect(playableSummary([1980, 1990, 2000])).toBe("1980, 1990 and 2000 are playable so far");
  });

  it("reads as a sentence for one season, or none", () => {
    expect(playableSummary([1980])).toBe("Only 1980 is playable so far");
    expect(playableSummary([])).toBe("No season is playable yet");
  });

  it("describes what is actually playable", () => {
    // The endpoints, not every year: a contiguous run collapses to a range, so
    // the years in the middle of it are deliberately not written out.
    const summary = playableSummary();
    expect(summary).toContain(String(PLAYABLE_SEASONS[0]));
    expect(summary).toContain(String(PLAYABLE_SEASONS[PLAYABLE_SEASONS.length - 1]));
  });
});

describe("the seasons either side of one", () => {
  it("walks the playable list rather than adding one", () => {
    // Every year in the range is authored today, so what proves the rule is a
    // list with a hole in it — which is the whole reason this is not `year ± 1`.
    const first = PLAYABLE_SEASONS[0] ?? 0;
    const second = PLAYABLE_SEASONS[1] ?? 0;
    expect(adjacentSeason(first, 1)).toBe(second);
    expect(adjacentSeason(second, -1)).toBe(first);
  });

  it("has nothing beyond either end of the range", () => {
    expect(adjacentSeason(PLAYABLE_SEASONS[0] ?? 0, -1)).toBeNull();
    expect(adjacentSeason(PLAYABLE_SEASONS.at(-1) ?? 0, 1)).toBeNull();
  });

  it("gives an unplayable year no neighbours at all", () => {
    // Callers reach this through a world, whose year is always playable; a year
    // outside the range must not be handed one that `seasonSeed` would throw on.
    expect(adjacentSeason(FIRST_SEASON - 1, 1)).toBeNull();
    expect(adjacentSeason(LAST_SEASON + 1, -1)).toBeNull();
  });

  it("steps from every playable year to its neighbour and back", () => {
    for (const [at, year] of PLAYABLE_SEASONS.entries()) {
      const next = adjacentSeason(year, 1);
      if (next === null) {
        expect(at).toBe(PLAYABLE_SEASONS.length - 1);
        continue;
      }
      expect(isPlayable(next)).toBe(true);
      expect(next).toBeGreaterThan(year);
      expect(adjacentSeason(next, -1)).toBe(year);
    }
  });
});
