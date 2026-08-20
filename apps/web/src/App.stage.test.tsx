import { describe, expect, it } from "vitest";
import { stageLabel } from "./App.js";

describe("the stage label in the sticky bar", () => {
  it("names where in the season the reader is", () => {
    expect(stageLabel({ kind: "grid" }, 14)).toBe("Grid");
    expect(stageLabel({ kind: "qualifying", round: 0 }, 14)).toBe("Round 1/14 — Qualifying");
    expect(stageLabel({ kind: "race", round: 13 }, 14)).toBe("Round 14/14 — Race");
    expect(stageLabel({ kind: "summary" }, 14)).toBe("Season summary");
  });
});
