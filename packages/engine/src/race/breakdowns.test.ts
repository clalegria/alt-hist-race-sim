import { describe, expect, it } from "vitest";
import { createRng } from "../rng/index.js";
import { BREAKDOWNS, type Breakdowns, parseBreakdowns, withBreakdowns } from "./breakdowns.js";
import { RACE_CONSTANTS } from "./constants.js";
import { simulateRace } from "./simulateRace.js";
import type { RaceEntrant } from "./types.js";

/**
 * Mid ratings on both halves of the retirement calculation, so both causes
 * occur often enough to count. Synthetic: no test here reads an authored number.
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

/** Retirements by cause over a fixed run. */
function retirements(breakdowns: Breakdowns, races = 300): { mechanical: number; driver: number } {
  const rng = createRng(20261007);
  const constants = withBreakdowns(breakdowns);
  const field = fragileField();
  const counts = { mechanical: 0, driver: 0 };
  for (let index = 0; index < races; index += 1) {
    for (const entry of simulateRace(field, rng, constants).entries) {
      if (entry.dnfCause === "mechanical") {
        counts.mechanical += 1;
      } else if (entry.dnfCause === "driver-error") {
        counts.driver += 1;
      }
    }
  }
  return counts;
}

describe("withBreakdowns", () => {
  it("leaves the constants alone at Realistic", () => {
    expect(withBreakdowns("realistic")).toBe(RACE_CONSTANTS);
  });

  it("scales the mechanical risk and nothing else", () => {
    for (const breakdowns of BREAKDOWNS) {
      const { mechanicalDnfEraScale, ...rest } = withBreakdowns(breakdowns);
      const { mechanicalDnfEraScale: _, ...written } = RACE_CONSTANTS;
      expect(rest).toEqual(written);
      expect(mechanicalDnfEraScale).toBeLessThanOrEqual(RACE_CONSTANTS.mechanicalDnfEraScale);
    }
    expect(withBreakdowns("none").mechanicalDnfEraScale).toBe(0);
  });
});

describe("withBreakdowns, raced", () => {
  it("fails fewer cars under Fewer, and none under None", () => {
    const realistic = retirements("realistic");
    const fewer = retirements("fewer");
    const none = retirements("none");
    expect(fewer.mechanical).toBeLessThan(realistic.mechanical);
    expect(fewer.mechanical).toBeGreaterThan(0);
    expect(none.mechanical).toBe(0);
  });

  it("still lets drivers crash out with no breakdowns at all", () => {
    expect(retirements("none").driver).toBeGreaterThan(0);
  });
});

describe("parseBreakdowns", () => {
  it("keeps every setting and falls back to Realistic for anything else", () => {
    for (const breakdowns of BREAKDOWNS) {
      expect(parseBreakdowns(breakdowns)).toBe(breakdowns);
    }
    for (const value of ["", "None", 0, null, undefined]) {
      expect(parseBreakdowns(value)).toBe("realistic");
    }
  });
});
