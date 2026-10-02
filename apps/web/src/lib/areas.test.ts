import { describe, expect, it } from "vitest";
import { AREAS, isAvailable } from "./areas.js";
import { MODES } from "./modes.js";

describe("the top nav's areas", () => {
  it("are greyed out while the mode they open is unbuilt", () => {
    // One statement of whether a mode exists: the menu card's. An entry that
    // disagreed would lead into a mode the menu says is not there.
    for (const area of AREAS) {
      const mode = MODES.find((candidate) => candidate.id === area.mode);
      if (mode !== undefined && !mode.available) {
        expect(isAvailable(area), area.label).toBe(false);
      }
    }
  });

  it("are greyed out while they have no page", () => {
    expect(isAvailable({ label: "Somewhere", mode: "season" })).toBe(false);
  });

  it("can be followed once they have a page and their mode is built", () => {
    for (const area of AREAS) {
      const mode = MODES.find((candidate) => candidate.id === area.mode);
      if (area.to !== undefined && (mode === undefined || mode.available)) {
        expect(isAvailable(area), area.label).toBe(true);
      }
    }
  });

  it("have one entry per mode, in the order the menu lists them", () => {
    // The nav and the menu cards are two ways into the same modes.
    const modes = AREAS.flatMap((area) => (area.mode === undefined ? [] : [area.mode]));
    expect(modes).toEqual(MODES.map((mode) => mode.id));
  });
});
