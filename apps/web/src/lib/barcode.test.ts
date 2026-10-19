import { authoredSeasons, seasonSeed } from "@alt-hist/data";
import { describe, expect, it } from "vitest";
import { decadeTicks, seasonsBefore, stripesOf } from "./barcode.js";

describe("stripesOf", () => {
  it("runs from the first season raced to now, marking the years sat out", () => {
    expect(stripesOf(new Set([1971, 1973, 1974]), 1976)).toEqual([
      { year: 1971, raced: true },
      { year: 1972, raced: false },
      { year: 1973, raced: true },
      { year: 1974, raced: true },
      { year: 1975, raced: false },
      { year: 1976, raced: false },
    ]);
  });

  it("draws nothing past now, and nothing for no seasons", () => {
    expect(
      stripesOf(new Set([1980, 1990]), 1985)
        .map(({ year }) => year)
        .at(-1),
    ).toBe(1985);
    expect(stripesOf(new Set([1990]), 1985)).toEqual([]);
    expect(stripesOf(new Set(), 1985)).toEqual([]);
  });
});

describe("decadeTicks", () => {
  it("ticks every decade inside the strip, labelling those with room after them", () => {
    expect(decadeTicks(1966, 1992)).toEqual([
      { year: 1970, label: true },
      { year: 1980, label: true },
      { year: 1990, label: false },
    ]);
    expect(decadeTicks(1971, 1979)).toEqual([]);
    expect(decadeTicks(1970, 1975).map(({ year }) => year)).toEqual([1970]);
  });
});

describe("seasonsBefore", () => {
  it("lists the authored seasons before a year that the team is entered in, oldest first", () => {
    const year = authoredSeasons.at(-1) ?? 0;
    const teamId = seasonSeed(year).entries[0]?.teamId ?? "";
    const expected = authoredSeasons.filter(
      (each) => each < year && seasonSeed(each).entries.some((entry) => entry.teamId === teamId),
    );
    expect(seasonsBefore(teamId, year)).toEqual(expected);
    expect(seasonsBefore("no-such-team", year)).toEqual([]);
  });
});
