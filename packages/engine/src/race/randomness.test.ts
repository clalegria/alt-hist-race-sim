import { describe, expect, it } from "vitest";
import { createRng } from "../rng/index.js";
import { RACE_CONSTANTS } from "./constants.js";
import {
  DEFAULT_RANDOMNESS_LEVEL,
  parseRandomnessLevel,
  RANDOMNESS_LEVELS,
  type RandomnessLevel,
  randomnessNoiseScale,
  randomnessTeamFormBoost,
  withRandomness,
} from "./randomness.js";
import { simulateRace } from "./simulateRace.js";
import type { RaceEntrant } from "./types.js";

/**
 * A quick car and a clearly slower one, ten rating points apart.
 *
 * A gap that size is what makes the measurement below sensitive: two cars a
 * hair apart are near a coin flip at *every* level, so the rates would sit
 * within a percentage point of each other and of 50%, and an ordering read off
 * them would be noise. Ten points is a gap the tamest setting almost never
 * overturns and the wildest turns over often, so the levels separate.
 */
function closeField(): RaceEntrant[] {
  return [
    ["driver-a", 85],
    ["driver-b", 75],
  ].map(([id, ability]) => ({
    driverId: id as string,
    teamId: `team-${id as string}`,
    driver: {
      racing: ability as number,
      qualifying: ability as number,
      consistency: 100,
      adaptability: 50,
      // Nothing retires: the upsets counted below have to come from pace scatter
      // rather than from the leader's engine letting go.
      composure: 100,
    },
    chassis: {
      racing: ability as number,
      qualifying: ability as number,
      consistency: 100,
      reliability: 100,
    },
  }));
}

/** How often the slower of the two wins, over a fixed run of races. */
function upsetRate(level: RandomnessLevel, races = 3000): number {
  const rng = createRng(20250827);
  const constants = withRandomness(level, {
    ...RACE_CONSTANTS,
    mechanicalDnfAtFullReliability: 0,
    driverErrorDnfAtFullComposure: 0,
  });
  const field = closeField();
  let upsets = 0;
  for (let i = 0; i < races; i += 1) {
    if (simulateRace(field, rng, constants).winnerDriverId === "driver-b") {
      upsets += 1;
    }
  }
  return upsets / races;
}

describe("randomness levels", () => {
  it("leaves the calibrated constants untouched at the default level", () => {
    // Identity, not equality: the measured season must be the season the model
    // runs when nobody has moved the slider, with no arithmetic in between.
    expect(withRandomness(DEFAULT_RANDOMNESS_LEVEL)).toBe(RACE_CONSTANTS);
    expect(randomnessNoiseScale(DEFAULT_RANDOMNESS_LEVEL)).toBe(1);
  });

  it("scales both sigmas by the same factor, and the team weight on top", () => {
    // Three numbers move and nothing else does. Everything a rating *means* —
    // the pace weights, the powertrain blend, home advantage, the consistency
    // penalty, reliability — has to survive the slider untouched.
    for (const level of RANDOMNESS_LEVELS) {
      const scaled = withRandomness(level);
      const scale = randomnessNoiseScale(level);
      expect(scaled.qualifyingNoise).toBeCloseTo(RACE_CONSTANTS.qualifyingNoise * scale, 10);
      expect(scaled.racingNoise).toBeCloseTo(RACE_CONSTANTS.racingNoise * scale, 10);
      expect(scaled.teamFormBoost).toBeCloseTo(
        RACE_CONSTANTS.teamFormBoost * randomnessTeamFormBoost(level),
        10,
      );
      const neutralised = { qualifyingNoise: 0, racingNoise: 0, teamFormBoost: 0 };
      expect({ ...scaled, ...neutralised }).toEqual({ ...RACE_CONSTANTS, ...neutralised });
    }
  });

  it("boosts the team form weight only once a level has left realism behind", () => {
    // Scaling both sigmas uniformly drowns the driver signal before the car
    // signal, because the driver signal is the smaller of the two — so turning
    // the dice up used to buy mostly teammate upsets rather than the thing a
    // chaotic setting is for, which is not knowing which *car* will be quick.
    // The boost is what buys the second, and it stays out of the way below.
    for (const level of [1, 2, 3] as const) {
      expect(randomnessTeamFormBoost(level)).toBe(1);
    }
    expect(randomnessTeamFormBoost(4)).toBeGreaterThan(1);
    expect(randomnessTeamFormBoost(5)).toBeGreaterThan(randomnessTeamFormBoost(4));
  });

  it("orders the levels from tamest to wildest", () => {
    const scales = RANDOMNESS_LEVELS.map(randomnessNoiseScale);
    for (let i = 1; i < scales.length; i += 1) {
      expect(scales[i] ?? 0).toBeGreaterThan(scales[i - 1] ?? 0);
    }
  });

  it("derives a copy rather than mutating what it is handed", () => {
    const before = { ...RACE_CONSTANTS };
    withRandomness(5);
    expect({ ...RACE_CONSTANTS }).toEqual(before);
  });

  it("falls back to the default for anything that is not a level", () => {
    expect(parseRandomnessLevel(3)).toBe(3);
    expect(parseRandomnessLevel(0)).toBe(DEFAULT_RANDOMNESS_LEVEL);
    expect(parseRandomnessLevel(2.5)).toBe(DEFAULT_RANDOMNESS_LEVEL);
    expect(parseRandomnessLevel("3")).toBe(DEFAULT_RANDOMNESS_LEVEL);
    expect(parseRandomnessLevel(null)).toBe(DEFAULT_RANDOMNESS_LEVEL);
  });

  it("makes the underdog win more often the higher the level", () => {
    // The property the whole feature exists for, measured rather than asserted
    // about the constants: with two cars a point apart, a wider sigma has to
    // turn more races over. Mutation-checked — pinning every level's scale to 1
    // flattens these rates and fails the run.
    const rates = RANDOMNESS_LEVELS.map((level) => upsetRate(level));
    for (let i = 1; i < rates.length; i += 1) {
      expect(rates[i] ?? 0).toBeGreaterThan(rates[i - 1] ?? 0);
    }
    // Sanity on the ends, as orders of magnitude rather than fitted numbers:
    // the tamest setting rarely overturns a ten-point gap, the wildest often
    // does, and neither ever favours the slower car outright.
    expect(rates[0] ?? 1).toBeLessThan(0.2);
    expect(rates.at(-1) ?? 0).toBeGreaterThan(0.3);
    expect(rates.at(-1) ?? 1).toBeLessThan(0.5);
  });
});
