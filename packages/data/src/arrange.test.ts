/**
 * Rearranging the whole grid by rule.
 *
 * Synthetic throughout — invented teams, invented cars, invented drivers —
 * because every rule here is about *arrangement*, and an authored season would
 * tie the test to ratings that are tuned by hand and to an entry list that
 * grows. Same reasoning, and the same fixture shape, as `carryOver.test.ts`.
 * See the testing rule in `CLAUDE.md`.
 */

import { createRng } from "@alt-hist/engine";
import { describe, expect, it } from "vitest";
import {
  ARRANGEMENT_KINDS,
  type ArrangementKind,
  arrangeLineup,
  type GridArrangement,
  isArrangementKind,
} from "./arrange.js";
import type { LineupDraft } from "./lineup.js";
import { type DriverFilters, defaultDriverFilters } from "./people.js";
import { carOverall, driverOverall } from "./rating.js";
import type { Driver, SeasonSeed } from "./types.js";

const YEAR = 2000;

/** A driver of a given ability, racing in a window around the fixture year. */
function driver(id: string, ability: number, career?: { from: number; to: number }): Driver {
  return {
    id,
    name: id,
    nationality: "GB",
    birthYear: YEAR - 30,
    debutSeason: career?.from ?? YEAR - 5,
    finalSeason: career?.to ?? YEAR + 5,
    peak: {
      season: YEAR,
      racing: ability,
      qualifying: ability,
      consistency: ability,
      adaptability: ability,
      composure: ability,
      wetWeather: ability,
    },
    peakSeasons: 5,
    developmentSpeed: 5,
    declineSpeed: 5,
  };
}

/**
 * A season of teams with a car rating and a seat count each.
 *
 * One engine for everybody, identical for everybody, so the ranking these cases
 * check is the chassis they were given and nothing else.
 */
function season(
  cars: Readonly<Record<string, { pace: number; drivers: readonly string[] }>>,
): SeasonSeed {
  return {
    year: YEAR,
    points: [9, 6, 4, 3, 2, 1],
    retirementFactor: 5,
    calendar: [{ round: 1, name: "Race", circuit: "Circuit", country: "GB" }],
    engines: [{ engineId: "engine", racing: 50, qualifying: 50, reliability: 50 }],
    entries: Object.entries(cars).map(([teamId, car]) => ({
      teamId,
      engineId: "engine",
      chassis: {
        racing: car.pace,
        qualifying: car.pace,
        consistency: car.pace,
        reliability: car.pace,
      },
      drivers: car.drivers,
    })),
  };
}

const POOL: readonly Driver[] = [
  driver("ace", 95),
  driver("quick", 85),
  driver("steady", 75),
  driver("slow", 65),
  driver("spare", 90),
  driver("spare2", 55),
  driver("oldtimer", 99, { from: YEAR - 40, to: YEAR - 20 }),
  driver("prodigy", 99, { from: YEAR + 20, to: YEAR + 40 }),
];

/**
 * The pool as the editor's filter panel opens it in each mode — which is the
 * only thing that decides who may be promoted out of it. `aged` hides the
 * careers that missed the season; `peak` does not, deliberately.
 */
const NARROWED: Readonly<Record<"aged" | "peak", DriverFilters>> = {
  aged: defaultDriverFilters("aged"),
  peak: defaultDriverFilters("peak"),
};

const rules = (
  kind: ArrangementKind,
  includeUnemployed = false,
  filters: DriverFilters = NARROWED.peak,
): GridArrangement => ({ kind, includeUnemployed, filters, retain: false });

/** The rearrangement, always against the same pool and in one rating mode. */
function arrange(
  now: SeasonSeed,
  current: LineupDraft,
  arrangement: GridArrangement,
  seed?: number,
): LineupDraft {
  return arrangeLineup(now, current, arrangement, {
    pool: POOL,
    mode: "peak",
    ...(seed === undefined ? {} : { rng: createRng(seed) }),
  });
}

/** Everyone holding a seat, ignoring which. */
function seated(lineup: LineupDraft): string[] {
  return Object.values(lineup)
    .flat()
    .filter((driverId): driverId is string => driverId !== null);
}

describe("the arrangement rules", () => {
  it("lists every kind it can validate, and validates every kind it lists", () => {
    expect(ARRANGEMENT_KINDS.every((kind) => isArrangementKind(kind))).toBe(true);
    expect(isArrangementKind("fastest")).toBe(false);
    expect(isArrangementKind(null)).toBe(false);
  });
});

describe("fastest drivers in fastest teams", () => {
  const grid = season({
    midfield: { pace: 70, drivers: ["ace", "quick"] },
    front: { pace: 90, drivers: ["steady", "slow"] },
  });
  const current: LineupDraft = { midfield: ["ace", "quick"], front: ["steady", "slow"] };

  it("puts the best drivers in the best car", () => {
    expect(arrange(grid, current, rules("fastest-in-fastest"))).toEqual({
      front: ["ace", "quick"],
      midfield: ["steady", "slow"],
    });
  });

  it("puts the best drivers in the worst car, the other way about", () => {
    expect(arrange(grid, current, rules("fastest-in-slowest"))).toEqual({
      midfield: ["ace", "quick"],
      front: ["steady", "slow"],
    });
  });

  it("keeps both of a team's cars together in the ranking", () => {
    // Three teams of two: the top pair, the middle pair and the bottom pair,
    // rather than the best driver spread one per team.
    const three = season({
      back: { pace: 50, drivers: ["a1", "a2"] },
      front: { pace: 90, drivers: ["b1", "b2"] },
      middle: { pace: 70, drivers: ["c1", "c2"] },
    });
    const pool = [
      driver("a1", 10),
      driver("a2", 20),
      driver("b1", 30),
      driver("b2", 40),
      driver("c1", 50),
      driver("c2", 60),
    ];
    const arranged = arrangeLineup(
      three,
      { back: ["a1", "a2"], front: ["b1", "b2"], middle: ["c1", "c2"] },
      rules("fastest-in-fastest"),
      { pool, mode: "peak" },
    );
    expect(arranged).toEqual({
      front: ["c2", "c1"],
      middle: ["b2", "b1"],
      back: ["a2", "a1"],
    });
  });

  it("gives the same answer twice, and is its own fixed point", () => {
    const once = arrange(grid, current, rules("fastest-in-fastest"));
    expect(arrange(grid, current, rules("fastest-in-fastest"))).toEqual(once);
    expect(arrange(grid, once, rules("fastest-in-fastest"))).toEqual(once);
  });
});

describe("who is in the running", () => {
  const grid = season({
    front: { pace: 90, drivers: ["steady"] },
    back: { pace: 40, drivers: ["slow"] },
  });
  const current: LineupDraft = { front: ["steady"], back: ["slow"] };

  it("uses only the drivers on the grid unless asked otherwise", () => {
    expect(seated(arrange(grid, current, rules("fastest-in-fastest"))).sort()).toEqual([
      "slow",
      "steady",
    ]);
  });

  it("promotes a quicker driver from the pool when asked", () => {
    // Under the career filters, so the two out-of-era 99s are not in the
    // running: the best two left are "ace" and "spare", and they take the seats.
    const arranged = arrangeLineup(
      grid,
      current,
      rules("fastest-in-fastest", true, NARROWED.aged),
      { pool: POOL, mode: "aged" },
    );
    expect(arranged).toEqual({ front: ["ace"], back: ["spare"] });
  });

  it("leaves out whoever the filters hide", () => {
    const arranged = arrangeLineup(
      grid,
      current,
      rules("fastest-in-fastest", true, NARROWED.aged),
      { pool: POOL, mode: "aged" },
    );
    expect(seated(arranged)).not.toContain("oldtimer");
    expect(seated(arranged)).not.toContain("prodigy");
  });

  it("includes them once the filters are widened to let them in", () => {
    // The whole point of reading the panel rather than a rule of its own: what
    // the reader can see in the pool is what the rule may draw on.
    const arranged = arrange(grid, current, rules("fastest-in-fastest", true, NARROWED.peak));
    expect(seated(arranged).sort()).toEqual(["oldtimer", "prodigy"]);
  });

  it("follows the age band the reader set, one year at a time", () => {
    // A driver at exactly the top of the band is in; one year narrower and the
    // same driver is out. This is the case that was broken before the filters
    // travelled with the rule: widening the range added names to the pool list
    // and none to the grid.
    const veteran = driver("veteran", 99);
    const pool = [...POOL, { ...veteran, birthYear: YEAR - 44 }];
    const band = (maxAge: number): DriverFilters => ({ ...NARROWED.aged, maxAge });
    const seatFor = (maxAge: number) =>
      seated(
        arrangeLineup(grid, current, rules("fastest-in-fastest", true, band(maxAge)), {
          pool,
          mode: "aged",
        }),
      );
    expect(seatFor(44)).toContain("veteran");
    expect(seatFor(43)).not.toContain("veteran");
  });

  it("never filters the drivers already on the grid", () => {
    // Otherwise "include the pool" would be a way of *emptying* seats: the
    // seated half is on the grid, whatever the panel beside it is hiding.
    const narrow: DriverFilters = { ...NARROWED.aged, minAge: 40, maxAge: 41 };
    const arranged = arrangeLineup(grid, current, rules("fastest-in-fastest", true, narrow), {
      pool: POOL,
      mode: "aged",
    });
    expect(seated(arranged).sort()).toEqual(["slow", "steady"]);
  });

  it("drops a driver the pool does not know, leaving the seat open", () => {
    const arranged = arrange(grid, { front: ["ghost"], back: ["slow"] }, rules("random"), 7);
    expect(seated(arranged)).toEqual(["slow"]);
  });
});

describe("every rule", () => {
  const grid = season({
    front: { pace: 90, drivers: ["ace", "quick"] },
    back: { pace: 40, drivers: ["steady", "slow"] },
  });
  const current: LineupDraft = { front: ["ace", "quick"], back: ["steady", "slow"] };

  it("keeps every team's seat count", () => {
    for (const kind of ARRANGEMENT_KINDS) {
      const arranged = arrange(grid, current, rules(kind, true), 3);
      expect(Object.keys(arranged).sort(), kind).toEqual(["back", "front"]);
      expect(arranged.front, kind).toHaveLength(2);
      expect(arranged.back, kind).toHaveLength(2);
    }
  });

  it("never seats anybody twice", () => {
    for (const kind of ARRANGEMENT_KINDS) {
      const held = seated(arrange(grid, current, rules(kind, true), 11));
      expect(held, kind).toEqual([...new Set(held)]);
    }
  });

  it("fills every seat when there are drivers enough", () => {
    for (const kind of ARRANGEMENT_KINDS) {
      expect(seated(arrange(grid, current, rules(kind), 5)), kind).toHaveLength(4);
    }
  });

  it("leaves a seat open when the grid it was handed already had one", () => {
    const short: LineupDraft = { front: ["ace", null], back: ["steady", "slow"] };
    for (const kind of ARRANGEMENT_KINDS) {
      expect(seated(arrange(grid, short, rules(kind), 5)), kind).toHaveLength(3);
    }
  });
});

describe("a randomised grid", () => {
  const grid = season({
    front: { pace: 90, drivers: ["ace", "quick"] },
    back: { pace: 40, drivers: ["steady", "slow"] },
  });
  const current: LineupDraft = { front: ["ace", "quick"], back: ["steady", "slow"] };

  it("refuses to run without a seeded generator", () => {
    expect(() => arrangeLineup(grid, current, rules("random"), { pool: POOL })).toThrow(
      /seeded generator/,
    );
  });

  it("is reproducible from its seed, and differs between seeds", () => {
    expect(arrange(grid, current, rules("random"), 42)).toEqual(
      arrange(grid, current, rules("random"), 42),
    );
    // Two seeds out of a four-seat grid can agree by chance, so this searches
    // rather than pinning a pair: what is being asserted is that the shuffle
    // reads the stream at all, which a broken one fails for every seed.
    const first = arrange(grid, current, rules("random"), 1);
    const somewhere = Array.from({ length: 30 }, (_, index) =>
      arrange(grid, current, rules("random"), index + 2),
    );
    expect(somewhere.some((other) => JSON.stringify(other) !== JSON.stringify(first))).toBe(true);
  });

  it("reaches every seat over enough seeds", () => {
    // The mutation this catches is a shuffle that only ever moves the tail of
    // the list: an implementation that left the first seat alone passes every
    // test above it.
    const inFrontSeat = new Set(
      Array.from({ length: 60 }, (_, index) => arrange(grid, current, rules("random"), index + 1))
        .map((arranged) => arranged.front?.[0])
        .filter((driverId): driverId is string => driverId !== null && driverId !== undefined),
    );
    expect(inFrontSeat.size).toBe(4);
  });

  it("ignores the pecking order it was handed", () => {
    // Not an assertion about one seed: over many seeds the best driver must
    // land in the slow car sometimes, which "fastest-in-fastest" never does.
    const inSlowCar = Array.from({ length: 60 }, (_, index) =>
      arrange(grid, current, rules("random"), index + 1),
    ).filter((arranged) => arranged.back?.includes("ace"));
    expect(inSlowCar.length).toBeGreaterThan(0);
  });
});

/**
 * What separates two drivers, or two cars, the overall cannot tell apart.
 *
 * An overall is a rounded weighted average, so a tie is ordinary rather than
 * exotic, and the rule is the app's one ranking rule: racing settles it, name
 * only after that. The fixtures below are built to tie on the overall on
 * purpose — the ratings are checked here rather than assumed, so a case that
 * stops being a tie says so instead of quietly asserting nothing.
 */
describe("a tie on the overall", () => {
  /** Same overall as an even driver on `ability`, more racing, less of the rest. */
  function racier(id: string, ability: number): Driver {
    const base = driver(id, ability);
    return {
      ...base,
      peak: {
        ...base.peak,
        racing: ability + 1,
        qualifying: ability - 1,
        consistency: ability - 1,
        adaptability: ability - 1,
        composure: ability - 1,
        wetWeather: ability - 1,
      },
    };
  }

  /** The same, for a car: a point of pace bought out of the other three. */
  function racierCar(grid: SeasonSeed, teamId: string): SeasonSeed {
    return {
      ...grid,
      entries: grid.entries.map((entry) =>
        entry.teamId !== teamId
          ? entry
          : {
              ...entry,
              chassis: {
                racing: entry.chassis.racing + 1,
                qualifying: entry.chassis.qualifying - 1,
                consistency: entry.chassis.consistency - 1,
                reliability: entry.chassis.reliability - 1,
              },
            },
      ),
    };
  }

  const engine = { racing: 50, qualifying: 50, reliability: 50 };

  /** What a team's car is worth on the grid, as the ranking reads it. */
  function worth(grid: SeasonSeed, teamId: string): number {
    const entry = grid.entries.find((candidate) => candidate.teamId === teamId);
    if (entry === undefined) {
      throw new Error(`no entry for ${teamId}`);
    }
    return carOverall(entry.chassis, engine);
  }

  it("promotes the driver with the racing rating, not the one with the name", () => {
    // "aaa" would win alphabetically and loses on pace, so the two answers
    // cannot be confused for one another.
    const even = driver("aaa", 80);
    const quick = racier("zzz", 80);
    expect(driverOverall(even.peak)).toBe(driverOverall(quick.peak));
    const grid = season({
      back: { pace: 50, drivers: ["aaa"] },
      front: { pace: 90, drivers: ["zzz"] },
    });
    const arranged = arrangeLineup(
      grid,
      { back: ["aaa"], front: ["zzz"] },
      rules("fastest-in-fastest"),
      { pool: [even, quick], mode: "peak" },
    );
    expect(arranged).toEqual({ front: ["zzz"], back: ["aaa"] });
  });

  it("fills the car with the racing rating first", () => {
    const grid = racierCar(
      season({ alpha: { pace: 70, drivers: ["ace"] }, zulu: { pace: 70, drivers: ["slow"] } }),
      "zulu",
    );
    expect(worth(grid, "alpha")).toBe(worth(grid, "zulu"));
    expect(arrange(grid, { alpha: ["ace"], zulu: ["slow"] }, rules("fastest-in-fastest"))).toEqual({
      alpha: ["slow"],
      zulu: ["ace"],
    });
  });

  it("hands the slowest car to the best driver the other way about", () => {
    const grid = racierCar(
      season({ alpha: { pace: 70, drivers: ["ace"] }, zulu: { pace: 70, drivers: ["slow"] } }),
      "zulu",
    );
    expect(arrange(grid, { alpha: ["ace"], zulu: ["slow"] }, rules("fastest-in-slowest"))).toEqual({
      alpha: ["ace"],
      zulu: ["slow"],
    });
  });
});
