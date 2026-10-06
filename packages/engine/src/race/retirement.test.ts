import { describe, expect, it } from "vitest";
import { createRng } from "../rng/index.js";
import { RACE_CONSTANTS } from "./constants.js";
import {
  DEFAULT_RETIREMENT_FACTOR,
  parseRetirementFactor,
  RETIREMENT_FACTORS,
  type RetirementFactor,
  retirementScale,
  withRetirementFactor,
} from "./retirement.js";
import { simulateRace } from "./simulateRace.js";
import type { RaceEntrant } from "./types.js";

/**
 * A field that is neither bulletproof nor hopeless, on both halves of the
 * retirement calculation.
 *
 * Mid ratings on purpose. A grid of 100-rated cars driven by 100-composure
 * drivers sits near the bottom of both interpolations, where a multiplier moves
 * a rate by a fraction of a point and the measurement below could not tell the
 * factors apart; a grid of zeros clamps at certainty and would flatten the top
 * of the scale for the opposite reason. Synthetic ratings rather than a season's
 * — no test here may read an authored number.
 */
function fragileField(size = 12): RaceEntrant[] {
  return Array.from({ length: size }, (_, index) => ({
    driverId: `driver-${index}`,
    teamId: `team-${index}`,
    driver: {
      racing: 60,
      qualifying: 60,
      consistency: 60,
      adaptability: 50,
      composure: 60,
      wetWeather: 60,
    },
    chassis: { racing: 60, qualifying: 60, consistency: 60, reliability: 60 },
  }));
}

/** The share of starters that failed to see the flag, over a fixed run. */
function retirementRate(factor: RetirementFactor, races = 400): number {
  const rng = createRng(20260828);
  const constants = withRetirementFactor(factor);
  const field = fragileField();
  let starters = 0;
  let retirements = 0;
  for (let index = 0; index < races; index += 1) {
    const result = simulateRace(field, rng, constants);
    starters += result.retirements + result.classifiedCount;
    retirements += result.retirements;
  }
  return retirements / starters;
}

describe("retirementScale", () => {
  it("leaves the constants alone at the neutral factor", () => {
    // By identity, not by value: the whole point of the neutral setting is that
    // no arithmetic happens between `constants.ts` and an untouched
    // season, so there is nothing to round or drift.
    expect(retirementScale(DEFAULT_RETIREMENT_FACTOR)).toBe(1);
    expect(withRetirementFactor(DEFAULT_RETIREMENT_FACTOR)).toBe(RACE_CONSTANTS);
  });

  it("rises monotonically across the scale", () => {
    const scales = RETIREMENT_FACTORS.map(retirementScale);
    for (const [index, scale] of scales.entries()) {
      expect(scale).toBeGreaterThan(scales[index - 1] ?? 0);
    }
  });

  it("scales both halves of the retirement calculation, and nothing else", () => {
    // Mechanical failure and driver error are separate rolls, and an era knob
    // that moved only the first could never take a field below the driver-error
    // rate its composure ratings imply.
    const harsh = withRetirementFactor(10);
    const scale = retirementScale(10);
    expect(harsh.mechanicalDnfEraScale).toBeCloseTo(RACE_CONSTANTS.mechanicalDnfEraScale * scale);
    expect(harsh.driverErrorDnfAtZeroComposure).toBeCloseTo(
      RACE_CONSTANTS.driverErrorDnfAtZeroComposure * scale,
    );
    expect(harsh.driverErrorDnfAtFullComposure).toBeCloseTo(
      RACE_CONSTANTS.driverErrorDnfAtFullComposure * scale,
    );
    // The pace half of the model is not this knob's business — a fragile era is
    // not a random one, which is what the randomness level is for.
    expect(harsh.qualifyingNoise).toBe(RACE_CONSTANTS.qualifyingNoise);
    expect(harsh.racingNoise).toBe(RACE_CONSTANTS.racingNoise);
    expect(harsh.weightCarRacing).toBe(RACE_CONSTANTS.weightCarRacing);
  });
});

describe("withRetirementFactor with a mechanical factor of its own", () => {
  it("scales the mechanical risk by that factor and driver error by the season's", () => {
    const constants = withRetirementFactor(2, RACE_CONSTANTS, 9);
    expect(constants.mechanicalDnfEraScale).toBeCloseTo(
      RACE_CONSTANTS.mechanicalDnfEraScale * retirementScale(9),
    );
    expect(constants.driverErrorDnfAtZeroComposure).toBeCloseTo(
      RACE_CONSTANTS.driverErrorDnfAtZeroComposure * retirementScale(2),
    );
    expect(constants.driverErrorDnfAtFullComposure).toBeCloseTo(
      RACE_CONSTANTS.driverErrorDnfAtFullComposure * retirementScale(2),
    );
  });

  it("is the constants themselves when both are neutral, and one factor when they agree", () => {
    expect(
      withRetirementFactor(DEFAULT_RETIREMENT_FACTOR, RACE_CONSTANTS, DEFAULT_RETIREMENT_FACTOR),
    ).toBe(RACE_CONSTANTS);
    expect(withRetirementFactor(7, RACE_CONSTANTS, 7)).toEqual(withRetirementFactor(7));
  });
});

describe("withRetirementFactor, raced", () => {
  it("retires more of the same field as the factor rises", () => {
    // The claim the whole feature rests on: one authored number per season,
    // moving the retirement rate with the ratings held fixed. Three widely
    // spaced factors rather than all ten, so the gaps are far larger than the
    // sampling noise of a run this length.
    const gentle = retirementRate(1);
    const middle = retirementRate(5);
    const harsh = retirementRate(9);
    expect(gentle).toBeLessThan(middle);
    expect(middle).toBeLessThan(harsh);
    // And it is a large move, not a nudge — the range has to cover the gap
    // between a fifties season and a modern one.
    expect(harsh).toBeGreaterThan(gentle * 2);
  });

  it("cannot push a risk past certainty", () => {
    // The interpolated risks are clamped into [0, 1] where they are rolled, so
    // the top of the scale on an already-fragile field saturates rather than
    // producing a probability above 1 — which would silently retire the field
    // and read as a bug in the race model.
    const rate = retirementRate(10);
    expect(rate).toBeGreaterThan(0);
    expect(rate).toBeLessThanOrEqual(1);
  });
});

describe("parseRetirementFactor", () => {
  it("keeps every factor on the scale", () => {
    for (const factor of RETIREMENT_FACTORS) {
      expect(parseRetirementFactor(factor)).toBe(factor);
    }
  });

  it("falls back to the default for anything else", () => {
    for (const value of [0, 11, 5.5, -1, "5", null, undefined, Number.NaN]) {
      expect(parseRetirementFactor(value)).toBe(DEFAULT_RETIREMENT_FACTOR);
    }
  });
});
