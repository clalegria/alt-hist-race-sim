import { describe, expect, it } from "vitest";
import { firstYearInRun } from "./identity.js";
import { authoredSeasons, seasonSeed } from "./index.js";

/** Whether `teamId` has an entry in `year`. */
function enters(teamId: string, year: number): boolean {
  return seasonSeed(year).entries.some((entry) => entry.teamId === teamId);
}

/** A start year with at least one later season, and that start's teams. */
const START = authoredSeasons[0] ?? 0;
const LATER = authoredSeasons.filter((year) => year > START);
const OPENING_TEAMS = seasonSeed(START).entries.map((entry) => entry.teamId);

/**
 * A team absent from `START` that enters later, and its first season — found
 * by search, so re-authoring an entry list moves the case rather than breaking
 * the test.
 */
function laterDebut(): { teamId: string; debut: number } | undefined {
  for (const year of LATER) {
    const fresh = seasonSeed(year).entries.find(
      (entry) =>
        !OPENING_TEAMS.includes(entry.teamId) &&
        !LATER.some((earlier) => earlier < year && enters(entry.teamId, earlier)),
    );
    if (fresh !== undefined) {
      return { teamId: fresh.teamId, debut: year };
    }
  }
  return undefined;
}

describe("firstYearInRun", () => {
  it("reads every team at the year itself when names are not kept", () => {
    for (const teamId of OPENING_TEAMS) {
      for (const year of LATER) {
        expect(firstYearInRun(teamId, year, null), `${teamId} ${year}`).toBe(year);
      }
    }
  });

  it("keeps a team on the opening grid at the start year, every year after", () => {
    for (const teamId of OPENING_TEAMS) {
      for (const year of LATER) {
        expect(firstYearInRun(teamId, year, START), `${teamId} ${year}`).toBe(START);
      }
    }
  });

  it("keeps a team that enters later at its debut year, and reads it as itself before", () => {
    const found = laterDebut();
    expect(found, "a team absent from the first season that enters later").toBeDefined();
    if (found === undefined) {
      return;
    }
    for (const year of LATER) {
      expect(firstYearInRun(found.teamId, year, START), String(year)).toBe(
        year < found.debut ? year : found.debut,
      );
    }
  });

  it("reads a year before the run as itself", () => {
    const from = LATER[0] ?? START;
    for (const teamId of OPENING_TEAMS) {
      expect(firstYearInRun(teamId, START, from), teamId).toBe(START);
    }
  });

  it("reads a team the seasons never enter as the year itself", () => {
    expect(firstYearInRun("no-such-team", LATER.at(-1) ?? START, START)).toBe(
      LATER.at(-1) ?? START,
    );
  });
});
