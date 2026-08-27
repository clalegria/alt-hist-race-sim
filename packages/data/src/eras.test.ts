import { describe, expect, it } from "vitest";
import { eraAt, teamIdentityIn, teamLiveryIn } from "./eras.js";
import { seasons, teams } from "./index.js";
import type { Era, Team } from "./types.js";

/** Three eras, so "the middle one" is a case distinct from either end. */
const ERAS: readonly (Era & { label: string })[] = [
  { from: 1970, label: "first" },
  { from: 1980, label: "second" },
  { from: 1990, label: "third" },
];

describe("eraAt", () => {
  it("returns the era a year falls inside", () => {
    expect(eraAt(ERAS, 1975).label).toBe("first");
    expect(eraAt(ERAS, 1985).label).toBe("second");
    expect(eraAt(ERAS, 1995).label).toBe("third");
  });

  it("starts an era in its own `from` year, not the year after", () => {
    // Off-by-one here is a whole season drawn under the previous name. The
    // first era is excluded from the second half only because the year before
    // it falls back *to* it, which the test below covers instead.
    ERAS.forEach((era, index) => {
      expect(eraAt(ERAS, era.from).label, String(era.from)).toBe(era.label);
      if (index > 0) {
        expect(eraAt(ERAS, era.from - 1).label, String(era.from - 1)).toBe(ERAS[index - 1]?.label);
      }
    });
  });

  it("runs the last era forward with no end", () => {
    expect(eraAt(ERAS, 2500).label).toBe("third");
  });

  it("falls back to the first era before any of them start", () => {
    // A render, not a throw: an approximate name beats no name at all.
    expect(eraAt(ERAS, 1066).label).toBe("first");
  });

  it("gives the most recent era when asked without a year", () => {
    expect(eraAt(ERAS).label).toBe("third");
  });

  it("throws on an empty list rather than returning undefined", () => {
    expect(() => eraAt([] as readonly Era[], 1980)).toThrow(/at least one era/);
  });
});

describe("the authored teams", () => {
  it("resolves a name, a base and a livery for every team in every season", () => {
    // The property, over whatever the files hold — no team, year or colour is
    // named here, so authoring a season or repainting a car cannot fail this.
    for (const season of seasons.values()) {
      for (const team of teams) {
        const identity = teamIdentityIn(team, season.year);
        expect(identity.name, `${team.id} in ${season.year}`).not.toBe("");
        expect(identity.base, `${team.id} in ${season.year}`).toMatch(/^[A-Z]{2}$/);
        expect(teamLiveryIn(team, season.year).primaryColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    }
  });

  it("keeps both era lists sorted, so a later era can never be shadowed", () => {
    for (const team of teams) {
      for (const list of [team.identity, team.liveries] as readonly (readonly Era[])[]) {
        const years = list.map((era) => era.from);
        expect(years, team.id).toEqual([...years].sort((a, b) => a - b));
        expect(new Set(years).size, team.id).toBe(years.length);
      }
    }
  });

  it("renames at least one team part-way through its life", () => {
    // Guards every assertion above: with one era each, all of them would pass
    // against a resolver that ignored the year completely.
    const renamed = teams.filter((team: Team) => team.identity.length > 1);
    expect(renamed.length).toBeGreaterThan(0);
    for (const team of renamed) {
      const names = team.identity.map((identity) => identity.name);
      expect(new Set(names).size, team.id).toBeGreaterThan(1);
    }
  });
});
