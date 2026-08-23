import { describe, expect, it } from "vitest";
import type { CarSpec, EngineSpec } from "../model/ratings.js";
import { RACE_CONSTANTS, type RaceConstants } from "./constants.js";
import { powertrain } from "./powertrain.js";

const CAR: CarSpec = { racing: 80, qualifying: 60, consistency: 70, reliability: 40 };
const ENGINE: EngineSpec = { racing: 30, qualifying: 90, reliability: 90 };

/** Constants with the blend moved, so the weights are read rather than assumed. */
function weighted(chassis: number, engine: number): RaceConstants {
  return { ...RACE_CONSTANTS, weightChassis: chassis, weightEngine: engine };
}

describe("powertrain", () => {
  it("returns the car untouched when there is no engine", () => {
    expect(powertrain(CAR)).toEqual(CAR);
  });

  it("blends racing, qualifying and reliability by the constants", () => {
    const { weightChassis: chassis, weightEngine: engine } = RACE_CONSTANTS;
    const blended = powertrain(CAR, ENGINE);

    expect(blended.racing).toBeCloseTo(chassis * CAR.racing + engine * ENGINE.racing, 10);
    expect(blended.qualifying).toBeCloseTo(
      chassis * CAR.qualifying + engine * ENGINE.qualifying,
      10,
    );
    expect(blended.reliability).toBeCloseTo(
      chassis * CAR.reliability + engine * ENGINE.reliability,
      10,
    );
  });

  it("leaves consistency to the chassis, whatever the engine", () => {
    const strong = powertrain(CAR, { racing: 100, qualifying: 100, reliability: 100 });
    const weak = powertrain(CAR, { racing: 1, qualifying: 1, reliability: 1 });

    expect(strong.consistency).toBe(CAR.consistency);
    expect(weak.consistency).toBe(CAR.consistency);
  });

  it("is the chassis at zero engine weight and the engine at full", () => {
    expect(powertrain(CAR, ENGINE, weighted(1, 0))).toEqual(CAR);

    const allEngine = powertrain(CAR, ENGINE, weighted(0, 1));
    expect(allEngine.racing).toBe(ENGINE.racing);
    expect(allEngine.qualifying).toBe(ENGINE.qualifying);
    expect(allEngine.reliability).toBe(ENGINE.reliability);
  });

  it("keeps a blend of two in-range ratings in range", () => {
    for (const car of [0, 1, 50, 99, 100]) {
      for (const unit of [0, 1, 50, 99, 100]) {
        const blended = powertrain(
          { racing: car, qualifying: car, consistency: car, reliability: car },
          { racing: unit, qualifying: unit, reliability: unit },
        );
        expect(blended.racing).toBeGreaterThanOrEqual(Math.min(car, unit));
        expect(blended.racing).toBeLessThanOrEqual(Math.max(car, unit));
      }
    }
  });

  it("moves the result toward the engine, in proportion to its weight", () => {
    const slowEngine: EngineSpec = { racing: 0, qualifying: 0, reliability: 0 };
    const light = powertrain(CAR, slowEngine, weighted(0.9, 0.1));
    const heavy = powertrain(CAR, slowEngine, weighted(0.6, 0.4));

    expect(light.racing).toBeLessThan(CAR.racing);
    expect(heavy.racing).toBeLessThan(light.racing);
  });
});
