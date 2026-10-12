/**
 * Changing the run settings from the grid: `setRunSettings`, and the rule for
 * when it may (`isUntouched`). What each setting does to a season is its own
 * file's tests; this is only whether and how the run is rebuilt.
 */

import { authoredChassis, type SeasonChassis, stepChassis } from "@alt-hist/data";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HISTORICAL_SETTINGS, OPENING_TEAMS, type RunSettings } from "../lib/run-settings.js";
import { nextEraYear, seasonSeed } from "../lib/seasons.js";
import { backToSetupLock } from "../lib/settings-lock.js";
import { YEAR } from "../test-support.js";
import { isUntouched, type Run, useSeasonStore } from "./season.js";

const FEWER: RunSettings = { ...HISTORICAL_SETTINGS, breakdowns: "fewer" };

/** One team's chassis a point off the authored one: the smallest grid edit there is. */
function editedChassis(): SeasonChassis {
  const base = authoredChassis(seasonSeed(YEAR));
  const team = Object.keys(base)[0] ?? "";
  const up = stepChassis(base, team, 1);
  return up === base ? stepChassis(base, team, -1) : up;
}

function current(): Run {
  const run = useSeasonStore.getState().run;
  if (run === null) {
    throw new Error("no run");
  }
  return run;
}

function world() {
  return current().world;
}

// A fixed draw, so the fresh seed a change takes is known; not the run's own 3.
beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.5);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("changing a season's settings from its grid", () => {
  beforeEach(() => {
    useSeasonStore.getState().simulate(3, YEAR, "aged", 2);
  });

  it("rebuilds the season on a fresh seed, exactly as starting it there with them would", () => {
    useSeasonStore.getState().setRunSettings(5, FEWER);
    const changed = world();
    expect(changed.seed).not.toBe(3);
    useSeasonStore.getState().simulate(changed.seed, YEAR, "aged", 5, FEWER);
    expect(JSON.stringify(changed)).toBe(JSON.stringify(world()));
    expect(changed.randomness).toBe(5);
    expect(changed.settings.breakdowns).toBe("fewer");
  });

  it("rebuilds nothing when nothing changed", () => {
    const before = world();
    useSeasonStore.getState().setRunSettings(2, { ...HISTORICAL_SETTINGS });
    expect(world()).toBe(before);
  });

  it("leaves the run untouched, on its grid", () => {
    useSeasonStore.getState().setRunSettings(5, FEWER);
    const run = useSeasonStore.getState().run;
    expect(run?.cursor.kind).toBe("grid");
    expect(run !== null && isUntouched(run)).toBe(true);
  });

  it("drops the era-only settings, as starting a season does", () => {
    useSeasonStore
      .getState()
      .setRunSettings(2, { ...FEWER, careerEvents: "none", teamNames: "first" });
    expect(world().settings.careerEvents).toBeNull();
    expect(world().settings.teamNames).toBeNull();
  });

  it("is refused once the grid is edited", () => {
    useSeasonStore.getState().setGrid(null, null, editedChassis());
    const before = world();
    useSeasonStore.getState().setRunSettings(5, FEWER);
    expect(world()).toBe(before);
  });

  it("is refused past the grid", () => {
    useSeasonStore.getState().continueRun();
    const before = world();
    useSeasonStore.getState().setRunSettings(5, FEWER);
    expect(world()).toBe(before);
  });
});

describe("changing an era's settings from its first grid", () => {
  beforeEach(() => {
    useSeasonStore.getState().simulateEra(3, YEAR, 2, HISTORICAL_SETTINGS);
  });

  it("rebuilds the era as starting it with them would, era-only settings and all", () => {
    const kept: RunSettings = { ...FEWER, teams: OPENING_TEAMS, teamNames: "first" };
    useSeasonStore.getState().setRunSettings(4, kept);
    const changed = world();
    expect(changed.seed).not.toBe(3);
    useSeasonStore.getState().simulateEra(changed.seed, YEAR, 4, kept);
    expect(JSON.stringify(changed)).toBe(JSON.stringify(world()));
    // What the first year records about the run follows the settings.
    expect(changed.gridKeptFrom).toBe(YEAR);
    expect(changed.namesKeptFrom).toBe(YEAR);
  });

  it("is refused in a later year", () => {
    const next = nextEraYear(YEAR);
    if (next === null) {
      return;
    }
    useSeasonStore.getState().jumpTo({ year: next, beat: { kind: "grid" } });
    expect(world().year).toBe(next);
    const before = world();
    useSeasonStore.getState().setRunSettings(5, FEWER);
    expect(world()).toBe(before);
  });

  it("leaves the way back to its setup open, as only a grid edit closes it", () => {
    useSeasonStore.getState().setRunSettings(5, FEWER);
    expect(backToSetupLock(current())).toBeNull();
    useSeasonStore.getState().setGrid(null, null, editedChassis());
    expect(backToSetupLock(current())).not.toBeNull();
  });
});
