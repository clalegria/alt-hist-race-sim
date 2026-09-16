import type { HomeAllegiances } from "@alt-hist/engine";
import { describe, expect, it } from "vitest";
import { homeAdvantageLabel } from "./home.js";

const at = (...keys: readonly (keyof HomeAllegiances)[]): HomeAllegiances => ({
  driver: keys.includes("driver"),
  team: keys.includes("team"),
  engine: keys.includes("engine"),
});

describe("homeAdvantageLabel", () => {
  it("says nothing for an entry with nobody at home", () => {
    expect(homeAdvantageLabel(at())).toBeNull();
  });

  it("names the one allegiance that is at home", () => {
    expect(homeAdvantageLabel(at("driver"))).toContain("the driver");
    expect(homeAdvantageLabel(at("driver"))).not.toContain("the team");
    expect(homeAdvantageLabel(at("team"))).toContain("the team");
    expect(homeAdvantageLabel(at("engine"))).toContain("the engine manufacturer");
  });

  it("lists two, and three, in the order they are scored", () => {
    expect(homeAdvantageLabel(at("driver", "team"))).toContain("the driver and the team");
    expect(homeAdvantageLabel(at("driver", "engine"))).toContain(
      "the driver and the engine manufacturer",
    );
    expect(homeAdvantageLabel(at("driver", "team", "engine"))).toContain(
      "the driver, the team and the engine manufacturer",
    );
  });

  it("reads as one sentence whatever is in it", () => {
    for (const keys of [["driver"], ["team", "engine"], ["driver", "team", "engine"]] as const) {
      const label = homeAdvantageLabel(at(...keys));
      expect(label).toMatch(/^Home race for /);
      expect(label).toMatch(/\.$/);
      // No stray separator from an empty slot in the list.
      expect(label).not.toContain(" ,");
      expect(label).not.toContain("and and");
    }
  });
});
