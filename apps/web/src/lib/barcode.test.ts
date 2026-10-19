import { authoredSeasons, seasonSeed } from "@alt-hist/data";
import { describe, expect, it } from "vitest";
import { decadeTicks, driverSeasonsBefore, seasonsBefore, stripesOf } from "./barcode.js";

describe("stripesOf", () => {
  it("runs from the first season raced to now, with each year's team and none for a year sat out", () => {
    expect(
      stripesOf(
        new Map([
          [1971, "a"],
          [1973, "b"],
          [1974, "a"],
        ]),
        1976,
      ),
    ).toEqual([
      { year: 1971, teamId: "a" },
      { year: 1972, teamId: undefined },
      { year: 1973, teamId: "b" },
      { year: 1974, teamId: "a" },
      { year: 1975, teamId: undefined },
      { year: 1976, teamId: undefined },
    ]);
  });

  it("draws nothing past now, and nothing for no seasons", () => {
    expect(
      stripesOf(
        new Map([
          [1980, "a"],
          [1990, "a"],
        ]),
        1985,
      )
        .map(({ year }) => year)
        .at(-1),
    ).toBe(1985);
    expect(stripesOf(new Map([[1990, "a"]]), 1985)).toEqual([]);
    expect(stripesOf(new Map(), 1985)).toEqual([]);
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

describe("driverSeasonsBefore", () => {
  it("maps each authored season before a year a driver is entered in to their first team", () => {
    const year = authoredSeasons.at(-1) ?? 0;
    const driverId = seasonSeed(year).entries[0]?.drivers[0] ?? "";
    const expected = authoredSeasons.flatMap((each) => {
      const entry = seasonSeed(each).entries.find(({ drivers }) => drivers.includes(driverId));
      return each < year && entry !== undefined ? [[each, entry.teamId] as const] : [];
    });
    expect([...driverSeasonsBefore(driverId, year)]).toEqual(expected);
    expect(driverSeasonsBefore("no-such-driver", year).size).toBe(0);
  });
});
