/**
 * *Keep the starting grid*: a year's entry list built on the run's first year.
 *
 * Every fixture is synthetic — invented teams, cars, engines and drivers — for
 * the reason `carryOver.test.ts` gives: the rules here are about who sits
 * where, and an authored season would tie them to numbers that move.
 */

import { describe, expect, it } from "vitest";
import {
  type EmptySeatRules,
  fillSeats,
  type KeptGridOptions,
  keptYear,
  seatedSeason,
} from "./keptGrid.js";
import { authoredLineup, type LineupDraft } from "./lineup.js";
import { authoredSeasons, FIRST_AUTHORED_SEASON, seasonSeed } from "./seasons/index.js";
import type { Driver, SeasonEngine, SeasonEntry, SeasonSeed } from "./types.js";

const START = 2000;
const YEAR = 2002;

/** A driver at his peak in `YEAR`, aged `age` then. */
function driver(id: string, age: number, ability: number, career: Partial<Driver> = {}): Driver {
  return {
    id,
    name: id,
    nationality: "GB",
    birthYear: YEAR - age,
    debutSeason: START - 5,
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
    peakSeasons: 9,
    developmentSpeed: 5,
    declineSpeed: 5,
    ...career,
  };
}

/** One team's entry: a car rated `rating` all round. */
function entry(
  teamId: string,
  drivers: readonly string[],
  rating = 50,
  engineId = "common",
  developmentTrend?: number,
): SeasonEntry {
  return {
    teamId,
    engineId,
    chassis: { racing: rating, qualifying: rating, consistency: rating, reliability: rating },
    ...(developmentTrend === undefined ? {} : { developmentTrend }),
    drivers,
  };
}

function engine(engineId: string, rating = 50): SeasonEngine {
  return { engineId, racing: rating, qualifying: rating, reliability: rating };
}

function season(
  year: number,
  entries: readonly SeasonEntry[],
  engines: readonly SeasonEngine[] = [engine("common")],
): SeasonSeed {
  return {
    year,
    points: [9, 6, 4, 3, 2, 1],
    retirementFactor: 5,
    calendar: [{ round: 1, name: "Race", circuit: "Circuit", country: "GB" }],
    engines,
    entries,
  };
}

const POOL: readonly Driver[] = [
  driver("a", 30, 90),
  driver("b", 30, 80),
  driver("c", 30, 70),
  driver("d", 30, 60),
  driver("e", 30, 50),
  driver("f", 30, 40),
  driver("old", 45, 95),
  driver("young", 17, 95),
  driver("retired", 30, 99, { finalSeason: YEAR - 1 }),
  driver("future", 30, 98, { debutSeason: YEAR + 1 }),
];

const LAST: EmptySeatRules = { fill: "last", minAge: 18, maxAge: 42, activeOnly: true };
const BEST: EmptySeatRules = { ...LAST, fill: "best" };
const READER: EmptySeatRules = { ...LAST, fill: "reader" };

/** Two teams of two in the first year; `blue` is gone by `YEAR` unless a case says otherwise. */
const FIRST = season(START, [entry("red", ["a", "b"]), entry("blue", ["c", "d"])]);

function options(...authored: SeasonSeed[]): KeptGridOptions {
  const byYear = new Map(authored.map((year) => [year.year, year]));
  return { pool: POOL, history: (year) => byYear.get(year) };
}

/** The whole kept grid: carried, then filled. */
function kept(
  now: SeasonSeed,
  previous: LineupDraft,
  rules: EmptySeatRules,
  history: SeasonSeed[] = [],
) {
  const opts = options(...history);
  const year = keptYear(FIRST, now, previous, rules, opts);
  return { ...year, filled: fillSeats(year.season, year.seats, rules, opts) };
}

function nobodyTwice(seats: LineupDraft): void {
  const seated = Object.values(seats)
    .flat()
    .filter((id) => id !== null);
  expect(seated).toEqual([...new Set(seated)]);
}

describe("the teams and their cars", () => {
  it("enters every first-year team at its first-year count, and no team history added", () => {
    const now = season(YEAR, [entry("red", ["a", "b"]), entry("green", ["e", "f"])]);
    const { seats } = kept(now, {}, READER);
    expect(Object.keys(seats).sort()).toEqual(["blue", "red"]);
    for (const first of FIRST.entries) {
      expect(seats[first.teamId]).toHaveLength(first.drivers.length);
    }
  });

  it("gives a team with more cars than the first year its strongest drivers", () => {
    const start = season(START, [entry("red", ["a"])]);
    const now = season(YEAR, [entry("red", ["c", "a", "b"])]);
    const { seats } = keptYear(start, now, {}, READER, options());
    expect(seats.red).toEqual(["a"]);
  });

  it("races a ghost on its last real car, without that year's trend", () => {
    const before = season(YEAR - 1, [
      entry("red", ["a", "b"]),
      entry("blue", ["c", "d"], 77, "common", 4),
    ]);
    const now = season(YEAR, [entry("red", ["a", "b"])]);
    const { season: entered, ghosts } = kept(now, {}, READER, [before]);
    const blue = entered.entries.find((candidate) => candidate.teamId === "blue");
    expect(ghosts).toEqual({ blue: YEAR - 1 });
    expect(blue?.chassis.racing).toBe(77);
    expect(blue?.developmentTrend).toBeUndefined();
    expect(Object.keys(ghosts)).not.toContain("red");
  });

  it("looks back past a year the ghost also missed", () => {
    const gap = season(YEAR - 1, [entry("red", ["a", "b"])]);
    const now = season(YEAR, [entry("red", ["a", "b"])]);
    expect(kept(now, {}, READER, [gap]).ghosts).toEqual({ blue: START });
  });

  it("gives a ghost's engine this year's values when the year rates it", () => {
    const before = season(
      YEAR - 1,
      [entry("blue", ["c", "d"], 50, "works")],
      [engine("works", 40)],
    );
    const now = season(YEAR, [entry("red", ["a", "b"])], [engine("common"), engine("works", 60)]);
    const { season: entered } = kept(now, {}, READER, [before]);
    expect(entered.engines).toEqual(now.engines);
  });

  it("adds a ghost's engine with its latest values when the year does not rate it", () => {
    const older = season(YEAR - 1, [entry("blue", ["c", "d"], 50, "works")], [engine("works", 40)]);
    const now = season(YEAR, [entry("red", ["a", "b"])]);
    const { season: entered } = kept(now, {}, READER, [older]);
    expect(entered.engines).toEqual([...now.engines, engine("works", 40)]);
  });
});

describe("last year's drivers", () => {
  const now = season(YEAR, [entry("red", ["a", "b"])]);

  it("keep the ghost's seats", () => {
    const { filled } = kept(now, { red: ["a", "b"], blue: ["c", "d"] }, LAST);
    expect(filled.blue).toEqual(["c", "d"]);
  });

  it("go where history puts them: history always wins", () => {
    const history = season(YEAR, [entry("red", ["a", "c"])]);
    const { seats } = kept(history, { red: ["a", "b"], blue: ["c", "d"] }, READER);
    expect(seats.red).toEqual(["a", "c"]);
    expect(seats.blue).toEqual(["d", null]);
    nobodyTwice(seats);
  });

  it("return to last year's seat when history's team has no room for them", () => {
    // History moves c to red, but red ran one car in the first year and a is
    // stronger: c is left over, so c keeps the ghost seat c raced last year.
    const start = season(START, [entry("red", ["a"]), entry("blue", ["c"])]);
    const crowded = season(YEAR, [entry("red", ["c", "a"])]);
    const year = keptYear(start, crowded, { red: ["a"], blue: ["c"] }, READER, options());
    expect(year.seats).toEqual({ red: ["a"], blue: ["c"] });
  });

  it("leave the seat once outside the age band", () => {
    const { seats } = kept(now, { blue: ["old", "young"] }, READER);
    expect(seats.blue).toEqual([null, null]);
    const wider = kept(now, { blue: ["old", "young"] }, { ...READER, minAge: 16, maxAge: 50 });
    expect(wider.seats.blue).toEqual(["old", "young"]);
  });

  it("take a short seat beside history's driver", () => {
    const short = season(YEAR, [entry("red", ["a"]), entry("blue", ["e", "f"])]);
    const { seats } = kept(short, { red: ["a", "b"] }, READER);
    expect(seats.red).toEqual(["a", "b"]);
  });

  it("are not carried under best available", () => {
    const { seats } = kept(now, { blue: ["c", "d"] }, BEST);
    expect(seats.blue).toEqual([null, null]);
  });
});

describe("filling what is left", () => {
  it("leaves the seats open for the reader", () => {
    const now = season(YEAR, [entry("red", ["e", "f"])]);
    const year = keptYear(FIRST, now, {}, READER, options());
    expect(fillSeats(year.season, year.seats, READER, options())).toBe(year.seats);
  });

  it("signs the strongest free drivers, best car first", () => {
    const start = season(START, [entry("slow", ["e"]), entry("quick", ["f"])]);
    const before = season(YEAR - 1, [entry("slow", ["e"], 30), entry("quick", ["f"], 80)]);
    const now = season(YEAR, []);
    const opts = options(before);
    const year = keptYear(start, now, {}, BEST, opts);
    const filled = fillSeats(year.season, year.seats, BEST, opts);
    expect(filled).toEqual({ quick: ["a"], slow: ["b"] });
  });

  it("signs only drivers inside the age band, and only active ones when asked", () => {
    const now = season(YEAR, [entry("red", ["c", "d"])]);
    const { filled } = kept(now, {}, LAST);
    expect(filled.blue).toEqual(["a", "b"]);
    const { filled: anyone } = kept(now, {}, { ...LAST, activeOnly: false });
    expect(anyone.blue).toEqual(["retired", "future"]);
    const { filled: wide } = kept(now, {}, { ...LAST, activeOnly: false, minAge: 16, maxAge: 50 });
    expect(wide.blue).toEqual(["retired", "future"]);
    expect(wide.blue).not.toContain("old");
  });

  it("re-signs every year under best available, where last year's driver must earn it again", () => {
    const now = season(YEAR, [entry("red", ["c", "d"])]);
    const previous = { red: ["c", "d"], blue: ["e", "f"] };
    expect(kept(now, previous, LAST).filled.blue).toEqual(["e", "f"]);
    expect(kept(now, previous, BEST).filled.blue).toEqual(["a", "b"]);
  });

  it("drops a seat nobody qualifies for, and a team with nobody sits the year out", () => {
    const now = season(YEAR, [entry("red", ["a", "b"])]);
    // Nobody in the pool is 20, and only `young` is 17.
    const nobody = kept(now, {}, { ...LAST, minAge: 20, maxAge: 20 });
    expect(nobody.filled.blue).toEqual([null, null]);
    expect(seatedSeason(nobody.season, nobody.filled).entries.map((e) => e.teamId)).toEqual([
      "red",
    ]);
    const one = kept(now, {}, { ...LAST, minAge: 17, maxAge: 17 });
    expect(one.filled.blue).toEqual(["young", null]);
    const raced = seatedSeason(one.season, one.filled);
    expect(raced.entries.find((e) => e.teamId === "blue")?.drivers).toEqual(["young"]);
  });

  it("never seats anybody twice", () => {
    const now = season(YEAR, [entry("red", ["a", "c"])]);
    for (const rules of [LAST, BEST, READER]) {
      nobodyTwice(kept(now, { red: ["a", "b"], blue: ["c", "d"] }, rules).filled);
    }
  });
});

describe("over the seed data", () => {
  // Rules only, never a number: whatever the seasons hold, a kept grid chained
  // year after year keeps every first-year team and seats nobody twice.
  it.each([FIRST_AUTHORED_SEASON, authoredSeasons[Math.floor(authoredSeasons.length / 2)] ?? 0])(
    "chains from %i to the last season",
    (from) => {
      const start = seasonSeed(from);
      let previous: LineupDraft = authoredLineup(start);
      for (const year of authoredSeasons.filter((y) => y > from)) {
        const kept = keptYear(start, seasonSeed(year), previous, LAST);
        const filled = fillSeats(kept.season, kept.seats, LAST);
        nobodyTwice(filled);
        for (const first of start.entries) {
          expect(filled[first.teamId]).toHaveLength(first.drivers.length);
        }
        const raced = seatedSeason(kept.season, filled);
        for (const entry of raced.entries) {
          expect(raced.engines.some((e) => e.engineId === entry.engineId)).toBe(true);
        }
        previous = filled;
      }
    },
  );
});
