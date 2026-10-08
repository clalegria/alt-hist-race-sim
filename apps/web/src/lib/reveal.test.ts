/**
 * The gate: a run cut at the cursor. Walked through every beat of a one-year
 * run and a two-year era, so each beat is the cursor once; counts come off the
 * worlds, never written down.
 */

import { describe, expect, it } from "vitest";
import { crowned, type Run, stepRun } from "../store/season.js";
import { type BuiltRun, built, pendingRun, seededWorld, YEAR } from "../test-support.js";
import { qualifyingOf, revealed } from "./reveal.js";
import { isReached } from "./timeline.js";

/** What a qualifying entry carries, and all it may: nothing about the race. */
const QUALIFYING_KEYS = [
  "driverId",
  "gridPosition",
  "qualifyingGapToPole",
  "qualifyingScore",
  "started",
  "teamId",
];
const SHEET_KEYS = ["entries", "nonQualifiers", "poleDriverId", "weather"];

/** Every cursor a run passes through, from `run` until it ends or leaves `lastYear`. */
function walk(run: Run, lastYear: number): BuiltRun[] {
  const runs: BuiltRun[] = [];
  for (
    let at: Run | null = run;
    at !== null && built(at).world.year <= lastYear;
    at = stepRun(at)
  ) {
    runs.push(built(at));
  }
  return runs;
}

const season = walk(
  { kind: "season", world: seededWorld(3, "aged", YEAR), cursor: { kind: "grid" } },
  YEAR,
);
const era = walk(
  {
    kind: "era",
    run: { startYear: YEAR, seasons: [] },
    world: seededWorld(3, "aged", YEAR),
    cursor: { kind: "grid" },
  },
  YEAR + 1,
);

describe.each([
  ["a one-year run", season],
  ["an era", era],
])("the gate over %s", (_, runs) => {
  it("walks more than one year's worth of beats, or proves nothing", () => {
    expect(runs.length).toBeGreaterThan(2);
  });

  it("hands over no race the reader has not reached", () => {
    for (const run of runs) {
      const shown = revealed(run);
      const label = JSON.stringify(shown.cursor);
      for (const year of shown.years) {
        year.season.races.forEach((_, round) => {
          const place = { year: year.year, beat: { kind: "race", round } } as const;
          expect(isReached(shown.cursor, place), label).toBe(true);
        });
      }
    }
  });

  it("withholds nothing the reader has reached", () => {
    for (const run of runs) {
      const shown = revealed(run);
      const label = JSON.stringify(shown.cursor);
      const current = shown.years.at(-1);
      const all = run.world.season.races;
      const seen = all.filter((_, round) =>
        isReached(shown.cursor, { year: run.world.year, beat: { kind: "race", round } }),
      );
      expect(current?.season.races, label).toEqual(seen);
      // The same objects, not copies: a reached race is handed over as it was run.
      current?.season.races.forEach((race, round) => {
        expect(race, label).toBe(all[round]);
      });
      expect(current?.season.rounds, label).toBe(all.length);
      const past = run.kind === "era" ? run.run.seasons : [];
      past.forEach((world, index) => {
        expect(shown.years[index]?.season.races, label).toEqual(world.season.races);
      });
      expect(shown.years.length, label).toBe(past.length + 1);
    }
  });

  it("shows a qualifying sheet only on the cursor's own qualifying, with no race in it", () => {
    for (const run of runs) {
      const shown = revealed(run);
      const label = JSON.stringify(shown.cursor);
      const current = shown.years.at(-1);
      const qualifying = current?.season.qualifying ?? null;
      if (run.cursor.kind !== "qualifying") {
        expect(qualifying, label).toBeNull();
        continue;
      }
      expect(qualifying?.round, label).toBe(run.cursor.round);
      const sheet = qualifying?.sheet;
      expect(Object.keys(sheet ?? {}).sort(), label).toEqual(SHEET_KEYS);
      expect(sheet?.entries.length, label).toBe(run.world.field.length);
      for (const entry of sheet?.entries ?? []) {
        expect(Object.keys(entry).sort(), label).toEqual(QUALIFYING_KEYS);
      }
      // What the qualifying page reads is that sheet.
      expect(current && qualifyingOf(current.season, run.cursor.round), label).toBe(sheet);
    }
  });

  it("agrees with the run about which years are crowned", () => {
    for (const run of runs) {
      expect(revealed(run).crowned).toEqual(run.kind === "era" ? crowned(run) : null);
    }
  });
});

describe("an earlier round's qualifying", () => {
  it("is the round's own result once its race has been revealed", () => {
    const over = season.at(-1);
    expect(over?.cursor.kind).toBe("summary");
    if (over === undefined) {
      return;
    }
    const current = revealed(over).years.at(-1);
    expect(current && qualifyingOf(current.season, 0)).toBe(over.world.season.races[0]);
  });
});

describe("a run waiting on the reader", () => {
  it("reveals every year it has built, whole, and nothing of the year it waits on", () => {
    const run = pendingRun();
    const shown = revealed(run);
    expect(shown.cursor).toEqual({ year: run.pending.year, beat: { kind: "grid" } });
    expect(shown.years.map((year) => year.year)).toEqual(
      run.run.seasons.map((world) => world.year),
    );
    for (const year of shown.years) {
      expect(year.season.races.length).toBe(year.season.rounds);
    }
    expect(shown.crowned).toBe(run.run);
  });
});
