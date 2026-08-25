import { describe, expect, it } from "vitest";
import { seasonLabel, stageLabel } from "./App.js";

describe("the stage label in the sticky bar", () => {
  it("names where in the season the reader is", () => {
    expect(stageLabel({ kind: "grid" }, 14)).toBe("Grid");
    expect(stageLabel({ kind: "qualifying", round: 0 }, 14)).toBe("Round 1/14 — Qualifying");
    expect(stageLabel({ kind: "race", round: 13 }, 14)).toBe("Round 14/14 — Race");
    expect(stageLabel({ kind: "summary" }, 14)).toBe("Season summary");
  });
});

describe("what the sticky bar calls the season", () => {
  it("names the year on its own outside an era", () => {
    expect(seasonLabel(1980)).toBe("1980 Season");
  });

  it("says which run a season belongs to inside one", () => {
    // Four years in, this is the only thing on the page saying that stepping
    // off the summary goes to a roll of honour rather than nowhere.
    expect(seasonLabel(1984, { startYear: 1980, seasons: [] })).toBe("1984 Season — era from 1980");
  });
});
