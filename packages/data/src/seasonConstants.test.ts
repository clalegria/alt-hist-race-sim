import {
  breakdownScale,
  RACE_CONSTANTS,
  UNSCALED_RANDOMNESS_LEVEL,
  withRandomness,
  withRetirementFactor,
} from "@alt-hist/engine";
import { describe, expect, it } from "vitest";
import { seasonConstants } from "./seasonConstants.js";
import type { SeasonSeed } from "./types.js";

/** A season with nothing in it but the two fields this seam reads. */
function season(retirementFactor: number): SeasonSeed {
  return {
    year: 1980,
    points: [9, 6, 4, 3, 2, 1],
    retirementFactor,
    calendar: [],
    engines: [],
    entries: [],
  };
}

describe("seasonConstants", () => {
  it("is the constants themselves at the neutral factor and the unscaled level", () => {
    // By identity. Both halves return their input unchanged at their neutral
    // setting, and composing them must not lose that. The level is named rather
    // than left to default: the default is `Realistic`, which scales the sigmas
    // and so cannot return the object itself.
    expect(seasonConstants(season(5), UNSCALED_RANDOMNESS_LEVEL)).toBe(RACE_CONSTANTS);
  });

  it("applies the season's own retirement factor", () => {
    for (const factor of [1, 3, 7, 10]) {
      expect(seasonConstants(season(factor), UNSCALED_RANDOMNESS_LEVEL)).toEqual(
        withRetirementFactor(factor as 1),
      );
    }
  });

  it("applies both the factor and the randomness level, neither cancelling the other", () => {
    const constants = seasonConstants(season(9), 5);
    const noiseOnly = withRandomness(5);
    const factorOnly = withRetirementFactor(9);
    expect(constants.racingNoise).toBe(noiseOnly.racingNoise);
    expect(constants.qualifyingNoise).toBe(noiseOnly.qualifyingNoise);
    expect(constants.mechanicalDnfEraScale).toBe(factorOnly.mechanicalDnfEraScale);
    expect(constants.driverErrorDnfAtZeroComposure).toBe(factorOnly.driverErrorDnfAtZeroComposure);
  });

  it("bends a caller's own base constants, not the written ones", () => {
    // Offset from the written sigmas rather than fixed numbers, so the two can
    // never coincide however the constants are moved.
    const base = {
      ...RACE_CONSTANTS,
      qualifyingNoise: RACE_CONSTANTS.qualifyingNoise + 1,
      racingNoise: RACE_CONSTANTS.racingNoise + 1,
    };
    expect(seasonConstants(season(5), UNSCALED_RANDOMNESS_LEVEL, base)).toBe(base);

    const constants = seasonConstants(season(9), 5, base);
    const noiseOnly = withRandomness(5, base);
    expect(constants.qualifyingNoise).toBe(noiseOnly.qualifyingNoise);
    expect(constants.racingNoise).toBe(noiseOnly.racingNoise);
    expect(constants.mechanicalDnfEraScale).toBe(withRetirementFactor(9).mechanicalDnfEraScale);
  });

  it("falls back to the default factor rather than trusting an out-of-range number", () => {
    // `validateSeedData` is what actually rejects these; this is the second
    // line, so a season that slipped through races on the constants themselves
    // instead of at some arithmetic on a nonsense number.
    for (const factor of [0, 11, 4.5, Number.NaN]) {
      expect(seasonConstants(season(factor), UNSCALED_RANDOMNESS_LEVEL)).toBe(RACE_CONSTANTS);
    }
  });

  it("is still the constants themselves with no run settings", () => {
    expect(seasonConstants(season(5), UNSCALED_RANDOMNESS_LEVEL, undefined, {})).toBe(
      RACE_CONSTANTS,
    );
    expect(
      seasonConstants(season(5), UNSCALED_RANDOMNESS_LEVEL, undefined, {
        breakdowns: "realistic",
      }),
    ).toBe(RACE_CONSTANTS);
  });

  it("races its cars on another season's factor, and its drivers on its own", () => {
    const constants = seasonConstants(season(2), UNSCALED_RANDOMNESS_LEVEL, undefined, {
      mechanicalFactor: 8,
    });
    const other = seasonConstants(season(8), UNSCALED_RANDOMNESS_LEVEL);
    const own = seasonConstants(season(2), UNSCALED_RANDOMNESS_LEVEL);
    expect(constants.mechanicalDnfEraScale).toBe(other.mechanicalDnfEraScale);
    expect(constants.driverErrorDnfAtZeroComposure).toBe(own.driverErrorDnfAtZeroComposure);
    expect(constants.driverErrorDnfAtFullComposure).toBe(own.driverErrorDnfAtFullComposure);
    expect(
      seasonConstants(season(5), UNSCALED_RANDOMNESS_LEVEL, undefined, { mechanicalFactor: 5 }),
    ).toBe(RACE_CONSTANTS);
  });

  it("scales the mechanical risk by Breakdowns on top of the factor, and driver error not at all", () => {
    for (const breakdowns of ["fewer", "none"] as const) {
      const constants = seasonConstants(season(9), 5, undefined, { breakdowns });
      const without = seasonConstants(season(9), 5);
      expect(constants.mechanicalDnfEraScale).toBeCloseTo(
        without.mechanicalDnfEraScale * breakdownScale(breakdowns),
      );
      expect(constants.driverErrorDnfAtZeroComposure).toBe(without.driverErrorDnfAtZeroComposure);
      expect(constants.driverErrorDnfAtFullComposure).toBe(without.driverErrorDnfAtFullComposure);
      expect(constants.racingNoise).toBe(without.racingNoise);
    }
  });
});
