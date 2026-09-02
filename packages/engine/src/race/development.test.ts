import { describe, expect, it } from "vitest";
import type { CarSpec } from "../model/ratings.js";
import { createRng } from "../rng/index.js";
import { RACE_CONSTANTS, type RaceConstants } from "./constants.js";
import {
  DEVELOPMENT_TREND_LIMIT,
  developedCar,
  developmentSwing,
  MID_SEASON_PROGRESS,
  seasonProgress,
} from "./development.js";
import { simulateRace } from "./simulateRace.js";
import type { RaceEntrant } from "./types.js";

const CAR: CarSpec = { racing: 70, qualifying: 70, consistency: 70, reliability: 70 };

describe("seasonProgress", () => {
  it("runs 0 at the opener to 1 at the finale", () => {
    expect(seasonProgress(0, 14)).toBe(0);
    expect(seasonProgress(13, 14)).toBe(1);
  });

  it("is linear in between", () => {
    expect(seasonProgress(1, 5)).toBeCloseTo(0.25, 10);
    expect(seasonProgress(2, 5)).toBeCloseTo(0.5, 10);
    expect(seasonProgress(3, 5)).toBeCloseTo(0.75, 10);
  });

  it("calls a one-round season mid-season, since it has no arc to be at one end of", () => {
    expect(seasonProgress(0, 1)).toBe(MID_SEASON_PROGRESS);
    expect(seasonProgress(0, 0)).toBe(MID_SEASON_PROGRESS);
  });

  it("clamps a round outside the calendar rather than extrapolating past the finale", () => {
    expect(seasonProgress(-4, 10)).toBe(0);
    expect(seasonProgress(40, 10)).toBe(1);
  });
});

describe("developmentSwing", () => {
  it("is worth the whole trend at each end, and nothing in the middle", () => {
    expect(developmentSwing(6, 0)).toBeCloseTo(-6, 10);
    expect(developmentSwing(6, MID_SEASON_PROGRESS)).toBeCloseTo(0, 10);
    expect(developmentSwing(6, 1)).toBeCloseTo(6, 10);
  });

  it("mirrors exactly for the opposite trend", () => {
    for (const progress of [0, 0.2, 0.5, 0.8, 1]) {
      expect(developmentSwing(-7, progress)).toBeCloseTo(-developmentSwing(7, progress), 10);
    }
  });

  it("averages to nothing across an evenly spaced calendar — it is a rotation, not a bonus", () => {
    const rounds = 15;
    let total = 0;
    for (let round = 0; round < rounds; round += 1) {
      total += developmentSwing(DEVELOPMENT_TREND_LIMIT, seasonProgress(round, rounds));
    }
    expect(total).toBeCloseTo(0, 8);
  });

  it("is nothing without a trend, and nothing without a progress", () => {
    expect(developmentSwing(undefined, 0)).toBe(0);
    expect(developmentSwing(0, 0)).toBe(0);
    expect(developmentSwing(9, undefined)).toBe(0);
  });

  it("scales with the constant rather than being pinned to the tag", () => {
    const doubled: RaceConstants = { ...RACE_CONSTANTS, developmentSwingPerPoint: 2 };
    expect(developmentSwing(5, 1, doubled)).toBeCloseTo(10, 10);
  });

  it("clamps a progress outside the calendar to its ends", () => {
    expect(developmentSwing(4, -3)).toBeCloseTo(-4, 10);
    expect(developmentSwing(4, 9)).toBeCloseTo(4, 10);
  });
});

describe("developedCar", () => {
  it("moves pace only — reliability and consistency are untouched", () => {
    const late = developedCar(CAR, 8, 1);
    expect(late.racing).toBeCloseTo(78, 10);
    expect(late.qualifying).toBeCloseTo(78, 10);
    expect(late.reliability).toBe(CAR.reliability);
    expect(late.consistency).toBe(CAR.consistency);
  });

  it("hands back the same car when there is nothing to apply", () => {
    expect(developedCar(CAR, undefined, 1)).toBe(CAR);
    expect(developedCar(CAR, 0, 1)).toBe(CAR);
    expect(developedCar(CAR, 5, undefined)).toBe(CAR);
    expect(developedCar(CAR, 5, MID_SEASON_PROGRESS)).toBe(CAR);
  });

  it("does not cap a strong car's late-season gain", () => {
    // Capping at 100 would mute the gain while leaving the opener's loss at full
    // size, turning a symmetric rotation into a quiet penalty. See the module.
    const strong: CarSpec = { ...CAR, racing: 98, qualifying: 98 };
    expect(developedCar(strong, 10, 1).racing).toBeCloseTo(108, 10);
    expect(developedCar(strong, 10, 0).racing).toBeCloseTo(88, 10);
  });
});

/** Two cars, identical but for the trend on the first. */
function pair(trend: number): RaceEntrant[] {
  const car = { racing: 70, qualifying: 70, consistency: 70, reliability: 70 };
  const driver = {
    racing: 70,
    qualifying: 70,
    consistency: 70,
    adaptability: 70,
    composure: 70,
  };
  return [
    { driverId: "developing", teamId: "a", driver, chassis: car, developmentTrend: trend },
    { driverId: "flat", teamId: "b", driver, chassis: car },
  ];
}

describe("development in a race", () => {
  it("is worth nothing to a race that does not say when it is", () => {
    const withTrend = simulateRace(pair(10), createRng(4));
    const without = simulateRace(pair(0), createRng(4));
    expect(withTrend.entries).toStrictEqual(
      // Only the trend differs, and a lone race is mid-season, so the two races
      // are the same race down to the scores.
      without.entries.map((entry) => entry),
    );
  });

  it("costs a rising car pace at the opener and pays it back at the finale", () => {
    const opener = simulateRace(pair(10), createRng(4), RACE_CONSTANTS, { seasonProgress: 0 });
    const finale = simulateRace(pair(10), createRng(4), RACE_CONSTANTS, { seasonProgress: 1 });
    const scoreOf = (result: ReturnType<typeof simulateRace>, driverId: string): number =>
      result.entries.find((entry) => entry.driverId === driverId)?.qualifyingScore ?? Number.NaN;

    // The flat car is the control: it must be identical in both races, which is
    // what proves the difference below belongs to the trend and not to the dice.
    expect(scoreOf(opener, "flat")).toBeCloseTo(scoreOf(finale, "flat"), 10);
    const gain = scoreOf(finale, "developing") - scoreOf(opener, "developing");
    // 20 rating points of swing, at the car's share of a qualifying score.
    expect(gain).toBeCloseTo(20 * RACE_CONSTANTS.weightCarQualifying, 8);
  });

  it("draws no randomness: the RNG ends a race in the same place with and without a trend", () => {
    const trendedRng = createRng(11);
    simulateRace(pair(9), trendedRng, RACE_CONSTANTS, { seasonProgress: 0 });
    const flatRng = createRng(11);
    simulateRace(pair(0), flatRng, RACE_CONSTANTS, { seasonProgress: 0 });
    expect(trendedRng.getState()).toStrictEqual(flatRng.getState());
  });

  it("leaves a rival's own noise alone, whatever it does to the order", () => {
    const trended = simulateRace(pair(9), createRng(11), RACE_CONSTANTS, { seasonProgress: 0 });
    const flat = simulateRace(pair(0), createRng(11), RACE_CONSTANTS, { seasonProgress: 0 });
    const control = (result: ReturnType<typeof simulateRace>) =>
      result.entries.find((entry) => entry.driverId === "flat");
    // Qualifying, where nothing but ratings and noise is in the score. The race
    // score deliberately is *not* checked: a slower rival means a better grid
    // slot, and the grid bonus that follows is a real consequence of the trend
    // rather than a disturbed draw.
    expect(control(trended)?.qualifyingScore).toBeCloseTo(
      control(flat)?.qualifyingScore ?? Number.NaN,
      10,
    );
  });

  it("leaves retirements alone: development is pace", () => {
    const opener = simulateRace(pair(10), createRng(21), RACE_CONSTANTS, { seasonProgress: 0 });
    const finale = simulateRace(pair(10), createRng(21), RACE_CONSTANTS, { seasonProgress: 1 });
    const retiredIn = (result: ReturnType<typeof simulateRace>) =>
      result.entries.map((entry) => `${entry.driverId}:${String(entry.retired)}`);
    expect(retiredIn(opener)).toStrictEqual(retiredIn(finale));
  });
});
