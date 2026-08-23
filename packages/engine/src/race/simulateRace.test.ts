import { describe, expect, it } from "vitest";
import { createRng } from "../rng/index.js";
import type { Rng } from "../rng/types.js";
import { RACE_CONSTANTS, type RaceConstants } from "./constants.js";
import { scoreAndSortRaceModel, simulateRace } from "./simulateRace.js";
import type { RaceEntrant, RaceEntryResult, RaceResult } from "./types.js";

function entrant(
  driverId: string,
  teamId: string,
  ability: number,
  carAbility: number,
): RaceEntrant {
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
    car: {
      racing: carAbility,
      qualifying: carAbility,
      consistency: carAbility,
      reliability: carAbility,
    },
  };
}

/** A field of 20 evenly spread cars, strongest first. */
function spreadField(): RaceEntrant[] {
  return Array.from({ length: 20 }, (_, i) =>
    entrant(`driver-${i}`, `team-${i}`, 90 - i * 2, 90 - i * 2),
  );
}

/** More cars than the race can take, so the starting limit has to bite. */
function oversubscribedField(size: number): RaceEntrant[] {
  return Array.from({ length: size }, (_, i) =>
    entrant(`driver-${i}`, `team-${i}`, 90 - i, 90 - i),
  );
}

/**
 * The same four cars, differing only in where their driver and team are from.
 *
 * `driver-a` sorts first on the id tie-break, so with the noise turned off it
 * starts from pole whether or not it is at home — which is what makes the race
 * score comparable across rounds, the grid bonus being equal on both sides.
 */
function nationalField(): RaceEntrant[] {
  const plain = (id: string, driverCountry?: string, teamCountry?: string): RaceEntrant => ({
    ...entrant(id, `team-${id}`, 70, 70),
    ...(driverCountry === undefined ? {} : { driverCountry }),
    ...(teamCountry === undefined ? {} : { teamCountry }),
  });
  return [
    plain("driver-a", "IT", "IT"),
    plain("driver-b", "IT", "GB"),
    plain("driver-c", "BR", "IT"),
    plain("driver-d", "BR", "GB"),
  ];
}

/** Scores with no noise at all, so a bonus can be read off exactly. */
const NO_NOISE: RaceConstants = {
  ...RACE_CONSTANTS,
  qualifyingNoise: 0,
  racingNoise: 0,
  mechanicalDnfAtZeroReliability: 0,
  mechanicalDnfAtFullReliability: 0,
  driverErrorDnfAtZeroComposure: 0,
  driverErrorDnfAtFullComposure: 0,
};

/** One car's row, by driver id. */
function entryOf(result: RaceResult, driverId: string): RaceEntryResult {
  const entry = result.entries.find((candidate) => candidate.driverId === driverId);
  if (entry === undefined) {
    throw new Error(`no entry for ${driverId}`);
  }
  return entry;
}

/** Constants with retirements switched off, to isolate the pace model. */
const NO_DNFS: RaceConstants = {
  ...RACE_CONSTANTS,
  mechanicalDnfAtZeroReliability: 0,
  mechanicalDnfAtFullReliability: 0,
  driverErrorDnfAtZeroComposure: 0,
  driverErrorDnfAtFullComposure: 0,
};

describe("field validation", () => {
  it("rejects an empty field", () => {
    expect(() => simulateRace([], createRng(1))).toThrow(RangeError);
  });

  it("rejects a duplicated driver", () => {
    const field = [entrant("jones", "williams", 90, 92), entrant("jones", "ligier", 84, 90)];
    expect(() => simulateRace(field, createRng(1))).toThrow(/twice/);
  });
});

describe("grid and finishing order", () => {
  it("returns one result per entrant, in field order", () => {
    const field = spreadField();
    const result = simulateRace(field, createRng(1));
    expect(result.entries).toHaveLength(field.length);
    expect(result.entries.map((e) => e.driverId)).toEqual(field.map((e) => e.driverId));
  });

  it("produces a grid that is a valid permutation", () => {
    const result = simulateRace(spreadField(), createRng(2));
    const grid = result.entries.map((e) => e.gridPosition).sort((a, b) => a - b);
    expect(grid).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it("produces a finishing order that is a valid permutation of the classified cars", () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      const result = simulateRace(spreadField(), createRng(seed));
      const finishers = result.entries
        .filter((e) => !e.retired)
        .map((e) => e.finishPosition)
        .sort((a, b) => (a ?? 0) - (b ?? 0));
      expect(finishers).toEqual(Array.from({ length: finishers.length }, (_, i) => i + 1));
    }
  });

  it("never places a driver twice", () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      const result = simulateRace(spreadField(), createRng(seed));
      const positions = result.entries.filter((e) => !e.retired).map((e) => e.finishPosition);
      expect(new Set(positions).size).toBe(positions.length);

      const drivers = result.entries.map((e) => e.driverId);
      expect(new Set(drivers).size).toBe(drivers.length);
    }
  });

  it("puts the pole sitter on the front of the grid", () => {
    const result = simulateRace(spreadField(), createRng(3));
    const pole = result.entries.find((e) => e.driverId === result.poleDriverId);
    expect(pole?.gridPosition).toBe(1);
  });

  it("names the classified leader as the winner", () => {
    const result = simulateRace(spreadField(), createRng(4), NO_DNFS);
    const winner = result.entries.find((e) => e.driverId === result.winnerDriverId);
    expect(winner?.finishPosition).toBe(1);
    expect(winner?.retired).toBe(false);
  });

  it("orders classified cars by race score", () => {
    const result = simulateRace(spreadField(), createRng(5), NO_DNFS);
    const byFinish = result.entries
      .filter((e) => !e.retired)
      .sort((a, b) => (a.finishPosition ?? 0) - (b.finishPosition ?? 0));
    for (let i = 1; i < byFinish.length; i += 1) {
      const ahead = byFinish[i - 1];
      const behind = byFinish[i];
      expect(ahead?.raceScore).toBeGreaterThanOrEqual(behind?.raceScore ?? 0);
    }
  });
});

describe("the starting limit", () => {
  it("starts only the fastest cars and marks the rest DNQ", () => {
    const field = oversubscribedField(30);
    const result = simulateRace(field, createRng(1));
    expect(result.entries.filter((e) => e.started)).toHaveLength(RACE_CONSTANTS.maxStarters);
    expect(result.nonQualifiers).toBe(30 - RACE_CONSTANTS.maxStarters);
  });

  it("qualifies the whole entry list, limit or no limit", () => {
    // Everyone gets their Saturday: the cut decides who races, not who runs.
    const result = simulateRace(oversubscribedField(30), createRng(3));
    const grid = result.entries.map((e) => e.gridPosition).sort((a, b) => a - b);
    expect(grid).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    expect(result.entries.every((e) => Number.isFinite(e.qualifyingScore))).toBe(true);
  });

  it("cuts on qualifying position, not on race pace", () => {
    for (let seed = 1; seed <= 100; seed += 1) {
      const result = simulateRace(oversubscribedField(30), createRng(seed));
      for (const entry of result.entries) {
        expect(entry.started).toBe(entry.gridPosition <= RACE_CONSTANTS.maxStarters);
      }
    }
  });

  it("does not count a non-qualifier as a retirement", () => {
    // A DNQ is a weekend that ended on Saturday, not a car that broke. Folding
    // the two together would inflate every reliability number in the harness.
    for (let seed = 1; seed <= 100; seed += 1) {
      const result = simulateRace(oversubscribedField(30), createRng(seed));
      for (const entry of result.entries.filter((e) => !e.started)) {
        expect(entry.retired).toBe(false);
        expect(entry.dnfCause).toBeNull();
        expect(entry.mechanicalFailure).toBe(false);
        expect(entry.driverError).toBe(false);
        expect(entry.finishPosition).toBeNull();
        expect(entry.raceScore).toBeNull();
      }
    }
  });

  it("counts retirements and classifications against the starters", () => {
    for (let seed = 1; seed <= 100; seed += 1) {
      const result = simulateRace(oversubscribedField(30), createRng(seed));
      expect(result.classifiedCount + result.retirements).toBe(RACE_CONSTANTS.maxStarters);
      expect(result.classifiedCount + result.retirements + result.nonQualifiers).toBe(30);
    }
  });

  it("keeps a non-qualifier out of the finishing order", () => {
    for (let seed = 1; seed <= 100; seed += 1) {
      const result = simulateRace(oversubscribedField(30), createRng(seed), NO_DNFS);
      const finishers = result.entries
        .filter((e) => e.finishPosition !== null)
        .map((e) => e.finishPosition)
        .sort((a, b) => (a ?? 0) - (b ?? 0));
      expect(finishers).toEqual(
        Array.from({ length: RACE_CONSTANTS.maxStarters }, (_, i) => i + 1),
      );
      expect(result.entries.find((e) => e.driverId === result.winnerDriverId)?.started).toBe(true);
    }
  });

  it("leaves a field inside the limit alone", () => {
    const result = simulateRace(spreadField(), createRng(1));
    expect(result.nonQualifiers).toBe(0);
    expect(result.entries.every((e) => e.started)).toBe(true);
  });

  it("honours a limit passed through the constants", () => {
    const result = simulateRace(spreadField(), createRng(1), { ...RACE_CONSTANTS, maxStarters: 5 });
    expect(result.entries.filter((e) => e.started)).toHaveLength(5);
    expect(result.nonQualifiers).toBe(15);
  });
});

describe("retirements", () => {
  it("excludes retired cars from the classified order", () => {
    for (let seed = 1; seed <= 100; seed += 1) {
      const result = simulateRace(spreadField(), createRng(seed));
      for (const entry of result.entries) {
        if (entry.retired) {
          expect(entry.finishPosition).toBeNull();
          expect(entry.dnfCause).not.toBeNull();
        } else {
          expect(entry.finishPosition).not.toBeNull();
          expect(entry.dnfCause).toBeNull();
        }
      }
      expect(result.classifiedCount + result.retirements).toBe(result.entries.length);
      expect(result.entries.filter((e) => e.retired)).toHaveLength(result.retirements);
    }
  });

  it("records both causes independently, with mechanical taking precedence", () => {
    let sawBoth = false;
    for (let seed = 1; seed <= 400 && !sawBoth; seed += 1) {
      const result = simulateRace(spreadField(), createRng(seed));
      for (const entry of result.entries) {
        if (entry.mechanicalFailure && entry.driverError) {
          expect(entry.dnfCause).toBe("mechanical");
          sawBoth = true;
        }
        if (entry.mechanicalFailure) {
          expect(entry.retired).toBe(true);
        }
        if (entry.dnfCause === "driver-error") {
          expect(entry.mechanicalFailure).toBe(false);
          expect(entry.driverError).toBe(true);
        }
      }
    }
    // The precedence rule is only meaningful if the double failure actually occurs.
    expect(sawBoth).toBe(true);
  });

  it("retires nobody when DNF rates are zero", () => {
    const result = simulateRace(spreadField(), createRng(6), NO_DNFS);
    expect(result.retirements).toBe(0);
    expect(result.classifiedCount).toBe(20);
  });

  it("retires everyone when DNF rates are certain", () => {
    const allFail: RaceConstants = {
      ...RACE_CONSTANTS,
      mechanicalDnfAtZeroReliability: 1,
      mechanicalDnfAtFullReliability: 1,
    };
    const result = simulateRace(spreadField(), createRng(7), allFail);
    expect(result.classifiedCount).toBe(0);
    expect(result.winnerDriverId).toBeNull();
    // Qualifying still happened, so pole is still recorded.
    expect(result.poleDriverId).not.toBe("");
  });

  it("retires unreliable cars more often than reliable ones", () => {
    const field = [entrant("solid", "a", 70, 95), entrant("fragile", "b", 70, 20)];
    let solidDnfs = 0;
    let fragileDnfs = 0;
    for (let seed = 1; seed <= 2000; seed += 1) {
      for (const entry of simulateRace(field, createRng(seed)).entries) {
        if (entry.mechanicalFailure && entry.driverId === "solid") {
          solidDnfs += 1;
        }
        if (entry.mechanicalFailure && entry.driverId === "fragile") {
          fragileDnfs += 1;
        }
      }
    }
    expect(fragileDnfs).toBeGreaterThan(solidDnfs * 2);
  });

  it("scales mechanical failures with the era multiplier", () => {
    const modern: RaceConstants = { ...RACE_CONSTANTS, mechanicalDnfEraScale: 0.25 };
    const count = (constants: RaceConstants): number => {
      let total = 0;
      for (let seed = 1; seed <= 500; seed += 1) {
        total += simulateRace(spreadField(), createRng(seed), constants).entries.filter(
          (e) => e.mechanicalFailure,
        ).length;
      }
      return total;
    };
    expect(count(modern)).toBeLessThan(count(RACE_CONSTANTS) / 2);
  });
});

describe("gaps", () => {
  it("puts the pole sitter and the winner on zero", () => {
    const result = simulateRace(spreadField(), createRng(4));
    const pole = result.entries.find((e) => e.driverId === result.poleDriverId);
    expect(pole?.qualifyingGapToPole).toBe(0);
    const winner = result.entries.find((e) => e.driverId === result.winnerDriverId);
    expect(winner?.raceGapToWinner).toEqual({ kind: "time", seconds: 0 });
  });

  it("orders qualifying gaps by grid position", () => {
    // A gap that disagreed with the order it was derived from would be worse
    // than no gap at all.
    const byGrid = [...simulateRace(spreadField(), createRng(6)).entries].sort(
      (a, b) => a.gridPosition - b.gridPosition,
    );
    for (let i = 1; i < byGrid.length; i += 1) {
      expect(byGrid[i]?.qualifyingGapToPole ?? 0).toBeGreaterThan(
        byGrid[i - 1]?.qualifyingGapToPole ?? 0,
      );
    }
  });

  it("orders race gaps by finishing position", () => {
    const seconds = (entry: RaceEntryResult | undefined): number => {
      const gap = entry?.raceGapToWinner;
      if (gap === null || gap === undefined) {
        return -1;
      }
      return gap.kind === "time" ? gap.seconds : gap.laps * RACE_CONSTANTS.nominalLapSeconds;
    };
    const byFinish = simulateRace(spreadField(), createRng(6), NO_DNFS)
      .entries.filter((e) => e.finishPosition !== null)
      .sort((a, b) => (a.finishPosition ?? 0) - (b.finishPosition ?? 0));
    for (let i = 1; i < byFinish.length; i += 1) {
      expect(seconds(byFinish[i])).toBeGreaterThanOrEqual(seconds(byFinish[i - 1]));
    }
  });

  it("gives a retirement and a non-qualifier no race gap", () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      const result = simulateRace(oversubscribedField(30), createRng(seed));
      for (const entry of result.entries) {
        if (entry.finishPosition === null) {
          expect(entry.raceGapToWinner).toBeNull();
        } else {
          expect(entry.raceGapToWinner).not.toBeNull();
        }
      }
    }
  });

  it("still gives a non-qualifier a qualifying gap", () => {
    // They ran on Saturday; being slowest is exactly what the gap should show.
    const result = simulateRace(oversubscribedField(30), createRng(2));
    for (const entry of result.entries.filter((e) => !e.started)) {
      expect(entry.qualifyingGapToPole).toBeGreaterThan(0);
    }
  });

  it("leaves nobody with a gap when every car retires", () => {
    const allRetire: RaceConstants = {
      ...RACE_CONSTANTS,
      mechanicalDnfAtZeroReliability: 1,
      mechanicalDnfAtFullReliability: 1,
    };
    const result = simulateRace(spreadField(), createRng(1), allRetire);
    expect(result.winnerDriverId).toBeNull();
    expect(result.entries.every((e) => e.raceGapToWinner === null)).toBe(true);
  });

  it("is decoration: changing the gap constants cannot change the result", () => {
    const stretched: RaceConstants = {
      ...RACE_CONSTANTS,
      qualifyingGapSecondsPerPoint: 9,
      raceGapSecondsAtOnePoint: 40,
      raceGapExponent: 2.5,
      nominalLapSeconds: 3,
    };
    const plain = simulateRace(spreadField(), createRng(11));
    const odd = simulateRace(spreadField(), createRng(11), stretched);
    expect(odd.entries.map((e) => e.finishPosition)).toEqual(
      plain.entries.map((e) => e.finishPosition),
    );
    expect(odd.entries.map((e) => e.gridPosition)).toEqual(
      plain.entries.map((e) => e.gridPosition),
    );
    expect(odd.winnerDriverId).toBe(plain.winnerDriverId);
  });
});

describe("home advantage", () => {
  const italy = { country: "IT" } as const;

  it("is worth nothing at a round that names no country", () => {
    // The default, and what every caller that does not know its calendar gets:
    // a race scored exactly as it was before home advantage existed.
    const withRound = simulateRace(nationalField(), createRng(1), NO_NOISE, {});
    const without = simulateRace(nationalField(), createRng(1), NO_NOISE);
    expect(withRound).toEqual(without);
  });

  it("is worth nothing to a car from somewhere else", () => {
    const home = simulateRace(nationalField(), createRng(1), NO_NOISE, italy);
    const neutral = simulateRace(nationalField(), createRng(1), NO_NOISE);
    // Brazilian driver, British team: at Monza they are visitors twice over.
    expect(entryOf(home, "driver-d").qualifyingScore).toBeCloseTo(
      entryOf(neutral, "driver-d").qualifyingScore,
      10,
    );
  });

  it("pays the driver's share, the team's share, or both", () => {
    const home = simulateRace(nationalField(), createRng(1), NO_NOISE, italy);
    const neutral = simulateRace(nationalField(), createRng(1), NO_NOISE);
    const gained = (driverId: string): number =>
      entryOf(home, driverId).qualifyingScore - entryOf(neutral, driverId).qualifyingScore;

    // An Italian in an Italian car collects both halves; the other two collect
    // one each, and the constants say which is the larger.
    expect(gained("driver-a")).toBeCloseTo(
      NO_NOISE.homeAdvantageDriver + NO_NOISE.homeAdvantageTeam,
      10,
    );
    expect(gained("driver-b")).toBeCloseTo(NO_NOISE.homeAdvantageDriver, 10);
    expect(gained("driver-c")).toBeCloseTo(NO_NOISE.homeAdvantageTeam, 10);
    expect(gained("driver-d")).toBeCloseTo(0, 10);
  });

  it("pays the same into the race as into qualifying", () => {
    const home = simulateRace(nationalField(), createRng(1), NO_NOISE, italy);
    const neutral = simulateRace(nationalField(), createRng(1), NO_NOISE);
    // `driver-a` starts from pole in both, so the grid bonus cancels and what
    // is left of the difference is the home bonus itself.
    expect(entryOf(home, "driver-a").gridPosition).toBe(1);
    expect(entryOf(neutral, "driver-a").gridPosition).toBe(1);
    expect(
      (entryOf(home, "driver-a").raceScore ?? 0) - (entryOf(neutral, "driver-a").raceScore ?? 0),
    ).toBeCloseTo(NO_NOISE.homeAdvantageDriver + NO_NOISE.homeAdvantageTeam, 10);
  });

  it("changes nobody's order when the whole field is at home", () => {
    // Only differences between cars move a result, so a bonus everyone collects
    // is invisible — which is why a British-dominated grid at Brands Hatch is
    // really about the visitors losing ground.
    const allBritish = nationalField().map((car) => ({
      ...car,
      driverCountry: "GB",
      teamCountry: "GB",
    }));
    const home = simulateRace(allBritish, createRng(4), RACE_CONSTANTS, { country: "GB" });
    const neutral = simulateRace(allBritish, createRng(4), RACE_CONSTANTS);
    expect(home.entries.map((e) => e.finishPosition)).toEqual(
      neutral.entries.map((e) => e.finishPosition),
    );
    expect(home.poleDriverId).toBe(neutral.poleDriverId);
  });

  it("reads a country code however it is written", () => {
    const shouty = simulateRace(nationalField(), createRng(1), NO_NOISE, { country: " it " });
    const plain = simulateRace(nationalField(), createRng(1), NO_NOISE, italy);
    expect(shouty).toEqual(plain);
  });

  it("switches off entirely when both constants are zero", () => {
    const off: RaceConstants = { ...NO_NOISE, homeAdvantageDriver: 0, homeAdvantageTeam: 0 };
    expect(simulateRace(nationalField(), createRng(1), off, italy)).toEqual(
      simulateRace(nationalField(), createRng(1), off),
    );
  });

  it("draws no dice of its own", () => {
    // A term that consumed randomness would make where a race is held change
    // every later round of the season, which is not what a home crowd does.
    const home = createRng(5);
    simulateRace(nationalField(), home, NO_NOISE, italy);
    const away = createRng(5);
    simulateRace(nationalField(), away, NO_NOISE);
    expect(home.getState()).toEqual(away.getState());
  });
});

describe("determinism", () => {
  it("reproduces the same race from the same seed", () => {
    const field = spreadField();
    const a = simulateRace(field, createRng(1980));
    const b = simulateRace(field, createRng(1980));
    expect(a).toEqual(b);
  });

  it("produces different races from different seeds", () => {
    const field = spreadField();
    const a = simulateRace(field, createRng(1980));
    const b = simulateRace(field, createRng(1981));
    expect(a).not.toEqual(b);
  });

  it("does not mutate the field it is given", () => {
    const field = spreadField();
    const snapshot = JSON.parse(JSON.stringify(field));
    simulateRace(field, createRng(8));
    expect(field).toEqual(snapshot);
  });

  it("keeps a car's draws independent of cars added after it", () => {
    // Draws are made in field order, one pass per stage, so appending an
    // entrant must not disturb the existing field's qualifying scores.
    const base = spreadField();
    const extended = [...base, entrant("late-entry", "team-x", 60, 60)];
    const a = simulateRace(base, createRng(9));
    const b = simulateRace(extended, createRng(9));
    for (let i = 0; i < base.length; i += 1) {
      expect(b.entries[i]?.qualifyingScore).toBeCloseTo(a.entries[i]?.qualifyingScore ?? 0, 10);
    }
  });
});

describe("ratings drive results", () => {
  function winRate(
    field: readonly RaceEntrant[],
    driverId: string,
    races: number,
    constants: RaceConstants = RACE_CONSTANTS,
  ): number {
    let wins = 0;
    for (let seed = 1; seed <= races; seed += 1) {
      if (simulateRace(field, createRng(seed), constants).winnerDriverId === driverId) {
        wins += 1;
      }
    }
    return wins / races;
  }

  it("lets the better combination win far more often", () => {
    const field = [entrant("strong", "top", 90, 92), entrant("weak", "back", 50, 45)];
    const strongRate = winRate(field, "strong", 1000);
    expect(strongRate).toBeGreaterThan(0.7);
    expect(winRate(field, "weak", 1000)).toBeLessThan(strongRate);
  });

  it("weights the car more heavily than the driver", () => {
    // A great driver in a poor car should lose to a modest driver in a good one.
    // Retirements are disabled so this measures pace only: with DNFs on, the
    // journeyman's win rate is capped by his own ~25% failure rate, which says
    // nothing about the weighting.
    const field = [entrant("ace-bad-car", "back", 95, 62), entrant("journeyman", "top", 75, 92)];
    expect(winRate(field, "journeyman", 1000, NO_DNFS)).toBeGreaterThan(0.95);
  });

  it("still lets a poor car win occasionally through attrition", () => {
    // The same pairing with retirements on: the ace's wins now come from the
    // faster car breaking, which is the main upset channel in 1980.
    const field = [entrant("ace-bad-car", "back", 95, 62), entrant("journeyman", "top", 75, 92)];
    const aceRate = winRate(field, "ace-bad-car", 1000);
    expect(aceRate).toBeGreaterThan(0.05);
    expect(aceRate).toBeLessThan(0.35);
  });

  it("gives a monotonic win ordering across a graded field", () => {
    const field = spreadField();
    const wins = new Map<string, number>();
    for (let seed = 1; seed <= 3000; seed += 1) {
      const winner = simulateRace(field, createRng(seed)).winnerDriverId;
      if (winner !== null) {
        wins.set(winner, (wins.get(winner) ?? 0) + 1);
      }
    }
    // The strongest car should out-win the fourth-strongest, which should in
    // turn beat anything from the back half of the grid.
    expect(wins.get("driver-0") ?? 0).toBeGreaterThan(wins.get("driver-3") ?? 0);
    expect(wins.get("driver-3") ?? 0).toBeGreaterThan(wins.get("driver-15") ?? 0);
  });

  it("gives pole an advantage without making it decisive", () => {
    // An even field isolates the grid bonus: pole should convert more often
    // than a random slot, but nowhere near always.
    const field = Array.from({ length: 20 }, (_, i) => entrant(`even-${i}`, `team-${i}`, 75, 75));
    let poleWins = 0;
    let finishes = 0;
    for (let seed = 1; seed <= 2000; seed += 1) {
      const result: RaceResult = simulateRace(field, createRng(seed), NO_DNFS);
      if (result.winnerDriverId === result.poleDriverId) {
        poleWins += 1;
      }
      finishes += 1;
    }
    const conversion = poleWins / finishes;
    expect(conversion).toBeGreaterThan(1 / 20);
    expect(conversion).toBeLessThan(0.5);
  });
});

describe("consistency", () => {
  /** Two identical cars, differing only in driver consistency. */
  function consistencyPair(steady: number, erratic: number): RaceEntrant[] {
    const base = entrant("steady", "a", 70, 70);
    return [
      { ...base, driver: { ...base.driver, consistency: steady } },
      {
        ...base,
        driverId: "erratic",
        teamId: "b",
        driver: { ...base.driver, consistency: erratic },
      },
    ];
  }

  function meanScores(
    field: readonly RaceEntrant[],
    driverId: string,
    races: number,
    constants: RaceConstants = NO_DNFS,
  ): { qualifying: number; race: number } {
    let qualifying = 0;
    let race = 0;
    for (let seed = 1; seed <= races; seed += 1) {
      const entry = simulateRace(field, createRng(seed), constants).entries.find(
        (e) => e.driverId === driverId,
      );
      qualifying += entry?.qualifyingScore ?? 0;
      race += entry?.raceScore ?? 0;
    }
    return { qualifying: qualifying / races, race: race / races };
  }

  it("costs an erratic driver pace in the race", () => {
    const field = consistencyPair(90, 20);
    expect(meanScores(field, "erratic", 4000).race).toBeLessThan(
      meanScores(field, "steady", 4000).race - 1,
    );
  });

  it("costs an erratic driver pace in qualifying too", () => {
    // Consistency used to be invisible on Saturday. It is not any more.
    const field = consistencyPair(90, 20);
    expect(meanScores(field, "erratic", 4000).qualifying).toBeLessThan(
      meanScores(field, "steady", 4000).qualifying - 1,
    );
  });

  it("makes the erratic driver worse on every measure, wins included", () => {
    // There must be no compensating upside anywhere. A spread-based lever
    // would show the erratic driver winning MORE while finishing worse.
    const field = consistencyPair(90, 20);
    let steadyWins = 0;
    let erraticWins = 0;
    let steadyPoles = 0;
    let erraticPoles = 0;
    for (let seed = 1; seed <= 6000; seed += 1) {
      const result = simulateRace(field, createRng(seed), NO_DNFS);
      if (result.winnerDriverId === "steady") {
        steadyWins += 1;
      }
      if (result.winnerDriverId === "erratic") {
        erraticWins += 1;
      }
      if (result.poleDriverId === "steady") {
        steadyPoles += 1;
      }
      if (result.poleDriverId === "erratic") {
        erraticPoles += 1;
      }
    }
    expect(erraticWins).toBeLessThan(steadyWins);
    expect(erraticPoles).toBeLessThan(steadyPoles);
  });

  it("does not let a slow erratic car steal wins from a field", () => {
    // The pathology this model exists to kill, and the case a two-car test
    // cannot see: winning from behind is an upper-tail event, so a lever that
    // widens the spread lets the SLOWEST car win more the more erratic it is.
    // Here the subject is the slowest of five and must win strictly less as
    // its consistency drops.
    const fieldWith = (consistency: number): RaceEntrant[] => [
      entrant("ace1", "t1", 84, 86),
      entrant("ace2", "t2", 82, 85),
      entrant("ace3", "t3", 81, 84),
      entrant("ace4", "t4", 80, 83),
      {
        ...entrant("subject", "t5", 76, 78),
        driver: { ...entrant("subject", "t5", 76, 78).driver, consistency },
      },
    ];
    const winRate = (consistency: number): number => {
      let wins = 0;
      for (let seed = 1; seed <= 12000; seed += 1) {
        if (
          simulateRace(fieldWith(consistency), createRng(seed), NO_DNFS).winnerDriverId ===
          "subject"
        ) {
          wins += 1;
        }
      }
      return wins / 12000;
    };
    expect(winRate(20)).toBeLessThan(winRate(90));
  });

  it("does not widen the erratic driver's spread", () => {
    // Consistency is a pace stat now, not a variance stat. Equal spreads are
    // what stops a wider upper tail handing back the wins the penalty took.
    const field = consistencyPair(90, 20);
    const spread = (driverId: string): number => {
      const scores: number[] = [];
      for (let seed = 1; seed <= 4000; seed += 1) {
        const entry = simulateRace(field, createRng(seed), NO_DNFS).entries.find(
          (e) => e.driverId === driverId,
        );
        scores.push(entry?.raceScore ?? 0);
      }
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      return Math.sqrt(scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length);
    };
    expect(spread("erratic")).toBeCloseTo(spread("steady"), 0);
  });

  it("levels the field when the penalty endpoints are equal", () => {
    const noPenalty: RaceConstants = {
      ...NO_DNFS,
      consistencyPacePenaltyAtZero: 0,
      consistencyPacePenaltyAtHundred: 0,
    };
    const field = consistencyPair(90, 20);
    const steady = meanScores(field, "steady", 4000, noPenalty).race;
    const erratic = meanScores(field, "erratic", 4000, noPenalty).race;
    // Same ratings, no penalty: only the grid bonus can separate them.
    expect(Math.abs(erratic - steady)).toBeLessThan(0.3);
  });
});

describe("weekend form", () => {
  /** Correlation between one driver's qualifying and race noise across seeds. */
  function noiseCorrelation(constants: RaceConstants): number {
    const field = spreadField();
    const qs: number[] = [];
    const rs: number[] = [];
    for (let seed = 1; seed <= 4000; seed += 1) {
      const entry = simulateRace(field, createRng(seed), constants).entries[5];
      if (entry === undefined || entry.raceScore === null) {
        continue;
      }
      qs.push(entry.qualifyingScore);
      // The grid bonus is the one non-noise term that varies race to race, so
      // subtract it to leave the race noise on its own.
      const bonus =
        constants.gridAdvantagePole *
        Math.exp(-(entry.gridPosition - 1) / constants.gridAdvantageDecayPlaces);
      rs.push(entry.raceScore - bonus);
    }
    const mean = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
    const mq = mean(qs);
    const mr = mean(rs);
    let cov = 0;
    let vq = 0;
    let vr = 0;
    for (let i = 0; i < qs.length; i += 1) {
      const dq = (qs[i] ?? 0) - mq;
      const dr = (rs[i] ?? 0) - mr;
      cov += dq * dr;
      vq += dq * dq;
      vr += dr * dr;
    }
    return cov / Math.sqrt(vq * vr);
  }

  it("correlates qualifying and race noise by the configured share", () => {
    const correlation = noiseCorrelation({ ...RACE_CONSTANTS, weekendFormShare: 0.4 });
    expect(correlation).toBeGreaterThan(0.3);
    expect(correlation).toBeLessThan(0.5);
  });

  it("leaves the sessions independent at a share of zero", () => {
    const correlation = noiseCorrelation({ ...RACE_CONSTANTS, weekendFormShare: 0 });
    expect(Math.abs(correlation)).toBeLessThan(0.08);
  });

  it("ties the race to qualifying at a share of one", () => {
    const correlation = noiseCorrelation({ ...RACE_CONSTANTS, weekendFormShare: 1 });
    expect(correlation).toBeGreaterThan(0.95);
  });

  it("keeps each session's total spread unchanged as the share moves", () => {
    // The sqrt weighting exists so that correlating the sessions does not
    // quietly make either of them noisier.
    const spreadOf = (share: number): number => {
      const field = spreadField();
      const scores: number[] = [];
      for (let seed = 1; seed <= 4000; seed += 1) {
        const entry = simulateRace(field, createRng(seed), {
          ...RACE_CONSTANTS,
          weekendFormShare: share,
        }).entries[5];
        scores.push(entry?.qualifyingScore ?? 0);
      }
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      return Math.sqrt(scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length);
    };
    expect(spreadOf(0.9)).toBeCloseTo(spreadOf(0.0), 0);
  });
});

describe("draw discipline", () => {
  /**
   * Counts every draw the simulation makes, `gaussian` included.
   *
   * Wrapping `next` alone is not enough: `gaussian` is its own method on the
   * interface and reaches the underlying stream without going through `next`
   * here, so a counter that only watches `next` sees the two DNF rolls and is
   * blind to the three noise draws.
   */
  function countingRng(seed: number): { rng: Rng; draws: () => number } {
    const inner = createRng(seed);
    let draws = 0;
    const rng: Rng = {
      next: () => {
        draws += 1;
        return inner.next();
      },
      getState: () => inner.getState(),
      nextInt: (min, max) => inner.nextInt(min, max),
      pick: (items) => inner.pick(items),
      shuffle: (items) => inner.shuffle(items),
      gaussian: (mean, sd) => {
        draws += 1;
        return inner.gaussian(mean, sd);
      },
    };
    return { rng, draws: () => draws };
  }

  it("keeps the draw count fixed across seeds", () => {
    // Weekend form adds a draw per car. If any path consumed a different
    // number of values, a car's stream position would depend on its
    // predecessors' luck and append-independence would break.
    const counted = (seed: number): number => {
      const { rng, draws } = countingRng(seed);
      simulateRace(spreadField(), rng);
      return draws();
    };
    const first = counted(1);
    for (let seed = 2; seed <= 200; seed += 1) {
      expect(counted(seed)).toBe(first);
    }
  });

  it("draws for non-qualifiers too, so the cut cannot shift the stream", () => {
    // A car that misses the cut still consumes its race noise and both DNF
    // rolls. If it did not, every car behind it in the field would slide up the
    // stream whenever the cut moved, and results would stop being additive.
    const field = oversubscribedField(30);
    const drawsFor = (size: number): number => {
      const { rng, draws } = countingRng(1);
      simulateRace(field.slice(0, size), rng);
      return draws();
    };
    // Measure the per-car cost on a field that fits inside the limit, where
    // every car indisputably runs, then hold the over-subscribed field to it.
    // Comparing two over-subscribed fields to each other would not do: skipped
    // draws would cancel out of the difference and the test would pass anyway.
    const perCar = drawsFor(10) / 10;
    expect(drawsFor(26)).toBe(perCar * 26);
    expect(drawsFor(30)).toBe(perCar * 30);
  });

  it("gives every car the same qualifying score whoever else entered", () => {
    // The append-independence guarantee, now that a late entry can push someone
    // out of the race entirely: it must not change what they did on Saturday.
    const field = oversubscribedField(30);
    const scoreOf = (size: number, driverId: string): number | undefined =>
      simulateRace(field.slice(0, size), createRng(9)).entries.find((e) => e.driverId === driverId)
        ?.qualifyingScore;
    for (const driverId of ["driver-0", "driver-14", "driver-25"]) {
      expect(scoreOf(30, driverId)).toBeCloseTo(scoreOf(26, driverId) ?? Number.NaN, 10);
    }
  });
});

describe("the model interface", () => {
  it("exposes the v1 model behind RaceModel", () => {
    expect(scoreAndSortRaceModel.name).toBe("score-and-sort-v1");
    const viaInterface = scoreAndSortRaceModel.simulate(spreadField(), createRng(11));
    const viaFunction = simulateRace(spreadField(), createRng(11));
    expect(viaInterface).toEqual(viaFunction);
  });

  it("accepts overridden constants", () => {
    const field = spreadField();
    const quiet: RaceConstants = { ...RACE_CONSTANTS, racingNoise: 0, qualifyingNoise: 0 };
    const result = simulateRace(field, createRng(12), quiet);
    const classified = result.entries
      .filter((e) => e.started && !e.retired)
      .sort((a, b) => (a.finishPosition ?? 0) - (b.finishPosition ?? 0));
    // With no noise the fastest surviving car must lead.
    const best = [...classified].sort((a, b) => (b.raceScore ?? 0) - (a.raceScore ?? 0))[0];
    expect(classified[0]?.driverId).toBe(best?.driverId);
  });
});
