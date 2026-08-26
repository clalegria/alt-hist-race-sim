import type { Driver } from "@alt-hist/data";
import { describe, expect, it } from "vitest";
import {
  AGE_RANGE,
  ageInSeason,
  clampAge,
  DEFAULT_DRIVER_FILTERS,
  type DriverFilters,
  defaultDriverFilters,
  filterDrivers,
  matchesFilters,
  peakAge,
  ratedAge,
  withAge,
} from "./people.js";

describe("ageInSeason", () => {
  it("is the age reached during that season", () => {
    expect(ageInSeason(1980, 1946)).toBe(34);
    expect(ageInSeason(1980, 1955)).toBe(25);
  });
});

/**
 * Synthetic drivers, not authored ones: what a filter does is a rule, and a
 * test that reads a real career would fail the day the data is corrected.
 */
function driverOf(over: Partial<Driver> & Pick<Driver, "id">): Driver {
  return {
    name: over.id,
    nationality: "GB",
    birthYear: 1950,
    debutSeason: 1975,
    finalSeason: 1985,
    peak: {
      season: 1980,
      racing: 80,
      qualifying: 80,
      consistency: 80,
      adaptability: 80,
      composure: 80,
    },
    peakSeasons: 5,
    developmentSpeed: 5,
    declineSpeed: 5,
    ...over,
  };
}

/** Everything visible: the widest range, both career filters off. */
const SHOW_ALL: DriverFilters = {
  hideRetired: false,
  hideFuture: false,
  minAge: AGE_RANGE.min,
  maxAge: AGE_RANGE.max,
};

describe("the age range", () => {
  it("holds whole numbers inside its limits", () => {
    expect(clampAge(30)).toBe(30);
    expect(clampAge(AGE_RANGE.min - 5)).toBe(AGE_RANGE.min);
    expect(clampAge(AGE_RANGE.max + 5)).toBe(AGE_RANGE.max);
    expect(clampAge(30.6)).toBe(31);
    // An emptied number input reads back as NaN, which must not become the range.
    expect(clampAge(Number.NaN)).toBe(AGE_RANGE.min);
  });

  it("opens on a plausible racing age rather than the extremes", () => {
    expect(DEFAULT_DRIVER_FILTERS.minAge).toBeGreaterThan(AGE_RANGE.min);
    expect(DEFAULT_DRIVER_FILTERS.maxAge).toBeLessThan(AGE_RANGE.max);
    expect(DEFAULT_DRIVER_FILTERS.minAge).toBeLessThan(DEFAULT_DRIVER_FILTERS.maxAge);
  });

  it("opens on the year as it was, with both career filters on", () => {
    expect(DEFAULT_DRIVER_FILTERS.hideRetired).toBe(true);
    expect(DEFAULT_DRIVER_FILTERS.hideFuture).toBe(true);
  });

  it("pushes the far end out of the way rather than crossing", () => {
    // Two inputs that can cross would let a reader ask for 50 to 20 and get an
    // empty list with nothing on screen saying why.
    const raised = withAge(DEFAULT_DRIVER_FILTERS, "min", 50);
    expect(raised.minAge).toBe(50);
    expect(raised.maxAge).toBe(50);

    // Below the range's own start, so the two really would cross.
    const lowered = withAge(DEFAULT_DRIVER_FILTERS, "max", 17);
    expect(lowered.maxAge).toBe(17);
    expect(lowered.minAge).toBe(17);
  });

  it("leaves the far end alone when the two do not cross", () => {
    const narrowed = withAge(DEFAULT_DRIVER_FILTERS, "min", 25);
    expect(narrowed.minAge).toBe(25);
    expect(narrowed.maxAge).toBe(DEFAULT_DRIVER_FILTERS.maxAge);
  });

  it("clamps whichever end is being moved", () => {
    expect(withAge(SHOW_ALL, "max", 999).maxAge).toBe(AGE_RANGE.max);
    expect(withAge(SHOW_ALL, "min", -10).minAge).toBe(AGE_RANGE.min);
  });
});

describe("who survives the filters", () => {
  const veteran = driverOf({ id: "veteran", birthYear: 1930, finalSeason: 1975 });
  const rookie = driverOf({ id: "rookie", birthYear: 1960, debutSeason: 1985 });
  const current = driverOf({ id: "current", birthYear: 1950 });

  it("keeps everyone when nothing is asked of it", () => {
    const all = [veteran, rookie, current];
    expect(filterDrivers(all, 1980, SHOW_ALL).map((driver) => driver.id)).toEqual([
      "veteran",
      "rookie",
      "current",
    ]);
  });

  it("hides a career that had already ended, and only when asked", () => {
    expect(matchesFilters(veteran, 1980, SHOW_ALL)).toBe(true);
    expect(matchesFilters(veteran, 1980, { ...SHOW_ALL, hideRetired: true })).toBe(false);
    // Their final season itself still counts as racing it.
    expect(matchesFilters(veteran, 1975, { ...SHOW_ALL, hideRetired: true })).toBe(true);
  });

  it("hides a career that had not begun, and only when asked", () => {
    expect(matchesFilters(rookie, 1980, SHOW_ALL)).toBe(true);
    expect(matchesFilters(rookie, 1980, { ...SHOW_ALL, hideFuture: true })).toBe(false);
    // Their debut season itself counts.
    expect(matchesFilters(rookie, 1985, { ...SHOW_ALL, hideFuture: true })).toBe(true);
  });

  it("holds the age range at both ends, inclusively", () => {
    const range = { ...SHOW_ALL, minAge: 25, maxAge: 30 };
    const at = (age: number) =>
      matchesFilters(driverOf({ id: "x", birthYear: 1980 - age }), 1980, range);
    expect(at(24)).toBe(false);
    expect(at(25)).toBe(true);
    expect(at(30)).toBe(true);
    expect(at(31)).toBe(false);
  });

  it("reads the age against the season on screen, not a fixed year", () => {
    const range = { ...SHOW_ALL, minAge: 30, maxAge: 30 };
    expect(matchesFilters(current, 1980, range)).toBe(true);
    expect(matchesFilters(current, 1981, range)).toBe(false);
  });

  it("never hides anyone exempted, however narrow the filters", () => {
    // The dead end this closes: dropping a 43-year-old from the grid while the
    // range ends at 42 would put them beyond reach of the list that puts them
    // back.
    const nobody = { hideRetired: true, hideFuture: true, minAge: 20, maxAge: 20 };
    const all = [veteran, rookie, current];
    expect(filterDrivers(all, 1980, nobody)).toHaveLength(0);
    expect(
      filterDrivers(all, 1980, nobody, new Set(["veteran"])).map((driver) => driver.id),
    ).toEqual(["veteran"]);
  });
});

describe("the age that goes with the ratings", () => {
  // Born 1950, at his best in 1980: 30 at his peak, and 51 in a 2001 season he
  // is being cast into.
  const driver = driverOf({ id: "veteran" });

  it("is the peak age at peak, whatever season is loaded", () => {
    expect(peakAge(driver)).toBe(30);
    expect(ratedAge(driver, 2001, "peak")).toBe(30);
    expect(ratedAge(driver, 1955, "peak")).toBe(30);
  });

  it("is the season age when the ratings are the season's", () => {
    expect(ratedAge(driver, 2001, "aged")).toBe(51);
    expect(ratedAge(driver, 1980, "aged")).toBe(30);
  });
});

describe("the age filter under peak ratings", () => {
  // A driver whose whole career is somewhere else: born 1990, at his best in
  // 2015. In a 1980 season he is not born, and no age range can reach him on
  // the season scale — the whole point of reading peak age instead.
  const modern = driverOf({
    id: "modern",
    birthYear: 1990,
    debutSeason: 2012,
    finalSeason: 2020,
    peak: { ...driverOf({ id: "x" }).peak, season: 2015 },
  });

  it("reaches a driver from another era, which the season scale cannot", () => {
    expect(ratedAge(modern, 1980, "peak")).toBe(25);
    expect(matchesFilters(modern, 1980, SHOW_ALL, "peak")).toBe(true);
    // The same driver, the same widest range, read against 1980: unreachable.
    expect(matchesFilters(modern, 1980, SHOW_ALL, "aged")).toBe(false);
  });

  it("still bites — it is a filter, not a way of switching filtering off", () => {
    const band = { ...SHOW_ALL, minAge: 30, maxAge: 40 };
    expect(matchesFilters(modern, 1980, band, "peak")).toBe(false);
  });

  it("narrows the same list the same way", () => {
    const pool = [modern, driverOf({ id: "veteran" })];
    expect(filterDrivers(pool, 1980, SHOW_ALL, new Set(), "peak").map((d) => d.id)).toEqual([
      "modern",
      "veteran",
    ]);
    expect(filterDrivers(pool, 1980, SHOW_ALL, new Set(), "aged").map((d) => d.id)).toEqual([
      "veteran",
    ]);
  });

  it("reads the season age unless told otherwise", () => {
    // The default is the historical reading, so a caller that forgets the mode
    // gets the behaviour the app had before peak ages existed.
    expect(matchesFilters(modern, 1980, SHOW_ALL)).toBe(
      matchesFilters(modern, 1980, SHOW_ALL, "aged"),
    );
  });
});

describe("what the filters open on", () => {
  it("keeps the career filters for a season played at its own ratings", () => {
    expect(defaultDriverFilters("aged")).toEqual(DEFAULT_DRIVER_FILTERS);
  });

  it("drops them under peak ratings, so a field of the best ever is reachable", () => {
    const opened = defaultDriverFilters("peak");
    expect(opened.hideRetired).toBe(false);
    expect(opened.hideFuture).toBe(false);
    // The age range is untouched: it is the one filter that still means
    // something, and it now means peak age.
    expect(opened.minAge).toBe(DEFAULT_DRIVER_FILTERS.minAge);
    expect(opened.maxAge).toBe(DEFAULT_DRIVER_FILTERS.maxAge);
  });
});
