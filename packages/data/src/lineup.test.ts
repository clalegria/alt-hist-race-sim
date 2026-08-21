import { describe, expect, it } from "vitest";
import { buildField } from "./buildField.js";
import { drivers, season1980 } from "./index.js";
import {
  applyLineup,
  authoredLineup,
  isAuthoredLineup,
  lineupChanges,
  reserveDrivers,
  type SeasonLineup,
  seatedDriverIds,
  seatOf,
  swapDrivers,
} from "./lineup.js";

const authored = authoredLineup(season1980);

describe("the authored lineup", () => {
  it("has a seat for every driver the season enters", () => {
    expect(seatedDriverIds(authored)).toHaveLength(28);
    expect(Object.keys(authored)).toHaveLength(season1980.entries.length);
  });

  it("says who drives for whom", () => {
    expect(seatOf(authored, "jones")).toBe("williams");
    expect(seatOf(authored, "villeneuve_g")).toBe("ferrari");
  });

  it("says nothing about a driver without a drive", () => {
    expect(seatOf(authored, "prost")).toBe("mclaren");
    expect(seatOf(authored, "mansell")).toBeNull();
  });

  it("leaves the rest of the pool in reserve, alphabetically", () => {
    const reserve = reserveDrivers(authored);
    expect(reserve).toHaveLength(drivers.length - 28);
    expect(reserve.map((driver) => driver.id)).not.toContain("jones");
    const names = reserve.map((driver) => driver.name);
    expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names);
  });

  it("is recognised as unedited", () => {
    expect(isAuthoredLineup(season1980, authored)).toBe(true);
  });
});

describe("swapping drivers", () => {
  it("puts a reserve driver into a seat and drops the incumbent out", () => {
    const swapped = swapDrivers(authored, "jones", "mansell");
    expect(seatOf(swapped, "mansell")).toBe("williams");
    expect(seatOf(swapped, "jones")).toBeNull();
    expect(reserveDrivers(swapped).map((driver) => driver.id)).toContain("jones");
  });

  it("exchanges two drivers who both hold seats", () => {
    const swapped = swapDrivers(authored, "jones", "villeneuve_g");
    expect(seatOf(swapped, "villeneuve_g")).toBe("williams");
    expect(seatOf(swapped, "jones")).toBe("ferrari");
  });

  it("never changes the size of the field or of a team", () => {
    // The whole constraint, stated as a property: swaps only, so nobody gains a
    // third car and no seat is left empty.
    let lineup: SeasonLineup = authored;
    for (const [a, b] of [
      ["jones", "mansell"],
      ["villeneuve_g", "jones"],
      ["reutemann", "decesaris"],
      ["decesaris", "villeneuve_g"],
    ] as const) {
      lineup = swapDrivers(lineup, a, b);
      expect(seatedDriverIds(lineup)).toHaveLength(28);
      expect(new Set(seatedDriverIds(lineup)).size).toBe(28);
      for (const entry of season1980.entries) {
        expect(lineup[entry.teamId], entry.teamId).toHaveLength(entry.drivers.length);
      }
    }
  });

  it("keeps the teams and their seat order otherwise untouched", () => {
    const swapped = swapDrivers(authored, "jones", "mansell");
    expect(Object.keys(swapped)).toEqual(Object.keys(authored));
    expect(swapped.ferrari).toEqual(authored.ferrari);
  });

  it("treats swapping a driver with themselves as nothing at all", () => {
    expect(swapDrivers(authored, "jones", "jones")).toBe(authored);
  });

  it("refuses to swap two drivers who are both out of the grid", () => {
    // There is no seat involved, so there is no swap — and silently doing
    // nothing would look to a caller like it had worked.
    expect(() => swapDrivers(authored, "mansell", "decesaris")).toThrow("nothing to swap");
  });

  it("undoes itself", () => {
    const there = swapDrivers(authored, "jones", "mansell");
    expect(isAuthoredLineup(season1980, swapDrivers(there, "jones", "mansell"))).toBe(true);
    expect(isAuthoredLineup(season1980, there)).toBe(false);
  });
});

describe("applying a lineup to a season", () => {
  it("hands back the same entries when nothing was changed", () => {
    expect(applyLineup(season1980, authored)).toEqual(season1980);
  });

  it("re-seats the driver in the team's own car", () => {
    const season = applyLineup(season1980, swapDrivers(authored, "jones", "mansell"));
    const williams = season.entries.find((entry) => entry.teamId === "williams");
    const original = season1980.entries.find((entry) => entry.teamId === "williams");
    expect(williams?.drivers).toContain("mansell");
    expect(williams?.car).toEqual(original?.car);
  });

  it("builds a field the engine can race", () => {
    const season = applyLineup(season1980, swapDrivers(authored, "jones", "mansell"));
    const field = buildField(season);
    expect(field).toHaveLength(28);
    const mansell = field.find((entrant) => entrant.driverId === "mansell");
    expect(mansell?.teamId).toBe("williams");
    expect(mansell?.driver.racing).toBeGreaterThan(0);
  });

  it("rejects a team that gained a car", () => {
    const overloaded = { ...authored, williams: ["jones", "reutemann", "mansell"] };
    expect(() => applyLineup(season1980, overloaded)).toThrow("3 drivers");
  });

  it("rejects a team that lost one", () => {
    const short = { ...authored, williams: ["jones"] };
    expect(() => applyLineup(season1980, short)).toThrow("2 cars");
  });

  it("rejects a driver seated twice", () => {
    const cloned = { ...authored, ferrari: ["jones", "villeneuve_g"] };
    expect(() => applyLineup(season1980, cloned)).toThrow("both");
  });

  it("rejects a team that is missing, or one that never entered", () => {
    const { williams: _removed, ...missing } = authored;
    expect(() => applyLineup(season1980, missing)).toThrow("missing a seat allocation");
    expect(() => applyLineup(season1980, { ...authored, ferrari2: [] })).toThrow("does not enter");
  });
});

describe("reporting what was changed", () => {
  it("reports nothing for the authored grid", () => {
    expect(lineupChanges(season1980, authored)).toEqual([]);
  });

  it("names who arrived and who left, at the team it happened to", () => {
    const changes = lineupChanges(season1980, swapDrivers(authored, "jones", "mansell"));
    expect(changes).toEqual([{ teamId: "williams", in: ["mansell"], out: ["jones"] }]);
  });

  it("reports both ends of a swap between two teams", () => {
    const changes = lineupChanges(season1980, swapDrivers(authored, "jones", "villeneuve_g"));
    expect(changes).toHaveLength(2);
    expect(changes.map((change) => change.teamId).sort()).toEqual(["ferrari", "williams"]);
  });

  it("pairs arrivals with departures one for one", () => {
    // Guaranteed by seat counts being preserved, and relied on by the UI, which
    // prints "X for Y" rather than two unrelated lists.
    let lineup = swapDrivers(authored, "jones", "mansell");
    lineup = swapDrivers(lineup, "reutemann", "decesaris");
    lineup = swapDrivers(lineup, "villeneuve_g", "thackwell");
    for (const change of lineupChanges(season1980, lineup)) {
      expect(change.in.length, change.teamId).toBe(change.out.length);
    }
  });

  it("says nothing about a team whose drivers merely traded seats", () => {
    const [first, second] = season1980.entries[0]?.drivers ?? [];
    if (first === undefined || second === undefined) {
      throw new Error("expected a two-car team first on the entry list");
    }
    const reordered = swapDrivers(authored, first, second);
    expect(lineupChanges(season1980, reordered)).toEqual([]);
  });
});
