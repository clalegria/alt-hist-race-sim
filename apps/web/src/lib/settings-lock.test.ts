import { authoredLineup } from "@alt-hist/data";
import { describe, expect, it } from "vitest";
import { createWorld, type Run, type World } from "../store/season.js";
import { YEAR } from "../test-support.js";
import { seasonSeed } from "./seasons.js";
import { backToSetupLock, settingsLock } from "./settings-lock.js";

const first = createWorld(3, YEAR);
/** An edit as `isUntouched` sees one: any part of the grid not null. */
const edited: World = { ...first, lineup: authoredLineup(seasonSeed(YEAR)) };
const grid = { kind: "grid" } as const;

describe("when a run's settings can still be changed", () => {
  it("can on the first grid, as entered, of a season or an era", () => {
    expect(settingsLock({ kind: "season", world: first, cursor: grid })).toBeNull();
    expect(
      settingsLock({
        kind: "era",
        run: { startYear: YEAR, seasons: [] },
        world: first,
        cursor: grid,
      }),
    ).toBeNull();
  });

  it("cannot once that grid is edited, and says how to get back", () => {
    const lock = settingsLock({ kind: "season", world: edited, cursor: grid });
    expect(lock).toContain("Clear all edits");
  });

  it("cannot past the grid, or in a later year of an era", () => {
    const runs: Run[] = [
      { kind: "season", world: first, cursor: { kind: "qualifying", round: 0 } },
      { kind: "season", world: first, cursor: { kind: "summary" } },
      { kind: "era", run: { startYear: YEAR, seasons: [first] }, world: first, cursor: grid },
      { kind: "era", run: { startYear: YEAR, seasons: [first] }, world: edited, cursor: grid },
    ];
    for (const run of runs) {
      const lock = settingsLock(run);
      expect(lock).not.toBeNull();
      expect(lock).not.toContain("Clear all edits");
    }
  });
});

describe("when an era's grid can go back to its setup", () => {
  const era = (world: World): Run => ({
    kind: "era",
    run: { startYear: YEAR, seasons: [] },
    world,
    cursor: grid,
  });

  it("can on its first grid, as entered", () => {
    expect(backToSetupLock(era(first))).toBeNull();
  });

  it("is greyed out once the grid is edited, with the reason", () => {
    expect(backToSetupLock(era(edited))).toContain("grid");
  });

  it("is not offered in a season, past the grid or in a later year", () => {
    const runs: Run[] = [
      { kind: "season", world: first, cursor: grid },
      { ...era(first), cursor: { kind: "summary" } },
      { kind: "era", run: { startYear: YEAR, seasons: [first] }, world: first, cursor: grid },
    ];
    for (const run of runs) {
      expect(backToSetupLock(run)).toBeUndefined();
    }
  });
});
