import { describe, expect, it } from "vitest";
import { driverErrorRisk } from "./composure.js";
import { RACE_CONSTANTS, type RaceConstants } from "./constants.js";

/** The mapping as it was before the gain existed: one line, rating clamped. */
function plainLerp(composure: number, constants: RaceConstants): number {
  const t = Math.min(Math.max(composure, 0), 100) / 100;
  return (
    constants.driverErrorDnfAtZeroComposure +
    (constants.driverErrorDnfAtFullComposure - constants.driverErrorDnfAtZeroComposure) * t
  );
}

const withGain = (gain: number, pivot = RACE_CONSTANTS.composureSpreadPivot): RaceConstants => ({
  ...RACE_CONSTANTS,
  composureSpreadGain: gain,
  composureSpreadPivot: pivot,
});

/** Composures spanning the band a real grid occupies, and then some. */
const BAND = [40, 50, 60, 68, 75, 82, 88, 95];

describe("driverErrorRisk", () => {
  it("is the plain interpolation at a gain of one", () => {
    // The identity guarantee. A gain of 1 must leave the model exactly as the
    // two endpoints draw it, so that the constant can be turned off and the
    // seasons still describe the years they were written for.
    const identity = withGain(1);
    for (let composure = 0; composure <= 100; composure += 1) {
      expect(driverErrorRisk(composure, identity)).toBeCloseTo(plainLerp(composure, identity), 12);
    }
  });

  it("holds the risk at the pivot fixed however the gain moves", () => {
    // This is what makes the gain a rotation rather than a shift, and it is why
    // a field whose mean composure sits near the pivot keeps roughly the same
    // number of driver errors when the gain changes.
    const atPivot = driverErrorRisk(RACE_CONSTANTS.composureSpreadPivot, withGain(1));
    for (const gain of [0, 0.5, 1, 1.5, 2, 4]) {
      expect(driverErrorRisk(RACE_CONSTANTS.composureSpreadPivot, withGain(gain))).toBeCloseTo(
        atPivot,
        12,
      );
    }
  });

  it("never rewards a driver for being less composed", () => {
    for (const gain of [1, 1.5, 3]) {
      const constants = withGain(gain);
      for (let composure = 0; composure < 100; composure += 1) {
        expect(driverErrorRisk(composure + 1, constants)).toBeLessThanOrEqual(
          driverErrorRisk(composure, constants),
        );
      }
    }
  });

  it("widens the gap between the calm and the wild end of a real field", () => {
    // The whole point of the constant. Across the band a grid actually occupies,
    // a higher gain has to separate its ends by more — the complaint it answers
    // is that the endpoints promise a spread the band never sees.
    const ratio = (gain: number): number => {
      const constants = withGain(gain);
      const worst = driverErrorRisk(BAND[0] ?? 0, constants);
      const best = driverErrorRisk(BAND[BAND.length - 1] ?? 100, constants);
      return worst / best;
    };
    expect(ratio(1.5)).toBeGreaterThan(ratio(1) * 1.5);
    expect(ratio(2)).toBeGreaterThan(ratio(1.5));
  });

  it("keeps the line running past both endpoints", () => {
    // Clamping the *rating* would flatten the composed end, which is the end
    // the gain exists to separate. Two drivers above the top anchor must still
    // be told apart.
    const constants = withGain(1.5);
    const topAnchor = RACE_CONSTANTS.driverErrorDnfAtFullComposure;
    // A gain of 1.5 about the pivot puts both of these past composure 100 on
    // the rotated axis, so both sit below the anchor — and not on top of it.
    expect(driverErrorRisk(92, constants)).toBeLessThan(topAnchor);
    expect(driverErrorRisk(95, constants)).toBeLessThan(driverErrorRisk(92, constants));
  });

  it("clamps the probability rather than letting the line run negative", () => {
    // The floor the extrapolation needs. A steep enough gain drives the line
    // below zero, and a negative probability would make the roll meaningless.
    const steep = withGain(12);
    expect(driverErrorRisk(100, steep)).toBe(0);
    expect(driverErrorRisk(0, steep)).toBeLessThanOrEqual(1);
    expect(driverErrorRisk(0, steep)).toBeGreaterThanOrEqual(0);
  });

  it("scales with the endpoints, so the retirement factor and the weather still compose", () => {
    // Both arrive already scaled — by the season's factor and by the rain — and
    // the gain works on the rating axis, so the two must multiply cleanly. If
    // this breaks, every season file is describing a different year.
    const scale = 1.7;
    const scaled: RaceConstants = {
      ...withGain(1.5),
      driverErrorDnfAtZeroComposure: RACE_CONSTANTS.driverErrorDnfAtZeroComposure * scale,
      driverErrorDnfAtFullComposure: RACE_CONSTANTS.driverErrorDnfAtFullComposure * scale,
    };
    for (const composure of BAND) {
      expect(driverErrorRisk(composure, scaled)).toBeCloseTo(
        driverErrorRisk(composure, withGain(1.5)) * scale,
        12,
      );
    }
  });
});
