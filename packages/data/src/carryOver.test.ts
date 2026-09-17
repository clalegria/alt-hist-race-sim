/**
 * Copying last season's drivers over this one.
 *
 * Every fixture here is synthetic — invented teams, invented drivers, invented
 * ratings — because every rule this checks is about *arrangement*, and reading
 * an authored season would tie the test to numbers that are tuned and to an
 * entry list that grows. See the testing rule in `CLAUDE.md`.
 */

import { describe, expect, it } from "vitest";
import { CARRY_OVER_AGES, carryOverLineup } from "./carryOver.js";
import type { LineupDraft } from "./lineup.js";
import { driverOverall } from "./rating.js";
import type { Driver, SeasonSeed } from "./types.js";

const YEAR = 2000;

/** A driver good enough to rate, at whatever age and ability the case needs. */
function driver(id: string, age: number, ability: number): Driver {
  return {
    id,
    name: id,
    nationality: "GB",
    birthYear: YEAR - age,
    debutSeason: YEAR - 5,
    finalSeason: YEAR + 5,
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

/** A season with the given teams and seat counts. Nothing else is read. */
function season(year: number, entries: Readonly<Record<string, readonly string[]>>): SeasonSeed {
  return {
    year,
    points: [9, 6, 4, 3, 2, 1],
    retirementFactor: 5,
    calendar: [{ round: 1, name: "Race", circuit: "Circuit", country: "GB" }],
    engines: [{ engineId: "engine", racing: 50, qualifying: 50, reliability: 50 }],
    entries: Object.entries(entries).map(([teamId, drivers]) => ({
      teamId,
      engineId: "engine",
      chassis: { racing: 50, qualifying: 50, consistency: 50, reliability: 50 },
      drivers,
    })),
  };
}

/** Everyone the cases below draw on, at a plain racing age unless stated. */
const POOL: readonly Driver[] = [
  driver("a", 30, 90),
  driver("b", 30, 80),
  driver("c", 30, 70),
  driver("d", 30, 60),
  driver("e", 30, 50),
  driver("ancient", CARRY_OVER_AGES.max + 1, 90),
  driver("veteran", CARRY_OVER_AGES.max, 90),
];

/** Same overall as an even driver on `ability`, more racing, less of the rest. */
function racier(id: string, age: number, ability: number): Driver {
  const base = driver(id, age, ability);
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

/** The carry-over, always against the same pool and in one rating mode. */
function carry(now: SeasonSeed, before: SeasonSeed, current: LineupDraft = {}): LineupDraft {
  return carryOverLineup(now, before, current, { pool: POOL, mode: "peak" });
}

describe("copying the previous season's drivers", () => {
  it("puts everyone back at the team they drove for", () => {
    const before = season(YEAR - 1, { red: ["a", "b"], blue: ["c", "d"] });
    const now = season(YEAR, { red: ["c", "d"], blue: ["a", "b"] });
    expect(carry(now, before, { red: ["c", "d"], blue: ["a", "b"] })).toEqual({
      red: ["a", "b"],
      blue: ["c", "d"],
    });
  });

  it("never gives one driver two seats", () => {
    const before = season(YEAR - 1, { red: ["a", "b"] });
    const now = season(YEAR, { red: ["a", "c"], blue: ["b", "d"] });
    const copied = carry(now, before, { red: ["a", "c"], blue: ["b", "d"] });
    const seated = Object.values(copied).flat();
    expect(seated.filter((id) => id !== null)).toEqual([
      ...new Set(seated.filter((id) => id !== null)),
    ]);
    // b is pulled back to red, so one of blue's two cars is nobody's.
    expect(copied).toEqual({ red: ["a", "b"], blue: ["d", null] });
  });

  it("leaves the seat a driver was pulled out of open", () => {
    const before = season(YEAR - 1, { red: ["a"] });
    const now = season(YEAR, { red: ["b"], blue: ["a"] });
    // a goes home to red; b, whom nobody claimed, keeps no car, because the
    // only one they had was taken.
    expect(carry(now, before, { red: ["b"], blue: ["a"] })).toEqual({ red: ["a"], blue: [null] });
  });

  it("leaves a team the previous season did not have exactly as it is", () => {
    const before = season(YEAR - 1, { red: ["a", "b"] });
    const now = season(YEAR, { red: ["a", "b"], green: ["c", "d"] });
    expect(carry(now, before, { red: ["a", "b"], green: ["c", "d"] })).toEqual({
      red: ["a", "b"],
      green: ["c", "d"],
    });
  });

  it("does not seat anyone at a team that no longer enters", () => {
    const before = season(YEAR - 1, { red: ["a", "b"], gone: ["c", "d"] });
    const now = season(YEAR, { red: ["e", "b"] });
    const copied = carry(now, before, { red: ["e", "b"] });
    expect(Object.keys(copied)).toEqual(["red"]);
    expect(copied).toEqual({ red: ["a", "b"] });
  });

  it("keeps whoever is already there in the seats the copy does not claim", () => {
    // red gains a car: last year's pair take two of the three, and the driver
    // this season put in the third stays in it.
    const before = season(YEAR - 1, { red: ["a", "b"] });
    const now = season(YEAR, { red: ["a", "b", "c"] });
    expect(carry(now, before, { red: ["a", "b", "c"] })).toEqual({ red: ["a", "b", "c"] });
  });

  it("carries the strongest over when a team loses a car", () => {
    // Three last year, one now: a is the best of them, and the order they are
    // listed in does not decide it.
    const before = season(YEAR - 1, { red: ["c", "a", "b"] });
    const now = season(YEAR, { red: ["e"] });
    expect(carry(now, before, { red: ["e"] })).toEqual({ red: ["a"] });
  });

  it("keeps the racier of two the overall cannot separate", () => {
    // `racier` ties `b` on the overall — an overall is a rounded average, so
    // that is ordinary — and is the quicker of the two. Listed second, so the
    // seat order that breaks a genuine dead heat cannot be what decides it.
    const even = driver("b", 30, 80);
    const quick = racier("racier", 30, 80);
    expect(driverOverall(even.peak)).toBe(driverOverall(quick.peak));
    const before = season(YEAR - 1, { red: ["b", "racier"] });
    const now = season(YEAR, { red: ["e"] });
    const pool = [...POOL, quick];
    expect(carryOverLineup(now, before, { red: ["e"] }, { pool, mode: "peak" })).toEqual({
      red: ["racier"],
    });
  });

  it("keeps the previous seat order among the drivers it carries", () => {
    const before = season(YEAR - 1, { red: ["c", "a", "b"] });
    const now = season(YEAR, { red: ["e", "d"] });
    // a and b are the two strongest; b was listed behind a, and stays behind.
    expect(carry(now, before, { red: ["e", "d"] })).toEqual({ red: ["a", "b"] });
  });

  it("does not carry a driver who has aged past the range", () => {
    const before = season(YEAR - 1, { red: ["ancient", "veteran"] });
    const now = season(YEAR, { red: ["a", "b"] });
    const copied = carry(now, before, { red: ["a", "b"] });
    // The one who is still inside the range comes over; the one who is not
    // leaves a car for the reader to fill, rather than a seat quietly taken.
    expect(copied).toEqual({ red: ["veteran", "a"] });
  });

  it("reads the previous grid as it was raced when it was rewritten", () => {
    const before = season(YEAR - 1, { red: ["a", "b"] });
    const now = season(YEAR, { red: ["e", "d"] });
    const raced = carryOverLineup(
      now,
      before,
      { red: ["e", "d"] },
      {
        pool: POOL,
        mode: "peak",
        previousLineup: { red: ["c", "d"] },
      },
    );
    expect(raced).toEqual({ red: ["c", "d"] });
  });

  it("never changes a team's seat count, whatever it is handed", () => {
    const before = season(YEAR - 1, { red: ["a", "b", "c"], blue: ["d"] });
    const now = season(YEAR, { red: ["e"], blue: ["a", "b"], green: ["c", "d"] });
    const copied = carry(now, before, { red: ["e"], blue: ["a", "b"], green: ["c", "d"] });
    for (const entry of now.entries) {
      expect(copied[entry.teamId], entry.teamId).toHaveLength(entry.drivers.length);
    }
  });

  it("is stable: copying twice says the same thing as copying once", () => {
    const before = season(YEAR - 1, { red: ["a", "b"], blue: ["c"] });
    const now = season(YEAR, { red: ["c", "d"], blue: ["a"], green: ["b", "e"] });
    const current = { red: ["c", "d"], blue: ["a"], green: ["b", "e"] };
    const once = carry(now, before, current);
    expect(carry(now, before, once)).toEqual(once);
  });
});
