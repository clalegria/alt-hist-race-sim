import { describe, expect, it } from "vitest";
import { buildField } from "./buildField.js";
import {
  applyChassis,
  authoredChassis,
  CHASSIS_STEP_RANGE,
  canStepChassis,
  chassisChanges,
  isAuthoredChassis,
  stepChassis,
} from "./chassis.js";
import { FIRST_AUTHORED_SEASON, seasonSeed } from "./index.js";
import type { ChassisSpec, SeasonSeed } from "./types.js";

/**
 * An authored season with its chassis replaced by synthetic ones, so every
 * assertion below is about the rule and none about what a car is rated.
 *
 * The first car sits on the top of the scale for racing and the bottom for
 * reliability, which is where the clamp has something to do.
 */
const EDGE: ChassisSpec = {
  racing: CHASSIS_STEP_RANGE.max,
  qualifying: 50,
  consistency: 50,
  reliability: CHASSIS_STEP_RANGE.min,
};
const MIDDLE: ChassisSpec = { racing: 60, qualifying: 60, consistency: 60, reliability: 60 };

const SEASON: SeasonSeed = (() => {
  const seed = seasonSeed(FIRST_AUTHORED_SEASON);
  return {
    ...seed,
    entries: seed.entries.map((entry, index) => ({
      ...entry,
      chassis: index === 0 ? EDGE : MIDDLE,
    })),
  };
})();
const [EDGE_TEAM, MIDDLE_TEAM] = SEASON.entries.map((entry) => entry.teamId) as [string, string];

describe("authoredChassis", () => {
  it("names every team in the season, with the chassis it entered", () => {
    const authored = authoredChassis(SEASON);
    expect(Object.keys(authored).sort()).toEqual(SEASON.entries.map((e) => e.teamId).sort());
    for (const entry of SEASON.entries) {
      expect(authored[entry.teamId]).toEqual(entry.chassis);
    }
  });

  it("is recognised as the authored chassis, and applies to the season unchanged", () => {
    const authored = authoredChassis(SEASON);
    expect(isAuthoredChassis(SEASON, authored)).toBe(true);
    expect(applyChassis(SEASON, authored)).toEqual(SEASON);
    expect(chassisChanges(SEASON, authored)).toEqual([]);
  });
});

describe("stepChassis", () => {
  it("moves all four ratings by one when no rating is named", () => {
    const next = stepChassis(authoredChassis(SEASON), MIDDLE_TEAM, 1);
    expect(next[MIDDLE_TEAM]).toEqual({
      racing: MIDDLE.racing + 1,
      qualifying: MIDDLE.qualifying + 1,
      consistency: MIDDLE.consistency + 1,
      reliability: MIDDLE.reliability + 1,
    });
  });

  it("moves only the named rating", () => {
    const next = stepChassis(authoredChassis(SEASON), MIDDLE_TEAM, -1, "consistency");
    expect(next[MIDDLE_TEAM]).toEqual({ ...MIDDLE, consistency: MIDDLE.consistency - 1 });
  });

  it("leaves every other team alone", () => {
    const authored = authoredChassis(SEASON);
    const next = stepChassis(authored, MIDDLE_TEAM, 1);
    for (const entry of SEASON.entries) {
      if (entry.teamId !== MIDDLE_TEAM) {
        expect(next[entry.teamId]).toBe(authored[entry.teamId]);
      }
    }
  });

  it("holds each rating inside the scale on its own", () => {
    const up = stepChassis(authoredChassis(SEASON), EDGE_TEAM, 1);
    expect(up[EDGE_TEAM]).toEqual({
      racing: CHASSIS_STEP_RANGE.max,
      qualifying: EDGE.qualifying + 1,
      consistency: EDGE.consistency + 1,
      reliability: EDGE.reliability + 1,
    });
    const down = stepChassis(authoredChassis(SEASON), EDGE_TEAM, -1);
    expect(down[EDGE_TEAM]).toEqual({
      racing: EDGE.racing - 1,
      qualifying: EDGE.qualifying - 1,
      consistency: EDGE.consistency - 1,
      reliability: CHASSIS_STEP_RANGE.min,
    });
  });

  it("hands back the same override when nothing could move", () => {
    const authored = authoredChassis(SEASON);
    expect(stepChassis(authored, EDGE_TEAM, 1, "racing")).toBe(authored);
    expect(stepChassis(authored, EDGE_TEAM, -1, "reliability")).toBe(authored);
    expect(stepChassis(authored, "no-such-team", 1)).toBe(authored);
  });

  it("returns to the authored chassis when undone", () => {
    const authored = authoredChassis(SEASON);
    const back = stepChassis(stepChassis(authored, MIDDLE_TEAM, 1), MIDDLE_TEAM, -1);
    expect(isAuthoredChassis(SEASON, back)).toBe(true);
  });
});

describe("canStepChassis", () => {
  it("says whether a step that way could move anything", () => {
    expect(canStepChassis(EDGE, 1, "racing")).toBe(false);
    expect(canStepChassis(EDGE, -1, "reliability")).toBe(false);
    expect(canStepChassis(EDGE, 1)).toBe(true);
    expect(canStepChassis(EDGE, -1)).toBe(true);
    const top: ChassisSpec = {
      racing: CHASSIS_STEP_RANGE.max,
      qualifying: CHASSIS_STEP_RANGE.max,
      consistency: CHASSIS_STEP_RANGE.max,
      reliability: CHASSIS_STEP_RANGE.max,
    };
    expect(canStepChassis(top, 1)).toBe(false);
    expect(canStepChassis(top, -1)).toBe(true);
  });
});

describe("applyChassis", () => {
  it("puts the re-rated chassis on the field buildField makes", () => {
    const next = stepChassis(authoredChassis(SEASON), MIDDLE_TEAM, 1);
    const field = buildField(applyChassis(SEASON, next));
    for (const entrant of field.filter((e) => e.teamId === MIDDLE_TEAM)) {
      expect(entrant.chassis).toEqual(next[MIDDLE_TEAM]);
    }
  });

  it("refuses a team the season does not enter", () => {
    expect(() => applyChassis(SEASON, { ...authoredChassis(SEASON), ghost: MIDDLE })).toThrow(
      "ghost",
    );
  });

  it("refuses an override missing a team", () => {
    const { [MIDDLE_TEAM]: _dropped, ...rest } = authoredChassis(SEASON);
    expect(() => applyChassis(SEASON, rest)).toThrow(MIDDLE_TEAM);
  });

  it.each([
    ["above the scale", 101],
    ["below the scale", -1],
    ["fractional", 50.5],
    ["not a number", Number.NaN],
  ])("refuses a rating %s", (_label, value) => {
    const bad = { ...authoredChassis(SEASON), [MIDDLE_TEAM]: { ...MIDDLE, racing: value } };
    expect(() => applyChassis(SEASON, bad)).toThrow(MIDDLE_TEAM);
  });
});

describe("chassisChanges", () => {
  it("lists only the teams whose chassis moved, with both ends", () => {
    const next = stepChassis(authoredChassis(SEASON), MIDDLE_TEAM, -1, "racing");
    expect(chassisChanges(SEASON, next)).toEqual([
      { teamId: MIDDLE_TEAM, from: MIDDLE, to: { ...MIDDLE, racing: MIDDLE.racing - 1 } },
    ]);
  });
});
