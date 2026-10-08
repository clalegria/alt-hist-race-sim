import { createRng } from "@alt-hist/engine";
import { describe, expect, it } from "vitest";
import { buildField } from "./buildField.js";
import {
  applyChassis,
  authoredChassis,
  CHASSIS_STEP_RANGE,
  canStepChassis,
  chassisChanges,
  isAuthoredChassis,
  randomChassis,
  stepChassis,
  variedChassis,
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

/** Synthetic cars spread across the scale, so the rolls have ranges to keep to. */
const SPREAD_SEASON: SeasonSeed = {
  ...SEASON,
  entries: SEASON.entries.map((entry, index) => ({
    ...entry,
    chassis:
      index === 0
        ? EDGE
        : {
            racing: 40 + index,
            qualifying: 70 - index,
            consistency: 50 + (index % 3),
            reliability: 30 + 2 * index,
          },
  })),
};

describe("variedChassis", () => {
  const SPREAD = 10;

  it("moves each team's four ratings by one offset within the spread, clamped", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const rolled = variedChassis(SPREAD_SEASON, SPREAD, createRng(seed));
      expect(Object.keys(rolled)).toEqual(SPREAD_SEASON.entries.map((entry) => entry.teamId));
      for (const entry of SPREAD_SEASON.entries) {
        const now = rolled[entry.teamId] as ChassisSpec;
        // The offset is read off a rating no clamp can reach from 50 or 60.
        const offset = now.qualifying - entry.chassis.qualifying;
        expect(Math.abs(offset)).toBeLessThanOrEqual(SPREAD);
        for (const key of ["racing", "qualifying", "consistency", "reliability"] as const) {
          const expected = Math.min(
            Math.max(entry.chassis[key] + offset, CHASSIS_STEP_RANGE.min),
            CHASSIS_STEP_RANGE.max,
          );
          expect(now[key]).toBe(expected);
        }
      }
    }
  });

  it("reaches both ends of the spread over many teams", () => {
    const offsets = new Set<number>();
    for (let seed = 1; seed <= 50; seed += 1) {
      const rolled = variedChassis(SEASON, 2, createRng(seed));
      for (const entry of SEASON.entries) {
        offsets.add((rolled[entry.teamId] as ChassisSpec).qualifying - entry.chassis.qualifying);
      }
    }
    expect([...offsets].sort((a, b) => a - b)).toEqual([-2, -1, 0, 1, 2]);
  });

  it("is a function of the generator's state", () => {
    expect(variedChassis(SPREAD_SEASON, SPREAD, createRng(7))).toEqual(
      variedChassis(SPREAD_SEASON, SPREAD, createRng(7)),
    );
  });

  it("lands on ratings applyChassis accepts", () => {
    const rolled = variedChassis(SPREAD_SEASON, 30, createRng(11));
    expect(() => applyChassis(SPREAD_SEASON, rolled)).not.toThrow();
  });

  describe("from previous year's cars", () => {
    // Every team but the last raced last year, on a car of its own unlike this
    // year's; the last is new and has only this year's to move off.
    const LAST: ChassisSpec = { racing: 30, qualifying: 30, consistency: 30, reliability: 30 };
    const [newcomer] = SPREAD_SEASON.entries.slice(-1);
    const lastYear = Object.fromEntries(
      SPREAD_SEASON.entries
        .filter((entry) => entry !== newcomer)
        .map((entry) => [entry.teamId, LAST]),
    );

    it("moves a team that raced last year off that car, and a new one off its own", () => {
      for (const seed of [1, 2, 3, 4, 5]) {
        const walked = variedChassis(SPREAD_SEASON, SPREAD, createRng(seed), lastYear);
        const real = variedChassis(SPREAD_SEASON, SPREAD, createRng(seed));
        for (const entry of SPREAD_SEASON.entries) {
          const base = entry === newcomer ? entry.chassis : LAST;
          // The same draw either way, so the offset is the real roll's.
          const offset = (real[entry.teamId] as ChassisSpec).qualifying - entry.chassis.qualifying;
          for (const key of ["racing", "qualifying", "consistency", "reliability"] as const) {
            expect((walked[entry.teamId] as ChassisSpec)[key], `${seed} ${entry.teamId}`).toBe(
              Math.min(
                Math.max(base[key] + offset, CHASSIS_STEP_RANGE.min),
                CHASSIS_STEP_RANGE.max,
              ),
            );
          }
        }
      }
    });

    it("ignores a team from last year that does not enter this one", () => {
      const withLeaver = { ...lastYear, "not-entered": LAST };
      expect(variedChassis(SPREAD_SEASON, SPREAD, createRng(3), withLeaver)).toEqual(
        variedChassis(SPREAD_SEASON, SPREAD, createRng(3), lastYear),
      );
    });
  });
});

describe("randomChassis", () => {
  it("draws every rating between the season's weakest and strongest of it", () => {
    const keys = ["racing", "qualifying", "consistency", "reliability"] as const;
    for (const seed of [1, 2, 3, 4, 5]) {
      const rolled = randomChassis(SPREAD_SEASON, createRng(seed));
      expect(Object.keys(rolled)).toEqual(SPREAD_SEASON.entries.map((entry) => entry.teamId));
      for (const key of keys) {
        const authored = SPREAD_SEASON.entries.map((entry) => entry.chassis[key]);
        for (const entry of SPREAD_SEASON.entries) {
          const value = (rolled[entry.teamId] as ChassisSpec)[key];
          expect(Number.isInteger(value)).toBe(true);
          expect(value).toBeGreaterThanOrEqual(Math.min(...authored));
          expect(value).toBeLessThanOrEqual(Math.max(...authored));
        }
      }
    }
  });

  it("draws each rating on its own rather than one car for all four", () => {
    const rolled = randomChassis(SPREAD_SEASON, createRng(3));
    const differs = SPREAD_SEASON.entries.some((entry) => {
      const now = rolled[entry.teamId] as ChassisSpec;
      return now.racing - entry.chassis.racing !== now.qualifying - entry.chassis.qualifying;
    });
    expect(differs).toBe(true);
  });

  it("is a function of the generator's state", () => {
    expect(randomChassis(SPREAD_SEASON, createRng(7))).toEqual(
      randomChassis(SPREAD_SEASON, createRng(7)),
    );
  });
});
