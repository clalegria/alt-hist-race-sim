import { describe, expect, it } from "vitest";
import type { ChassisSpec, EngineSpec } from "../model/ratings.js";
import { RACE_CONSTANTS, type RaceConstants } from "./constants.js";
import { powertrain } from "./powertrain.js";

const CHASSIS: ChassisSpec = { racing: 80, qualifying: 60, consistency: 70, reliability: 40 };
const ENGINE: EngineSpec = { racing: 30, qualifying: 90, reliability: 90 };

/** Constants with the pace blend moved, so the weights are read rather than assumed. */
function pace(chassis: number, engine: number): RaceConstants {
  return {
    ...RACE_CONSTANTS,
    weightChassisPerformance: chassis,
    weightEnginePerformance: engine,
  };
}

/** The same for the reliability blend, which is a separate pair. */
function reliability(chassis: number, engine: number): RaceConstants {
  return {
    ...RACE_CONSTANTS,
    weightChassisReliability: chassis,
    weightEngineReliability: engine,
  };
}

describe("powertrain", () => {
  it("returns the chassis untouched when there is no engine", () => {
    expect(powertrain(CHASSIS)).toEqual(CHASSIS);
  });

  it("blends racing and qualifying by the performance constants", () => {
    const { weightChassisPerformance: chassis, weightEnginePerformance: engine } = RACE_CONSTANTS;
    const blended = powertrain(CHASSIS, ENGINE);

    expect(blended.racing).toBeCloseTo(chassis * CHASSIS.racing + engine * ENGINE.racing, 10);
    expect(blended.qualifying).toBeCloseTo(
      chassis * CHASSIS.qualifying + engine * ENGINE.qualifying,
      10,
    );
  });

  it("blends reliability by its own constants, not the performance ones", () => {
    const { weightChassisReliability: chassis, weightEngineReliability: engine } = RACE_CONSTANTS;
    const blended = powertrain(CHASSIS, ENGINE);

    expect(blended.reliability).toBeCloseTo(
      chassis * CHASSIS.reliability + engine * ENGINE.reliability,
      10,
    );
  });

  it("moves reliability without moving pace, and the other way round", () => {
    const base = powertrain(CHASSIS, ENGINE);
    const engineHeavyReliability = powertrain(CHASSIS, ENGINE, reliability(0.1, 0.9));
    const engineHeavyPace = powertrain(CHASSIS, ENGINE, pace(0.1, 0.9));

    // The reliability pair is the only thing that touched reliability.
    expect(engineHeavyReliability.reliability).not.toBeCloseTo(base.reliability, 6);
    expect(engineHeavyReliability.racing).toBeCloseTo(base.racing, 10);
    expect(engineHeavyReliability.qualifying).toBeCloseTo(base.qualifying, 10);

    // And the performance pair is the only thing that touched pace.
    expect(engineHeavyPace.racing).not.toBeCloseTo(base.racing, 6);
    expect(engineHeavyPace.reliability).toBeCloseTo(base.reliability, 10);
  });

  it("leaves consistency to the chassis, whatever the engine", () => {
    const strong = powertrain(CHASSIS, { racing: 100, qualifying: 100, reliability: 100 });
    const weak = powertrain(CHASSIS, { racing: 1, qualifying: 1, reliability: 1 });

    expect(strong.consistency).toBe(CHASSIS.consistency);
    expect(weak.consistency).toBe(CHASSIS.consistency);
  });

  it("is the chassis at zero engine weight and the engine at full", () => {
    const allChassis = powertrain(CHASSIS, ENGINE, {
      ...pace(1, 0),
      weightChassisReliability: 1,
      weightEngineReliability: 0,
    });
    expect(allChassis).toEqual(CHASSIS);

    const allEngine = powertrain(CHASSIS, ENGINE, {
      ...pace(0, 1),
      weightChassisReliability: 0,
      weightEngineReliability: 1,
    });
    expect(allEngine.racing).toBe(ENGINE.racing);
    expect(allEngine.qualifying).toBe(ENGINE.qualifying);
    expect(allEngine.reliability).toBe(ENGINE.reliability);
  });

  it("keeps a blend of two in-range ratings in range", () => {
    for (const chassis of [0, 1, 50, 99, 100]) {
      for (const unit of [0, 1, 50, 99, 100]) {
        const blended = powertrain(
          { racing: chassis, qualifying: chassis, consistency: chassis, reliability: chassis },
          { racing: unit, qualifying: unit, reliability: unit },
        );
        for (const value of [blended.racing, blended.qualifying, blended.reliability]) {
          expect(value).toBeGreaterThanOrEqual(Math.min(chassis, unit));
          expect(value).toBeLessThanOrEqual(Math.max(chassis, unit));
        }
      }
    }
  });

  it("moves the result toward the engine, in proportion to its weight", () => {
    const slowEngine: EngineSpec = { racing: 0, qualifying: 0, reliability: 0 };
    const light = powertrain(CHASSIS, slowEngine, pace(0.9, 0.1));
    const heavy = powertrain(CHASSIS, slowEngine, pace(0.6, 0.4));

    expect(light.racing).toBeLessThan(CHASSIS.racing);
    expect(heavy.racing).toBeLessThan(light.racing);
  });

  it("gives the engine more of reliability than of pace, at the shipped weights", () => {
    // The point of splitting the pair: a swap to a much worse engine should cost
    // proportionally more reliability than it costs pace.
    const dud: EngineSpec = { racing: 0, qualifying: 0, reliability: 0 };
    const blended = powertrain(CHASSIS, dud);

    const paceLost = 1 - blended.racing / CHASSIS.racing;
    const reliabilityLost = 1 - blended.reliability / CHASSIS.reliability;
    expect(reliabilityLost).toBeGreaterThan(paceLost);
  });
});
