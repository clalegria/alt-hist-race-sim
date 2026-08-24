import { describe, expect, it } from "vitest";
import { RACE_CONSTANTS, type RaceConstants } from "../race/constants.js";
import { simulateRace } from "../race/simulateRace.js";
import type { RaceEntrant, RaceModel, RoundContext } from "../race/types.js";
import { createRng } from "../rng/index.js";
import { simulateSeason } from "./simulateSeason.js";
import { championshipStandings, pointsForPosition } from "./standings.js";
import type { PointsScale } from "./types.js";

/** The scale these seasons are scored on: 9-6-4-3-2-1, as 1961 to 1990 paid. */
const CLASSIC: PointsScale = [9, 6, 4, 3, 2, 1];

function entrant(driverId: string, teamId: string, ability: number, car: number): RaceEntrant {
  return {
    driverId,
    teamId,
    driver: {
      racing: ability,
      qualifying: ability,
      consistency: ability,
      adaptability: ability,
      composure: ability,
    },
    car: { racing: car, qualifying: car, consistency: car, reliability: car },
  };
}

/** Twenty cars, strongest first. */
function field(): RaceEntrant[] {
  return Array.from({ length: 20 }, (_, i) =>
    entrant(`driver-${i}`, `team-${i}`, 90 - i * 2, 90 - i * 2),
  );
}

/**
 * A calendar of `n` rounds that say nothing about themselves — the season
 * equivalent of the old round count, and neutral ground for every test that is
 * not about where a race is held.
 */
function rounds(n: number): RoundContext[] {
  return Array.from({ length: n }, () => ({}));
}

const NO_DNFS: RaceConstants = {
  ...RACE_CONSTANTS,
  mechanicalDnfAtZeroReliability: 0,
  mechanicalDnfAtFullReliability: 0,
  driverErrorDnfAtZeroComposure: 0,
  driverErrorDnfAtFullComposure: 0,
};

describe("season validation", () => {
  it("rejects a season with no rounds", () => {
    expect(() => simulateSeason(field(), [], createRng(1))).toThrow(RangeError);
    expect(() => simulateSeason(field(), [], createRng(1))).toThrow(/at least one round/);
  });

  it("passes an invalid field through to the race model", () => {
    expect(() => simulateSeason([], rounds(14), createRng(1))).toThrow(RangeError);
  });
});

describe("running a season", () => {
  it("runs exactly the rounds asked for", () => {
    expect(simulateSeason(field(), rounds(14), createRng(1)).races).toHaveLength(14);
    expect(simulateSeason(field(), rounds(1), createRng(1)).races).toHaveLength(1);
  });

  it("gives every round the whole field", () => {
    for (const race of simulateSeason(field(), rounds(14), createRng(1)).races) {
      expect(race.entries).toHaveLength(20);
    }
  });

  it("is deterministic for a seed", () => {
    const first = simulateSeason(field(), rounds(14), createRng(99));
    const again = simulateSeason(field(), rounds(14), createRng(99));
    expect(first).toEqual(again);
  });

  it("gives different seasons to different seeds", () => {
    const a = simulateSeason(field(), rounds(14), createRng(1));
    const b = simulateSeason(field(), rounds(14), createRng(2));
    expect(a).not.toEqual(b);
  });

  it("does not replay the same race fourteen times", () => {
    // One RNG threaded through the season, not re-seeded per round. If it were
    // re-seeded, every round would be identical.
    const winners = simulateSeason(field(), rounds(14), createRng(3)).races.map(
      (r) => r.winnerDriverId,
    );
    expect(new Set(winners).size).toBeGreaterThan(1);
  });

  it("continues one RNG stream across rounds", () => {
    // Round 2 of a season must be what the same stream produces after round 1,
    // not a fresh race. Running two rounds and one round from the same seed
    // proves round 1 matches and round 2 had to come from the continued stream.
    const two = simulateSeason(field(), rounds(2), createRng(7));
    const one = simulateSeason(field(), rounds(1), createRng(7));
    expect(two.races[0]).toEqual(one.races[0]);
    expect(two.races[1]).not.toEqual(two.races[0]);
  });

  it("honours the race constants it is given", () => {
    const season = simulateSeason(field(), rounds(14), createRng(5), NO_DNFS);
    expect(season.races.every((race) => race.retirements === 0)).toBe(true);
  });

  it("uses the race model it is given", () => {
    // The model is a seam; the season must go through it rather than reaching
    // for `simulateRace` directly.
    let calls = 0;
    const spy: RaceModel = {
      name: "spy",
      simulate: (entrants, rng, constants) => {
        calls += 1;
        return simulateRace(entrants, rng, constants);
      },
    };
    simulateSeason(field(), rounds(14), createRng(1), RACE_CONSTANTS, spy);
    expect(calls).toBe(14);
  });

  it("hands each round its own context, in calendar order", () => {
    // The reason the loop takes a calendar at all: a round is a place, and the
    // race model cannot know where it is unless this passes it on.
    const calendar: RoundContext[] = [{ country: "BR" }, { country: "ZA" }, {}];
    const seen: (RoundContext | undefined)[] = [];
    const spy: RaceModel = {
      name: "spy",
      simulate: (entrants, rng, constants, round) => {
        seen.push(round);
        return simulateRace(entrants, rng, constants, round);
      },
    };
    simulateSeason(field(), calendar, createRng(1), RACE_CONSTANTS, spy);
    expect(seen).toEqual(calendar);
  });
});

describe("a season and its championship", () => {
  it("awards the season's points to the drivers who scored them", () => {
    const season = simulateSeason(field(), rounds(14), createRng(21), NO_DNFS);
    const table = championshipStandings(season, CLASSIC);

    // Recompute independently from the raw results: the table must be derived,
    // with nothing accumulated along the way that the results do not justify.
    const expected = new Map<string, number>();
    for (const race of season.races) {
      for (const entry of race.entries) {
        if (entry.finishPosition !== null) {
          expected.set(
            entry.driverId,
            (expected.get(entry.driverId) ?? 0) + pointsForPosition(entry.finishPosition, CLASSIC),
          );
        }
      }
    }
    for (const standing of table) {
      expect(standing.points).toBe(expected.get(standing.driverId) ?? 0);
    }
  });

  it("hands the title to the fastest car over a long season", () => {
    // Not a certainty in one race; over 30 rounds with no retirements it should
    // be. If this ever fails, the pace model has stopped rewarding pace.
    const table = championshipStandings(
      simulateSeason(field(), rounds(30), createRng(8), NO_DNFS),
      CLASSIC,
    );
    expect(table[0]?.driverId).toBe("driver-0");
  });

  it("puts every driver in the table exactly once", () => {
    const table = championshipStandings(simulateSeason(field(), rounds(14), createRng(4)), CLASSIC);
    expect(table).toHaveLength(20);
    expect(new Set(table.map((s) => s.driverId)).size).toBe(20);
  });

  it("accounts for every entry as a start or a non-qualification", () => {
    const season = simulateSeason(field(), rounds(14), createRng(12));
    for (const standing of championshipStandings(season, CLASSIC)) {
      expect(standing.starts + standing.nonQualifications).toBe(14);
      expect(standing.retirements).toBeLessThanOrEqual(standing.starts);
    }
  });

  it("awards points totalling the scale, every round", () => {
    // Nobody retires and the field is far bigger than the points table, so
    // every round must pay out the whole scale: 9+6+4+3+2+1 = 25.
    const season = simulateSeason(field(), rounds(14), createRng(15), NO_DNFS);
    const total = championshipStandings(season, CLASSIC).reduce((sum, s) => sum + s.points, 0);
    expect(total).toBe(25 * 14);
  });
});
