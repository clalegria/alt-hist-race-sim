/**
 * The run's timeline as pure rules: the order Continue walks, and how two
 * places compare. Round counts are synthetic — the rules hold for any season.
 */

import { describe, expect, it } from "vitest";
import {
  advance,
  type Beat,
  comparePlaces,
  describeBeat,
  isReached,
  nextBeat,
  type Place,
} from "./timeline.js";

/** Every beat of one season, from its grid on, as Continue walks them. */
function walk(rounds: number, inEra: boolean, hasNextYear: boolean): Beat[] {
  const beats: Beat[] = [{ kind: "grid" }];
  for (;;) {
    const last = beats[beats.length - 1] as Beat;
    const next = nextBeat(last, rounds, inEra, hasNextYear);
    // A next year's grid is a new season; this walk is one.
    if (next === null || (last.kind === "review" && next.kind === "grid")) {
      return beats;
    }
    beats.push(next);
    if (beats.length > rounds * 2 + 10) {
      throw new Error("the walk does not end");
    }
  }
}

const COUNTS = [1, 2, 7, 16];

describe("Continue's walk through a season", () => {
  for (const rounds of COUNTS) {
    it(`shows every session of a ${rounds}-round season exactly once, then the summary`, () => {
      const beats = walk(rounds, false, false);
      // The grid, two sessions per round, the summary.
      expect(beats).toHaveLength(rounds * 2 + 2);
      expect(beats.at(-1)).toEqual({ kind: "summary" });
      for (let round = 0; round < rounds; round += 1) {
        const qualifying = beats.findIndex((b) => b.kind === "qualifying" && b.round === round);
        const race = beats.findIndex((b) => b.kind === "race" && b.round === round);
        expect(qualifying, `round ${round}`).toBeGreaterThan(0);
        expect(race, `round ${round}`).toBe(qualifying + 1);
      }
      expect(new Set(beats.map((b) => JSON.stringify(b))).size).toBe(beats.length);
    });

    it(`walks a ${rounds}-round season in strictly increasing order`, () => {
      const places = walk(rounds, true, true).map((beat): Place => ({ year: 1984, beat }));
      for (let i = 1; i < places.length; i += 1) {
        expect(comparePlaces(places[i - 1] as Place, places[i] as Place), `step ${i}`).toBeLessThan(
          0,
        );
      }
    });

    it(`agrees with isReached at every point of a ${rounds}-round season`, () => {
      const places = walk(rounds, true, true).map((beat): Place => ({ year: 1984, beat }));
      places.forEach((cursor, i) => {
        places.forEach((place, j) => {
          expect(isReached(cursor, place), `cursor ${i}, place ${j}`).toBe(j <= i);
        });
      });
    });
  }

  it("ends a one-year run at the summary", () => {
    expect(nextBeat({ kind: "summary" }, 7, false, true)).toBeNull();
  });

  it("leads an era's summary to its review, and the review to the next year's grid", () => {
    expect(nextBeat({ kind: "summary" }, 7, true, true)).toEqual({ kind: "review" });
    expect(nextBeat({ kind: "review" }, 7, true, true)).toEqual({ kind: "grid" });
  });

  it("ends an era at the review of its last year", () => {
    expect(nextBeat({ kind: "review" }, 7, true, false)).toBeNull();
  });

  it("goes straight from the grid to the summary of a season with no rounds", () => {
    expect(advance({ kind: "grid" }, 0)).toEqual({ kind: "summary" });
  });

  it("keeps the summary where it is within one season", () => {
    expect(advance({ kind: "summary" }, 7)).toEqual({ kind: "summary" });
  });
});

describe("comparing places", () => {
  it("puts every beat of a year before every beat of the next", () => {
    const lastOfYear: Place = { year: 1984, beat: { kind: "review" } };
    const firstOfNext: Place = { year: 1985, beat: { kind: "grid" } };
    expect(comparePlaces(lastOfYear, firstOfNext)).toBeLessThan(0);
    expect(isReached(firstOfNext, lastOfYear)).toBe(true);
    expect(isReached(lastOfYear, firstOfNext)).toBe(false);
  });

  it("calls a place reached when it is the cursor itself", () => {
    const here: Place = { year: 1984, beat: { kind: "race", round: 2 } };
    expect(comparePlaces(here, { ...here })).toBe(0);
    expect(isReached(here, { ...here })).toBe(true);
  });
});

describe("the beat in words", () => {
  it("names where in the season the run is", () => {
    expect(describeBeat({ kind: "grid" }, 14)).toBe("Grid");
    expect(describeBeat({ kind: "qualifying", round: 0 }, 14)).toBe("Round 1/14 · Qualifying");
    expect(describeBeat({ kind: "race", round: 13 }, 14)).toBe("Round 14/14 · Race");
    expect(describeBeat({ kind: "summary" }, 14)).toBe("Season summary");
    expect(describeBeat({ kind: "review" }, 14)).toBe("Between seasons");
  });
});
