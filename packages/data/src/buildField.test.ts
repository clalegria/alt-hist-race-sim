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

/**
 * The first driver in the pool matching a condition.
 *
 * Every test below that needs "a driver who has not peaked yet" or "one with a
 * steep decline" goes through this rather than naming one: the authored careers
 * are tuned continuously, and a test pinned to Prost's 1987 peak fails the day
 * that number moves. See the testing rule in `CLAUDE.md`.
 */
function someDriver(matches: (record: Driver) => boolean, what: string): Driver {
  const found = drivers.find(matches);
  if (found === undefined) {
    throw new Error(`the pool has no ${what}`);
  }
  return found;
}

const SEASON = season1980.year;

describe("the authored careers", () => {
  it("gives every driver a plateau and an end", () => {
    for (const record of drivers) {
      expect(record.peakSeasons, record.id).toBeGreaterThanOrEqual(1);
      expect(record.finalSeason, record.id).toBeGreaterThanOrEqual(record.debutSeason);
      expect(record.peak.season, record.id).toBeGreaterThanOrEqual(record.debutSeason);
    }
  });

  it("centres every plateau on the authored peak, spanning the authored length", () => {
    // The relationship, not the values: whatever a career is retuned to, its
    // window must still be `peakSeasons` long and sit around `peak.season`.
    for (const record of drivers) {
      const window = peakWindow(driverCareer(record));
      expect(window.end - window.start + 1, record.id).toBe(record.peakSeasons);
      expect(window.start, record.id).toBeLessThanOrEqual(record.peak.season);
      expect(window.end, record.id).toBeGreaterThanOrEqual(record.peak.season);
    }
  });

  it("carries authored career events through to the engine's career shape", () => {
    const declining = someDriver(
      (record) => record.steepDecline !== undefined,
      "driver with a steep decline",
    );
    expect(driverCareer(declining).steepDecline).toEqual(declining.steepDecline);

    const dipped = someDriver(
      (record) => record.offSeasons !== undefined,
      "driver with an off season",
    );
    expect(driverCareer(dipped).offSeasons).toEqual(dipped.offSeasons);

    // A driver with neither keeps the fields absent rather than null, which is
    // what the engine's optional handling is written against.
    const steady = someDriver(
      (record) => record.steepDecline === undefined && record.offSeasons === undefined,
      "driver with an uneventful career",
    );
    expect(driverCareer(steady).steepDecline).toBeUndefined();
    expect(driverCareer(steady).offSeasons).toBeUndefined();
  });
});

describe("validating career shape", () => {
  const base = drivers[0];
  if (base === undefined) {
    throw new Error("the pool is empty");
  }
  const broken = (overrides: Partial<Driver>): Driver[] => [{ ...base, ...overrides }];

  it("rejects a plateau that is not a whole season count of at least one", () => {
    for (const peakSeasons of [0, -2, 2.5]) {
      expect(() => {
        validateSeedData(broken({ peakSeasons }), undefined, { ...season1980, entries: [] });
      }, `${peakSeasons}`).toThrow("peakSeasons");
    }
  });

  it("rejects a driver who retires before they debut", () => {
    const before = base.debutSeason - 1;
    expect(() => {
      validateSeedData(broken({ finalSeason: before }), undefined, { ...season1980, entries: [] });
    }).toThrow(`retires in ${before}`);
  });

  it("rejects a driver who peaks before they debut", () => {
    const before = base.debutSeason - 1;
    expect(() => {
      validateSeedData(broken({ peak: { ...base.peak, season: before } }), undefined, {
        ...season1980,
        entries: [],
      });
    }).toThrow(`peaks in ${before}`);
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
    // Every seat, so it cannot pass by finding one driver who happens to agree.
    for (const entrant of buildField(season1980, drivers, "peak")) {
      expect(entrant.driver, entrant.driverId).toEqual(driverCareer(driver(entrant.driverId)).peak);
    }
  });

  it("puts a driver at exactly their peak in their peak season", () => {
    // The anchor: whatever the curve does either side, the season the author
    // named is the one where the authored numbers come out unchanged.
    //
    // Two exclusions, both real curve behaviour rather than tolerances. An
    // authored setback is allowed to bite in the peak season itself; and a
    // driver whose peak season *is* their debut season still pays the rookie
    // penalty, because the curve never rewards a driver for not having started
    // yet.
    let checked = 0;
    for (const record of drivers) {
      if (
        record.steepDecline !== undefined ||
        record.offSeasons !== undefined ||
        record.peak.season <= record.debutSeason
      ) {
        continue;
      }
      const career = driverCareer(record);
      expect(ratingsForSeason(career, record.peak.season), record.id).toEqual(career.peak);
      checked += 1;
    }
    expect(checked, "no driver in the pool peaks clear of a setback").toBeGreaterThan(0);
  });

  it("never rates an aged driver above their peak, and cuts those past the plateau", () => {
    const aged = buildField(season1980, drivers, "aged");
    expect(aged.length).toBeGreaterThan(0);

    for (const entrant of aged) {
      const career = driverCareer(driver(entrant.driverId));
      const window = peakWindow(career);
      for (const [key, value] of Object.entries(entrant.driver)) {
        const at = career.peak[key as keyof typeof career.peak];
        expect(value, `${entrant.driverId} ${key}`).toBeLessThanOrEqual(at);
      }
      if (SEASON < window.start || SEASON > window.end) {
        // Still climbing, or falling away: either way short of the peak.
        expect(entrant.driver.racing, entrant.driverId).toBeLessThan(career.peak.racing);
      }
    }
  });

  it("agrees with the engine curve it delegates to", () => {
    // Not a re-implementation: the same call, so a change in either lands here.
    const aged = buildField(season1980, drivers, "aged");
    for (const entrant of aged) {
      expect(entrant.driver, entrant.driverId).toEqual(
        ratingsForSeason(driverCareer(driver(entrant.driverId)), SEASON),
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

  it("fields the same seats either way", () => {
    // The mode changes how good drivers are, never who is on the grid.
    const seats = (mode: "peak" | "aged"): string[] =>
      buildField(season1980, drivers, mode).map((entrant) => entrant.driverId);
    expect(seats("aged")).toEqual(seats("peak"));
    expect(seats("aged")).toHaveLength(season1980.entries.flatMap((e) => e.drivers).length);
  });
});
