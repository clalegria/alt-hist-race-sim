import { RACE_CONSTANTS, withRandomness, withRetirementFactor } from "@alt-hist/engine";
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
  it("is the calibrated constants themselves for a default season at the default level", () => {
    // By identity. Both halves return their input unchanged at their neutral
    // setting, and composing them must not lose that — it is what keeps the
    // calibration a description of the model an untouched season runs.
    expect(seasonConstants(season(5))).toBe(RACE_CONSTANTS);
  });

  it("applies the season's own retirement factor", () => {
    for (const factor of [1, 3, 7, 10]) {
      expect(seasonConstants(season(factor))).toEqual(withRetirementFactor(factor as 1));
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

  it("falls back to the default factor rather than trusting an out-of-range number", () => {
    // `validateSeedData` is what actually rejects these; this is the second
    // line, so a season that slipped through races at the calibrated default
    // instead of at some arithmetic on a nonsense number.
    for (const factor of [0, 11, 4.5, Number.NaN]) {
      expect(seasonConstants(season(factor))).toBe(RACE_CONSTANTS);
    }
  });
});
