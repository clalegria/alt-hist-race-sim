import { peakWindow, ratingsForSeason } from "@alt-hist/engine";
import { describe, expect, it } from "vitest";
import {
  buildField,
  DEFAULT_RATING_MODE,
  type Driver,
  driverCareer,
  drivers,
  driversById,
  season1980,
  validateSeedData,
} from "./index.js";

const byId = driversById();

function driver(id: string): Driver {
  const found = byId.get(id);
  if (found === undefined) {
    throw new Error(`no driver "${id}" in the pool`);
  }
  return found;
}

describe("the authored careers", () => {
  it("gives every driver a plateau and an end", () => {
    for (const record of drivers) {
      expect(record.peakSeasons, record.id).toBeGreaterThanOrEqual(1);
      expect(record.finalSeason, record.id).toBeGreaterThanOrEqual(record.debutSeason);
      expect(record.peak.season, record.id).toBeGreaterThanOrEqual(record.debutSeason);
    }
  });

  it("puts Prost's plateau where the author said: 1984 to 1990", () => {
    expect(peakWindow(driverCareer(driver("prost")))).toEqual({ start: 1984, end: 1990 });
  });

  it("records the steep declines and off seasons that were authored", () => {
    expect(driver("rosberg").steepDecline?.season).toBe(1986);
    expect(driver("mansell").steepDecline?.season).toBe(1995);
    expect(driver("scheckter").steepDecline?.season).toBe(1980);
    expect(driver("prost").offSeasons?.map((off) => off.season)).toEqual([1989]);
    // Most drivers have neither, and the fields stay absent rather than null.
    expect(driver("jarier").steepDecline).toBeUndefined();
    expect(driver("jarier").offSeasons).toBeUndefined();
  });
});

describe("validating career shape", () => {
  const broken = (overrides: Partial<Driver>): Driver[] => [{ ...driver("prost"), ...overrides }];

  it("rejects a plateau that is not a whole season count of at least one", () => {
    for (const peakSeasons of [0, -2, 2.5]) {
      expect(() => {
        validateSeedData(broken({ peakSeasons }), undefined, { ...season1980, entries: [] });
      }, `${peakSeasons}`).toThrow("peakSeasons");
    }
  });

  it("rejects a driver who retires before they debut", () => {
    expect(() => {
      validateSeedData(broken({ finalSeason: 1979 }), undefined, { ...season1980, entries: [] });
    }).toThrow(/retires in 1979/);
  });

  it("rejects a driver who peaks before they debut", () => {
    expect(() => {
      validateSeedData(broken({ peak: { ...driver("prost").peak, season: 1975 } }), undefined, {
        ...season1980,
        entries: [],
      });
    }).toThrow(/peaks in 1975/);
  });

  it("rejects a career event severity outside 0-1", () => {
    for (const severity of [-0.1, 1.4]) {
      expect(() => {
        validateSeedData(broken({ steepDecline: { season: 1990, severity } }), undefined, {
          ...season1980,
          entries: [],
        });
      }, `${severity}`).toThrow("severity");
    }
  });

  it("accepts the seed data as authored", () => {
    expect(() => {
      validateSeedData();
    }).not.toThrow();
  });
});

describe("building a field", () => {
  it("defaults to peak, which is what the calibration was measured against", () => {
    expect(DEFAULT_RATING_MODE).toBe("peak");
    expect(buildField()).toEqual(buildField(season1980, drivers, "peak"));
  });

  it("feeds authored peaks in unchanged in peak mode", () => {
    const prost = buildField(season1980, drivers, "peak").find((e) => e.driverId === "prost");
    expect(prost?.driver.racing).toBe(driver("prost").peak.racing);
    expect(prost?.driver.composure).toBe(driver("prost").peak.composure);
  });

  it("ages a driver who has not peaked yet, and leaves one who has", () => {
    const aged = buildField(season1980, drivers, "aged");
    const find = (id: string) => aged.find((entrant) => entrant.driverId === id)?.driver;

    // Prost is a rookie in 1980 and peaks in 1987 — he must be well short.
    const prost = find("prost");
    expect(prost?.racing).toBeLessThan(driver("prost").peak.racing);
    expect(prost?.composure).toBeLessThan(driver("prost").peak.composure);

    // Jones peaks in 1980, so aged and peak agree for him. This is the check
    // that the curve is anchored to the authored peak rather than shifted.
    expect(find("jones")).toEqual(driverCareer(driver("jones")).peak);
  });

  it("puts a driver past his peak below it", () => {
    const aged = buildField(season1980, drivers, "aged");
    // Scheckter peaks in 1979 and was authored a steep decline in 1980, the
    // season he failed to qualify at Montreal.
    const scheckter = aged.find((entrant) => entrant.driverId === "scheckter")?.driver;
    expect(scheckter?.racing).toBeLessThan(driver("scheckter").peak.racing * 0.9);
  });

  it("agrees with the engine curve it delegates to", () => {
    // Not a re-implementation: the same call, so a change in either lands here.
    const aged = buildField(season1980, drivers, "aged");
    for (const entrant of aged) {
      expect(entrant.driver, entrant.driverId).toEqual(
        ratingsForSeason(driverCareer(driver(entrant.driverId)), 1980),
      );
    }
  });

  it("keeps every aged rating on the 1-100 scale", () => {
    for (const entrant of buildField(season1980, drivers, "aged")) {
      for (const [key, value] of Object.entries(entrant.driver)) {
        expect(value, `${entrant.driverId} ${key}`).toBeGreaterThanOrEqual(1);
        expect(value, `${entrant.driverId} ${key}`).toBeLessThanOrEqual(100);
      }
    }
  });

  it("fields the same 28 seats either way", () => {
    // The mode changes how good drivers are, never who is on the grid.
    const seats = (mode: "peak" | "aged"): string[] =>
      buildField(season1980, drivers, mode).map((entrant) => entrant.driverId);
    expect(seats("aged")).toEqual(seats("peak"));
    expect(seats("aged")).toHaveLength(28);
  });
});
