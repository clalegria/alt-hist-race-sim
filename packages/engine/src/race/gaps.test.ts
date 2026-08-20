import { describe, expect, it } from "vitest";
import { RACE_CONSTANTS, type RaceConstants } from "./constants.js";
import { qualifyingGapSeconds, raceGap } from "./gaps.js";

/** Seconds out of a gap, whichever shape it came back in. */
function secondsOf(winnerScore: number, score: number, constants = RACE_CONSTANTS): number {
  const gap = raceGap(winnerScore, score, constants);
  return gap.kind === "time" ? gap.seconds : gap.laps * constants.nominalLapSeconds;
}

describe("qualifying gaps", () => {
  it("puts the pole sitter on zero", () => {
    expect(qualifyingGapSeconds(90, 90, RACE_CONSTANTS)).toBe(0);
  });

  it("scales linearly with the deficit", () => {
    const one = qualifyingGapSeconds(90, 89, RACE_CONSTANTS);
    const three = qualifyingGapSeconds(90, 87, RACE_CONSTANTS);
    expect(one).toBeCloseTo(RACE_CONSTANTS.qualifyingGapSecondsPerPoint, 10);
    expect(three).toBeCloseTo(one * 3, 10);
  });

  it("grows with the deficit and never goes backwards", () => {
    let previous = -1;
    for (let deficit = 0; deficit <= 50; deficit += 0.5) {
      const gap = qualifyingGapSeconds(90, 90 - deficit, RACE_CONSTANTS);
      expect(gap).toBeGreaterThan(previous);
      previous = gap;
    }
  });

  it("clamps a faster-than-pole score to zero rather than going negative", () => {
    // Defensive: the caller always passes the actual pole score, but a negative
    // gap would render as "+-0.3s" and quietly invert a sort.
    expect(qualifyingGapSeconds(90, 95, RACE_CONSTANTS)).toBe(0);
  });

  it("responds to the constant", () => {
    const doubled: RaceConstants = {
      ...RACE_CONSTANTS,
      qualifyingGapSecondsPerPoint: RACE_CONSTANTS.qualifyingGapSecondsPerPoint * 2,
    };
    expect(qualifyingGapSeconds(90, 85, doubled)).toBeCloseTo(
      qualifyingGapSeconds(90, 85, RACE_CONSTANTS) * 2,
      10,
    );
  });
});

describe("race gaps", () => {
  it("puts the winner on zero seconds, not on a lap down", () => {
    expect(raceGap(90, 90, RACE_CONSTANTS)).toEqual({ kind: "time", seconds: 0 });
  });

  it("reports a small deficit in seconds", () => {
    const gap = raceGap(90, 87, RACE_CONSTANTS);
    expect(gap.kind).toBe("time");
    expect(gap.kind === "time" ? gap.seconds : 0).toBeGreaterThan(0);
  });

  it("switches to whole laps once the gap passes one lap", () => {
    const gap = raceGap(90, 40, RACE_CONSTANTS);
    expect(gap.kind).toBe("laps");
    expect(gap.kind === "laps" ? gap.laps : 0).toBeGreaterThanOrEqual(1);
  });

  it("anchors the curve at a one-point deficit", () => {
    const gap = raceGap(90, 89, RACE_CONSTANTS);
    expect(gap.kind === "time" ? gap.seconds : 0).toBeCloseTo(
      RACE_CONSTANTS.raceGapSecondsAtOnePoint,
      10,
    );
  });

  it("stretches the tail faster than the front, so the exponent earns its keep", () => {
    // The whole reason this is not linear: doubling the deficit must more than
    // double the gap, or the back of the field never falls a lap behind while
    // the leaders are still seconds apart.
    const near = secondsOf(90, 88);
    const far = secondsOf(90, 86);
    expect(far).toBeGreaterThan(near * 2);
  });

  it("is linear when the exponent is 1", () => {
    const linear: RaceConstants = { ...RACE_CONSTANTS, raceGapExponent: 1 };
    expect(secondsOf(90, 86, linear)).toBeCloseTo(secondsOf(90, 88, linear) * 2, 10);
  });

  it("never goes backwards as the deficit grows", () => {
    let previous = -1;
    for (let deficit = 0; deficit <= 60; deficit += 0.25) {
      const seconds = secondsOf(90, 90 - deficit);
      expect(seconds).toBeGreaterThanOrEqual(previous);
      previous = seconds;
    }
  });

  it("counts laps down by whole laps only", () => {
    const constants: RaceConstants = { ...RACE_CONSTANTS, nominalLapSeconds: 10 };
    for (let deficit = 0; deficit <= 60; deficit += 0.25) {
      const gap = raceGap(90, 90 - deficit, constants);
      if (gap.kind === "laps") {
        expect(Number.isInteger(gap.laps)).toBe(true);
        expect(gap.laps).toBeGreaterThan(0);
      }
    }
  });

  it("laps a car the moment the gap reaches a full lap, not a moment later", () => {
    // The boundary belongs to the lapped side: once the leader has covered a
    // whole lap more than you, you are a lap down. Just under it, you are not.
    const oneLap = RACE_CONSTANTS.raceGapSecondsAtOnePoint;
    const constants: RaceConstants = {
      ...RACE_CONSTANTS,
      raceGapExponent: 1,
      nominalLapSeconds: oneLap,
    };
    expect(raceGap(90, 89, constants)).toEqual({ kind: "laps", laps: 1 });
    expect(raceGap(90, 89.001, constants).kind).toBe("time");
  });

  it("clamps a faster-than-winner score to zero", () => {
    expect(raceGap(90, 95, RACE_CONSTANTS)).toEqual({ kind: "time", seconds: 0 });
  });

  it("degrades to the lead lap rather than infinity if the lap length is zero", () => {
    const broken: RaceConstants = { ...RACE_CONSTANTS, nominalLapSeconds: 0 };
    expect(raceGap(90, 40, broken).kind).toBe("laps");
    expect(Number.isFinite(secondsOf(90, 40, RACE_CONSTANTS))).toBe(true);
  });
});
