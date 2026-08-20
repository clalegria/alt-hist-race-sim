import { describe, expect, it } from "vitest";
import { createRng } from "../rng/index.js";
import { RACE_CONSTANTS, type RaceConstants } from "./constants.js";
import { scoreAndSortRaceModel, simulateRace } from "./simulateRace.js";
import type { RaceEntrant, RaceResult } from "./types.js";

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
      .filter((e) => !e.retired)
      .sort((a, b) => (a.finishPosition ?? 0) - (b.finishPosition ?? 0));
    // With no noise the fastest surviving car must lead.
    const best = [...classified].sort((a, b) => b.raceScore - a.raceScore)[0];
    expect(classified[0]?.driverId).toBe(best?.driverId);
  });
});
