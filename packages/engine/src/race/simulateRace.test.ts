import { describe, expect, it } from "vitest";
import type { EngineSpec } from "../model/ratings.js";
import { createRng } from "../rng/index.js";
import type { Rng } from "../rng/types.js";
import { RACE_CONSTANTS, type RaceConstants } from "./constants.js";
import { withRandomness } from "./randomness.js";
import { scoreAndSortRaceModel, simulateRace } from "./simulateRace.js";
import type { RaceEntrant, RaceEntryResult, RaceResult } from "./types.js";

/**
 * Pearson correlation of two equal-length samples. Used to assert what the
 * noise split ties together — a car's two sessions, and a garage's two cars.
 */
function correlate(xs: readonly number[], ys: readonly number[]): number {
  const mean = (vs: readonly number[]): number => vs.reduce((a, b) => a + b, 0) / vs.length;
  const mx = mean(xs);
  const my = mean(ys);
  let cov = 0;
  let vx = 0;
  let vy = 0;
  for (let i = 0; i < xs.length; i += 1) {
    const dx = (xs[i] ?? 0) - mx;
    const dy = (ys[i] ?? 0) - my;
    cov += dx * dy;
    vx += dx * dx;
    vy += dy * dy;
  }
  return cov / Math.sqrt(vx * vy);
}

/**
 * An `Rng` that counts how many values it has been asked for. Both `next` and
 * `gaussian` are counted, so the total is every draw a race consumes.
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
      wetWeather: ability,
    },
    chassis: {
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

/**
 * Cars differing only in where their *engine* was built, so the supplier's
 * share can be read off on its own. Nobody's driver or team is Italian, which
 * is what makes any gain at Monza the engine's and nothing else's.
 */
function suppliedField(): RaceEntrant[] {
  const supplied = (id: string, engineCountry?: string): RaceEntrant => ({
    ...entrant(id, `team-${id}`, 70, 70),
    driverCountry: "BR",
    teamCountry: "GB",
    ...(engineCountry === undefined ? {} : { engineCountry }),
  });
  return [supplied("driver-a", "IT"), supplied("driver-b", "GB"), supplied("driver-c")];
}

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

  it("switches off entirely when the constants are zero", () => {
    const off: RaceConstants = {
      ...NO_NOISE,
      homeAdvantageDriver: 0,
      homeAdvantageTeam: 0,
      homeAdvantageEngine: 0,
    };
    expect(simulateRace(suppliedField(), createRng(1), off, italy)).toEqual(
      simulateRace(suppliedField(), createRng(1), off),
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

  it("pays the engine's share to a car built where the round is held", () => {
    const home = simulateRace(suppliedField(), createRng(1), NO_NOISE, italy);
    const neutral = simulateRace(suppliedField(), createRng(1), NO_NOISE);
    const gained = (driverId: string): number =>
      entryOf(home, driverId).qualifyingScore - entryOf(neutral, driverId).qualifyingScore;

    expect(gained("driver-a")).toBeCloseTo(NO_NOISE.homeAdvantageEngine, 10);
    // A British engine and no engine at all are both visitors at Monza.
    expect(gained("driver-b")).toBeCloseTo(0, 10);
    expect(gained("driver-c")).toBeCloseTo(0, 10);
  });

  it("stacks all three allegiances, and the engine's is the smallest", () => {
    const everything: RaceEntrant[] = [
      {
        ...entrant("native", "team-native", 70, 70),
        driverCountry: "IT",
        teamCountry: "IT",
        engineCountry: "IT",
      },
      { ...entrant("visitor", "team-visitor", 70, 70) },
    ];
    const home = simulateRace(everything, createRng(1), NO_NOISE, italy);
    const neutral = simulateRace(everything, createRng(1), NO_NOISE);
    const gained =
      entryOf(home, "native").qualifyingScore - entryOf(neutral, "native").qualifyingScore;

    expect(gained).toBeCloseTo(
      NO_NOISE.homeAdvantageDriver + NO_NOISE.homeAdvantageTeam + NO_NOISE.homeAdvantageEngine,
      10,
    );
    // The ordering is the claim: a crowd shouts for the driver, then the team.
    expect(NO_NOISE.homeAdvantageEngine).toBeLessThan(NO_NOISE.homeAdvantageTeam);
    expect(NO_NOISE.homeAdvantageTeam).toBeLessThan(NO_NOISE.homeAdvantageDriver);
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
    //
    // 30 points of car against 20 of driver: at the current weights that is an
    // 11-point score gap, where it was 15 when the driver took 0.30 rather than
    // 0.38. The claim is the ordering and that it is lopsided, not the margin —
    // raising the driver's share is *meant* to narrow this, and the bound has
    // to leave room for that without letting the ordering itself invert.
    const field = [entrant("ace-bad-car", "back", 95, 62), entrant("journeyman", "top", 75, 92)];
    expect(winRate(field, "journeyman", 1000, NO_DNFS)).toBeGreaterThan(0.9);
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

  it("prices the erratic car's upper tail without letting it run away", () => {
    // The cost the spread lever was pinned flat to avoid, now accepted and
    // bounded instead. Winning from behind is an upper-tail event, so a car
    // with a wider spread wins *more* the more erratic it is — here the subject
    // is the slowest of five and does exactly that. What has to stay true is
    // that the pace penalty still dominates where a season is actually decided:
    // on where the car finishes week in and week out.
    const fieldWith = (consistency: number): RaceEntrant[] => {
      const subject = entrant("subject", "t5", 76, 78);
      return [
        entrant("ace1", "t1", 84, 86),
        entrant("ace2", "t2", 82, 85),
        entrant("ace3", "t3", 81, 84),
        entrant("ace4", "t4", 80, 83),
        { ...subject, driver: { ...subject.driver, consistency } },
      ];
    };
    const races = 12000;
    const measure = (consistency: number): { winRate: number; meanFinish: number } => {
      const field = fieldWith(consistency);
      let wins = 0;
      let places = 0;
      for (let seed = 1; seed <= races; seed += 1) {
        const result = simulateRace(field, createRng(seed), NO_DNFS);
        if (result.winnerDriverId === "subject") {
          wins += 1;
        }
        places +=
          result.entries.find((e) => e.driverId === "subject")?.finishPosition ?? field.length;
      }
      return { winRate: wins / races, meanFinish: places / races };
    };
    const erratic = measure(20);
    const steady = measure(90);
    // A higher number is a worse average finish.
    expect(erratic.meanFinish).toBeGreaterThan(steady.meanFinish);
    // The extra wins are real, and have to stay a rounding error rather than a
    // strategy. Comfortably inside this bound today; the bound is what would
    // catch a future widening of the multipliers turning erratic into a cheat
    // code, which is the pathology the flat setting existed to prevent.
    expect(erratic.winRate).toBeLessThan(steady.winRate * 2);
  });

  it("widens the erratic driver's spread", () => {
    // Consistency is a variance stat as well as a pace one. Without this a
    // steady driver and a wild one in the same car have identically shaped
    // weekends, and the rating means nothing but lost pace.
    //
    // The effect is deliberately modest, and the reason is `teamFormShare`: a
    // driver's consistency scales only his entry's own scatter, which is
    // `1 - teamFormShare` of the variance. The rest belongs to the team and is
    // scaled by the *car's* consistency, which these two share. So this asserts
    // a real but small widening — pushing the multipliers far enough apart to
    // make it large again is the wildcards-versus-dominance trade, not a bug.
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
    expect(spread("erratic")).toBeGreaterThan(spread("steady") * 1.04);
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
    return correlate(qs, rs);
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

  it("is unaffected by how the same noise splits between team and car", () => {
    // The two axes are independent by construction. Moving variance into the
    // team must not change how much of a car's Saturday carries into Sunday,
    // or the team split would be silently re-tuning weekend form as well.
    const allTeam = noiseCorrelation({ ...RACE_CONSTANTS, teamFormShare: 1 });
    const allCar = noiseCorrelation({ ...RACE_CONSTANTS, teamFormShare: 0 });
    expect(allTeam).toBeCloseTo(allCar, 1);
    expect(allTeam).toBeCloseTo(RACE_CONSTANTS.weekendFormShare, 1);
  });

  it("keeps each session's total spread unchanged as the shares move", () => {
    // The sqrt weighting exists so that correlating the sessions — or moving
    // variance between the team and the car — does not quietly make either
    // session noisier.
    const spreadOf = (weekendFormShare: number, teamFormShare: number): number => {
      const field = spreadField();
      const scores: number[] = [];
      for (let seed = 1; seed <= 4000; seed += 1) {
        const entry = simulateRace(field, createRng(seed), {
          ...RACE_CONSTANTS,
          weekendFormShare,
          teamFormShare,
        }).entries[5];
        scores.push(entry?.qualifyingScore ?? 0);
      }
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      return Math.sqrt(scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length);
    };
    const reference = spreadOf(0, 0);
    expect(spreadOf(0.9, 0.75)).toBeCloseTo(reference, 0);
    expect(spreadOf(0.5, 1)).toBeCloseTo(reference, 0);
    expect(spreadOf(0.5, 0)).toBeCloseTo(reference, 0);
  });
});

describe("team form", () => {
  /**
   * Two teams of two, each pairing a clearly stronger driver with a clearly
   * weaker one in an identical car. Synthetic ratings throughout: what is being
   * asserted is the rule, never what an authored driver is worth.
   */
  function garageField(): RaceEntrant[] {
    return [80, 64].flatMap((car, t) => [
      entrant(`lead-${t}`, `team-${t}`, 85, car),
      entrant(`number-two-${t}`, `team-${t}`, 65, car),
    ]);
  }

  /** How often the weaker driver of the top team finishes ahead of the stronger. */
  function teammateUpsetRate(
    constants: RaceConstants,
    races = 4000,
    field: readonly RaceEntrant[] = garageField(),
  ): number {
    let upsets = 0;
    let counted = 0;
    for (let seed = 1; seed <= races; seed += 1) {
      const result = simulateRace(field, createRng(seed), constants);
      const lead = result.entries.find((e) => e.driverId === "lead-0");
      const two = result.entries.find((e) => e.driverId === "number-two-0");
      if (lead?.finishPosition == null || two?.finishPosition == null) {
        continue;
      }
      counted += 1;
      if (two.finishPosition < lead.finishPosition) {
        upsets += 1;
      }
    }
    return upsets / counted;
  }

  it("correlates the race scores of two cars in the same garage", () => {
    // The whole point of the share: a team that has brought a working car has
    // brought two of them.
    const scoresFor = (teamFormShare: number): [number[], number[]] => {
      const a: number[] = [];
      const b: number[] = [];
      for (let seed = 1; seed <= 3000; seed += 1) {
        const result = simulateRace(garageField(), createRng(seed), {
          ...RACE_CONSTANTS,
          teamFormShare,
        });
        const lead = result.entries.find((e) => e.driverId === "lead-0");
        const two = result.entries.find((e) => e.driverId === "number-two-0");
        if (lead?.raceScore == null || two?.raceScore == null) {
          continue;
        }
        a.push(lead.raceScore);
        b.push(two.raceScore);
      }
      return [a, b];
    };
    const [lowA, lowB] = scoresFor(0);
    const [highA, highB] = scoresFor(0.8);
    expect(Math.abs(correlate(lowA, lowB))).toBeLessThan(0.15);
    expect(correlate(highA, highB)).toBeGreaterThan(0.5);
  });

  it("leaves the order within a garage to the drivers as the share rises", () => {
    // The behaviour the share exists for. Noise a team shares cannot separate
    // its two cars, so moving variance into it hands the teammate battle back
    // to the ratings — while the field-wide spread is left exactly alone.
    const flat = teammateUpsetRate({ ...RACE_CONSTANTS, teamFormShare: 0 });
    const shared = teammateUpsetRate({ ...RACE_CONSTANTS, teamFormShare: 0.8 });
    expect(flat).toBeGreaterThan(shared + 0.05);
  });

  it("does not make the stronger teammate certain of it", () => {
    // Upsets must stay possible — a second driver beating a first is a real
    // thing that happens, and a share of 1 would abolish it rather than price
    // it. Bounded on both sides so neither extreme passes.
    //
    // Measured on a ten-point pairing rather than `garageField`'s twenty. A gap
    // that wide is now genuinely near-decisive on pace, so asserting upsets at
    // the far end of the grid would be asserting the opposite of what the model
    // claims; ten points is a real first-versus-second driver and is where
    // "possible" is the interesting property.
    const closer = [80, 64].flatMap((car, t) => [
      entrant(`lead-${t}`, `team-${t}`, 85, car),
      entrant(`number-two-${t}`, `team-${t}`, 75, car),
    ]);
    const rate = teammateUpsetRate(RACE_CONSTANTS, 4000, closer);
    expect(rate).toBeGreaterThan(0.02);
    expect(rate).toBeLessThan(0.3);
  });

  it("draws its form once per team rather than once per car", () => {
    // Three cars in one garage must cost two teams' worth of draws fewer than
    // three cars in three, or the team draws are per-car draws wearing a
    // different name.
    const drawsFor = (field: readonly RaceEntrant[]): number => {
      const { rng, draws } = countingRng(1);
      simulateRace(field, rng);
      return draws();
    };
    const oneTeam = drawsFor([
      entrant("a", "shared", 80, 80),
      entrant("b", "shared", 70, 70),
      entrant("c", "shared", 60, 60),
    ]);
    const threeTeams = drawsFor([
      entrant("a", "team-a", 80, 80),
      entrant("b", "team-b", 70, 70),
      entrant("c", "team-c", 60, 60),
    ]);
    expect(threeTeams - oneTeam).toBe(8);
  });

  it("boosts the team share at the chaotic levels only", () => {
    for (const level of [1, 2, 3] as const) {
      expect(withRandomness(level).teamFormBoost).toBe(RACE_CONSTANTS.teamFormBoost);
    }
    for (const level of [4, 5] as const) {
      expect(withRandomness(level).teamFormBoost).toBeGreaterThan(RACE_CONSTANTS.teamFormBoost);
    }
  });
});

describe("teammate reliability", () => {
  /** Two identical cars in one garage, incapable of driver error. */
  function twoCarTeam(reliability: number): RaceEntrant[] {
    const make = (id: string): RaceEntrant => {
      const base = entrant(id, "shared", 70, 70);
      return {
        ...base,
        driver: { ...base.driver, composure: 100 },
        chassis: { ...base.chassis, reliability },
      };
    };
    return [make("car-a"), make("car-b")];
  }

  /** One car's own failure rate, and how often both cars fail together. */
  function failures(correlation: number, races = 20000): { marginal: number; joint: number } {
    const constants: RaceConstants = {
      ...RACE_CONSTANTS,
      mechanicalDnfTeamCorrelation: correlation,
      driverErrorDnfAtZeroComposure: 0,
      driverErrorDnfAtFullComposure: 0,
    };
    const field = twoCarTeam(60);
    let first = 0;
    let both = 0;
    for (let seed = 1; seed <= races; seed += 1) {
      const result = simulateRace(field, createRng(seed), constants);
      const a = result.entries.find((e) => e.driverId === "car-a")?.mechanicalFailure ?? false;
      const b = result.entries.find((e) => e.driverId === "car-b")?.mechanicalFailure ?? false;
      if (a) {
        first += 1;
      }
      if (a && b) {
        both += 1;
      }
    }
    return { marginal: first / races, joint: both / races };
  }

  it("leaves each car's own failure rate untouched by the correlation", () => {
    // This is what lets the per-season retirement factors stand: the
    // correlation changes which failures land together, not how many there are.
    const independent = failures(0);
    const correlated = failures(0.6);
    // Both land near 0.37 over 20,000 races, so the standard error on each is
    // about 0.0034 — and the correlated estimate is the noisier of the two,
    // since a shared fragility draw makes its races less independent of one
    // another. The bounds are a few standard errors, not decimal-place claims.
    expect(Math.abs(correlated.marginal - independent.marginal)).toBeLessThan(0.02);

    // And both must equal what the car's reliability alone says, rather than
    // merely equalling each other — an equal bias in the pair would satisfy the
    // comparison above while quietly moving every season's retirement count.
    // Derived from the constants, never hard-coded: reliability 60 of 100.
    const expected =
      RACE_CONSTANTS.mechanicalDnfAtZeroReliability +
      (RACE_CONSTANTS.mechanicalDnfAtFullReliability -
        RACE_CONSTANTS.mechanicalDnfAtZeroReliability) *
        0.6;
    expect(Math.abs(independent.marginal - expected)).toBeLessThan(0.02);
    expect(Math.abs(correlated.marginal - expected)).toBeLessThan(0.02);
  });

  it("makes a teammate's failure likelier once one car has broken", () => {
    // A real mechanical failure is often a design or a batch rather than one
    // unlucky car, so the two sides of a garage should not be independent.
    const conditional = (f: { marginal: number; joint: number }): number => f.joint / f.marginal;
    const independent = failures(0);
    const correlated = failures(0.6);
    // Independence means the conditional rate is just the marginal one again.
    expect(conditional(independent)).toBeCloseTo(independent.marginal, 1);
    expect(conditional(correlated)).toBeGreaterThan(conditional(independent) + 0.1);
  });

  it("leaves driver error independent between teammates", () => {
    // Composure belongs to the driver. Two drivers do not spin in sympathy,
    // however correlated their car's failures are.
    const constants: RaceConstants = {
      ...RACE_CONSTANTS,
      mechanicalDnfTeamCorrelation: 0.9,
      mechanicalDnfAtZeroReliability: 0,
      mechanicalDnfAtFullReliability: 0,
      driverErrorDnfAtZeroComposure: 0.4,
      driverErrorDnfAtFullComposure: 0.4,
    };
    const field = twoCarTeam(60);
    const races = 20000;
    let first = 0;
    let both = 0;
    for (let seed = 1; seed <= races; seed += 1) {
      const result = simulateRace(field, createRng(seed), constants);
      const a = result.entries.find((e) => e.driverId === "car-a")?.driverError ?? false;
      const b = result.entries.find((e) => e.driverId === "car-b")?.driverError ?? false;
      if (a) {
        first += 1;
      }
      if (a && b) {
        both += 1;
      }
    }
    expect(both / first).toBeCloseTo(first / races, 1);
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
    // Measure the per-car cost on fields that fit inside the limit, where every
    // car indisputably runs, then hold the over-subscribed fields to it.
    // Comparing two over-subscribed fields to each other would not do: skipped
    // draws would cancel out of the difference and the test would pass anyway.
    //
    // Differenced rather than divided, because a round costs a fixed number of
    // draws before any car does — the weather is rolled once, whoever entered —
    // and dividing would smear that across the field.
    const perCar = (drawsFor(20) - drawsFor(10)) / 10;
    const perRound = drawsFor(10) - perCar * 10;
    expect(drawsFor(26)).toBe(perRound + perCar * 26);
    expect(drawsFor(30)).toBe(perRound + perCar * 30);
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

/**
 * Four identical cars, differing only in the engine bolted into them.
 *
 * `driver-a` sorts first on the id tie-break, so with the noise off the running
 * order is decided purely by the engines — which is the point.
 */
function enginedField(): RaceEntrant[] {
  const withEngine = (id: string, engine?: EngineSpec): RaceEntrant => ({
    ...entrant(id, `team-${id}`, 70, 70),
    ...(engine === undefined ? {} : { engine }),
  });
  return [
    withEngine("driver-a"),
    withEngine("driver-b", { racing: 70, qualifying: 70, reliability: 70 }),
    withEngine("driver-c", { racing: 100, qualifying: 100, reliability: 100 }),
    withEngine("driver-d", { racing: 0, qualifying: 0, reliability: 0 }),
  ];
}

describe("engines", () => {
  it("scores a car with no engine on its chassis alone", () => {
    // An engine matching the chassis exactly is the same car by construction,
    // which is what makes "no engine" a neutral state rather than a penalty.
    // Grid bonus off as well: a and b tie on pace, so track position would be
    // the only thing between them and would hide the equality being asserted.
    const flat: RaceConstants = { ...NO_NOISE, gridAdvantagePole: 0 };
    const result = simulateRace(enginedField(), createRng(1), flat);
    expect(entryOf(result, "driver-a").qualifyingScore).toBeCloseTo(
      entryOf(result, "driver-b").qualifyingScore,
      10,
    );
    expect(entryOf(result, "driver-a").raceScore ?? 0).toBeCloseTo(
      entryOf(result, "driver-b").raceScore ?? 0,
      10,
    );
  });

  it("puts a better engine ahead of an identical car with a worse one", () => {
    const result = simulateRace(enginedField(), createRng(1), NO_NOISE);
    expect(entryOf(result, "driver-c").gridPosition).toBeLessThan(
      entryOf(result, "driver-a").gridPosition,
    );
    expect(entryOf(result, "driver-a").gridPosition).toBeLessThan(
      entryOf(result, "driver-d").gridPosition,
    );
    expect(result.poleDriverId).toBe("driver-c");
  });

  it("moves the score by the engine's share of the deficit, and no more", () => {
    const result = simulateRace(enginedField(), createRng(1), NO_NOISE);
    const gained =
      entryOf(result, "driver-c").qualifyingScore - entryOf(result, "driver-a").qualifyingScore;
    // 30 rating points of engine advantage over the chassis it replaces, taken
    // at the engine's share of the car's pace, then at the car's share of
    // qualifying.
    expect(gained).toBeCloseTo(
      30 * NO_NOISE.weightEnginePerformance * NO_NOISE.weightCarQualifying,
      10,
    );
  });

  it("leaves consistency alone, so the pace penalty does not move", () => {
    // Identical chassis consistency across the field: if the engine leaked into
    // it, the penalties would differ and the score gaps above would not be a
    // clean function of the engine ratings.
    const noPace: RaceConstants = {
      ...NO_NOISE,
      weightCarQualifying: 0,
      weightDriverQualifying: 0,
    };
    const result = simulateRace(enginedField(), createRng(1), noPace);
    const scores = result.entries.map((entry) => entry.qualifyingScore);
    for (const score of scores) {
      expect(score).toBeCloseTo(scores[0] ?? 0, 10);
    }
  });

  it("draws no randomness, so engines cannot shift the stream", () => {
    const engined = createRng(1);
    simulateRace(enginedField(), engined, NO_NOISE);
    const bare = createRng(1);
    simulateRace(
      enginedField().map(({ engine: _engine, ...rest }) => rest),
      bare,
      NO_NOISE,
    );
    expect(engined.getState()).toEqual(bare.getState());
  });

  it("makes a fragile engine retire more often than a strong one", () => {
    // Everything else equal, so any difference is the engine's reliability
    // reaching the mechanical roll through the blend.
    const field: RaceEntrant[] = [
      {
        ...entrant("strong", "t1", 70, 70),
        engine: { racing: 70, qualifying: 70, reliability: 100 },
      },
      {
        ...entrant("fragile", "t2", 70, 70),
        engine: { racing: 70, qualifying: 70, reliability: 0 },
      },
    ];
    const failures = { strong: 0, fragile: 0 };
    for (let seed = 1; seed <= 2000; seed += 1) {
      const result = simulateRace(field, createRng(seed));
      if (entryOf(result, "strong").mechanicalFailure) {
        failures.strong += 1;
      }
      if (entryOf(result, "fragile").mechanicalFailure) {
        failures.fragile += 1;
      }
    }
    expect(failures.fragile).toBeGreaterThan(failures.strong);
  });
});
