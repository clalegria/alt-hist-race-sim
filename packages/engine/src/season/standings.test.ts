import { describe, expect, it } from "vitest";
import type { RaceEntryResult, RaceResult } from "../race/types.js";
import type { SeasonConstants } from "./constants.js";
import { championshipStandings, constructorStandings, pointsForPosition } from "./standings.js";
import type { SeasonResult } from "./types.js";

/** The late-2010s scale, as a second scale to prove the first is not baked in. */
const MODERN: SeasonConstants = {
  pointsByPosition: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
};

function entry(driverId: string, finishPosition: number | null): RaceEntryResult {
  const started = finishPosition !== null;
  return {
    driverId,
    teamId: `${driverId}-team`,
    gridPosition: 1,
    started: true,
    finishPosition,
    retired: !started,
    dnfCause: started ? null : "mechanical",
    mechanicalFailure: !started,
    driverError: false,
    qualifyingScore: 80,
    raceScore: 80,
    qualifyingGapToPole: 0,
    raceGapToWinner: null,
  };
}

/** A race whose classification is exactly the drivers given, in order. */
function race(finishers: readonly string[], poleDriverId = finishers[0] ?? "nobody"): RaceResult {
  const entries = finishers.map((driverId, index) => entry(driverId, index + 1));
  return {
    entries,
    poleDriverId,
    winnerDriverId: finishers[0] ?? null,
    retirements: 0,
    classifiedCount: entries.length,
    nonQualifiers: 0,
  };
}

function season(races: readonly RaceResult[]): SeasonResult {
  return { races };
}

/** A race whose finishers are given as [driverId, teamId] pairs, in order. */
function teamRace(finishers: readonly (readonly [string, string])[]): RaceResult {
  const entries = finishers.map(([driverId, teamId], index) => ({
    ...entry(driverId, index + 1),
    teamId,
  }));
  return {
    entries,
    poleDriverId: finishers[0]?.[0] ?? "nobody",
    winnerDriverId: finishers[0]?.[0] ?? null,
    retirements: 0,
    classifiedCount: entries.length,
    nonQualifiers: 0,
  };
}

describe("points for a position", () => {
  it("pays the 1980 scale to six places", () => {
    expect([1, 2, 3, 4, 5, 6].map((p) => pointsForPosition(p))).toEqual([9, 6, 4, 3, 2, 1]);
  });

  it("pays nothing outside the scale", () => {
    expect(pointsForPosition(7)).toBe(0);
    expect(pointsForPosition(28)).toBe(0);
  });

  it("takes a different scale without touching the logic", () => {
    // The whole reason the scale is an array: a later era pays ten places.
    expect(pointsForPosition(10, MODERN)).toBe(1);
    expect(pointsForPosition(1, MODERN)).toBe(25);
    expect(pointsForPosition(11, MODERN)).toBe(0);
  });

  it("refuses nonsense positions instead of throwing", () => {
    expect(pointsForPosition(0)).toBe(0);
    expect(pointsForPosition(-3)).toBe(0);
    expect(pointsForPosition(1.5)).toBe(0);
    expect(pointsForPosition(Number.NaN)).toBe(0);
  });
});

describe("championship standings", () => {
  it("adds up points across the season", () => {
    const table = championshipStandings(
      season([race(["a", "b", "c"]), race(["b", "a", "c"]), race(["a", "c", "b"])]),
    );
    expect(table.map((s) => [s.driverId, s.points])).toEqual([
      ["a", 24],
      ["b", 19],
      ["c", 14],
    ]);
  });

  it("orders by points, highest first", () => {
    const table = championshipStandings(season([race(["c", "b", "a"]), race(["c", "b", "a"])]));
    for (let i = 1; i < table.length; i += 1) {
      expect(table[i]?.points ?? 0).toBeLessThanOrEqual(table[i - 1]?.points ?? 0);
    }
    expect(table[0]?.driverId).toBe("c");
  });

  it("breaks a tie on countback, not alphabetically", () => {
    // Both finish on 20: "winner" from two wins and two sixths (9+9+1+1),
    // "steady" from two seconds and two thirds (6+6+4+4). Winning races takes
    // it, which is the 1980 rule — and note the countback has to beat the
    // alphabet here, since "steady" sorts first.
    const table = championshipStandings(
      season([
        race(["winner", "steady", "x1", "x2", "x3", "x4"]),
        race(["winner", "steady", "x1", "x2", "x3", "x4"]),
        race(["x1", "x2", "steady", "x3", "x4", "winner"]),
        race(["x1", "x2", "steady", "x3", "x4", "winner"]),
      ]),
    );
    const order = table.map((s) => s.driverId);
    const winner = table.find((s) => s.driverId === "winner");
    const steady = table.find((s) => s.driverId === "steady");
    expect(winner?.points).toBe(steady?.points);
    expect(order.indexOf("winner")).toBeLessThan(order.indexOf("steady"));
  });

  it("goes deeper down the countback when the wins are level", () => {
    // Both on 21 with one win each: "second" took two seconds (9+6+6), "fourth"
    // one second and two fourths (9+6+3+3). The tie has to break on second
    // places, one rung further down than wins.
    const table = championshipStandings(
      season([
        race(["second", "fourth", "x1", "x2", "x3", "x4"]),
        race(["fourth", "second", "x1", "x2", "x3", "x4"]),
        race(["x1", "second", "x2", "fourth", "x3", "x4"]),
        race(["x1", "x2", "x3", "fourth", "x4", "x5", "second"]),
      ]),
    );
    const second = table.find((s) => s.driverId === "second");
    const fourth = table.find((s) => s.driverId === "fourth");
    expect(second?.points).toBe(21);
    expect(fourth?.points).toBe(21);
    expect(second?.wins).toBe(fourth?.wins);
    expect(second?.finishCounts[1]).toBeGreaterThan(fourth?.finishCounts[1] ?? 0);
    const order = table.map((s) => s.driverId);
    expect(order.indexOf("second")).toBeLessThan(order.indexOf("fourth"));
  });

  it("falls back to driver id so the order is always total", () => {
    const first = championshipStandings(season([race(["a", "b"]), race(["b", "a"])]));
    const again = championshipStandings(season([race(["a", "b"]), race(["b", "a"])]));
    expect(first.map((s) => s.driverId)).toEqual(again.map((s) => s.driverId));
  });

  it("counts wins, podiums, poles and best finish", () => {
    const table = championshipStandings(
      season([
        race(["a", "b", "c", "d"], "d"),
        race(["b", "a", "c", "d"], "d"),
        race(["c", "d", "a", "b"], "d"),
      ]),
    );
    const a = table.find((s) => s.driverId === "a");
    expect(a?.wins).toBe(1);
    expect(a?.podiums).toBe(3);
    expect(a?.bestFinish).toBe(1);
    const d = table.find((s) => s.driverId === "d");
    expect(d?.poles).toBe(3);
    expect(d?.wins).toBe(0);
    expect(d?.bestFinish).toBe(2);
  });

  it("gives a driver who never finished a null best finish", () => {
    const table = championshipStandings(season([{ ...race(["a"]), entries: [entry("a", null)] }]));
    expect(table[0]?.bestFinish).toBeNull();
    expect(table[0]?.points).toBe(0);
    expect(table[0]?.retirements).toBe(1);
  });

  it("counts a non-qualifier as neither a start nor a retirement", () => {
    const dnq: RaceEntryResult = {
      ...entry("a", null),
      started: false,
      retired: false,
      dnfCause: null,
      mechanicalFailure: false,
      raceScore: null,
    };
    const table = championshipStandings(season([{ ...race(["a"]), entries: [dnq] }]));
    expect(table[0]?.nonQualifications).toBe(1);
    expect(table[0]?.starts).toBe(0);
    expect(table[0]?.retirements).toBe(0);
  });

  it("scores the same season differently under a different scale", () => {
    const year = season([race(["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"])]);
    expect(championshipStandings(year)[0]?.points).toBe(9);
    expect(championshipStandings(year, MODERN)[0]?.points).toBe(25);
    // Tenth scores nothing in 1980 and a point in the modern scale.
    expect(championshipStandings(year).find((s) => s.driverId === "j")?.points).toBe(0);
    expect(championshipStandings(year, MODERN).find((s) => s.driverId === "j")?.points).toBe(1);
  });

  it("includes every driver who appeared, scoring or not", () => {
    const table = championshipStandings(season([race(["a", "b", "c", "d", "e", "f", "g"])]));
    expect(table).toHaveLength(7);
    expect(table.find((s) => s.driverId === "g")?.points).toBe(0);
  });

  it("derives the table without touching the results", () => {
    const year = season([race(["a", "b"]), race(["b", "a"])]);
    const before = JSON.stringify(year);
    championshipStandings(year);
    expect(JSON.stringify(year)).toBe(before);
  });

  it("returns an empty table for a season with no races", () => {
    expect(championshipStandings(season([]))).toEqual([]);
  });
});

describe("constructor standings", () => {
  /** A two-car race: two teams, two cars each. */
  const oneTwoThreeFour = teamRace([
    ["a1", "alpha"],
    ["b1", "beta"],
    ["a2", "alpha"],
    ["b2", "beta"],
  ]);

  it("adds both of a team's cars together", () => {
    // The post-1979 rule: every car scores, not just the best-placed one.
    // Alpha takes 9 + 4, beta 6 + 3.
    const table = constructorStandings(season([oneTwoThreeFour]));
    expect(table.map((t) => [t.teamId, t.points])).toEqual([
      ["alpha", 13],
      ["beta", 9],
    ]);
  });

  it("counts starts per car but poles per race", () => {
    const table = constructorStandings(season([oneTwoThreeFour, oneTwoThreeFour]));
    const alpha = table.find((t) => t.teamId === "alpha");
    expect(alpha?.starts).toBe(4);
    expect(alpha?.poles).toBe(2);
    expect(alpha?.wins).toBe(2);
  });

  it("counts a one-two as two podiums", () => {
    const table = constructorStandings(
      season([
        teamRace([
          ["a1", "alpha"],
          ["a2", "alpha"],
          ["b1", "beta"],
        ]),
      ]),
    );
    expect(table.find((t) => t.teamId === "alpha")?.podiums).toBe(2);
  });

  it("puts every team in the table exactly once", () => {
    const table = constructorStandings(season([oneTwoThreeFour, oneTwoThreeFour]));
    expect(table).toHaveLength(2);
    expect(new Set(table.map((t) => t.teamId)).size).toBe(2);
  });

  it("agrees with the drivers' table on the total points awarded", () => {
    // Two views of one set of results; if they disagree, one of them is
    // inventing or dropping points.
    const year = season([
      oneTwoThreeFour,
      teamRace([
        ["b2", "beta"],
        ["a1", "alpha"],
        ["b1", "beta"],
      ]),
    ]);
    const drivers = championshipStandings(year).reduce((sum, s) => sum + s.points, 0);
    const teams = constructorStandings(year).reduce((sum, t) => sum + t.points, 0);
    expect(teams).toBe(drivers);
  });

  it("breaks a tie on countback across both cars", () => {
    // Both teams on 10: zulu from a win and a sixth (9+1), beta from a second
    // and a third (6+4). The win takes it — and zulu sorts last alphabetically,
    // so the countback has to be what puts it first.
    const table = constructorStandings(
      season([
        teamRace([
          ["z1", "zulu"],
          ["b1", "beta"],
          ["b2", "beta"],
          ["x1", "x"],
          ["x2", "x"],
          ["z2", "zulu"],
        ]),
      ]),
    );
    const zulu = table.find((t) => t.teamId === "zulu");
    const beta = table.find((t) => t.teamId === "beta");
    expect(zulu?.points).toBe(10);
    expect(beta?.points).toBe(10);
    expect(zulu?.wins).toBe(1);
    expect(beta?.wins).toBe(0);
    expect(table.map((t) => t.teamId).indexOf("zulu")).toBe(0);
  });

  it("uses the scale it is given", () => {
    expect(constructorStandings(season([oneTwoThreeFour]), MODERN)[0]?.points).toBe(25 + 15);
  });

  it("returns an empty table for a season with no races", () => {
    expect(constructorStandings(season([]))).toEqual([]);
  });
});
