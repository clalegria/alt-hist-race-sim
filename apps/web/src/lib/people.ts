/** Small facts the UI shows that the engine does not model. */

import type { Driver } from "@alt-hist/data";

/**
 * Age during a season.
 *
 * The seed data holds birth *years*, not dates, so this is the age a driver
 * turns that year and can be a year out mid-season. Precise enough for a grid
 * listing, and the reason nothing in the sim keys off it.
 */
export function ageInSeason(seasonYear: number, birthYear: number): number {
  return seasonYear - birthYear;
}

/**
 * How the list of drivers without a drive is narrowed.
 *
 * Plain data, held above the list and passed down, so every state it can be in
 * renders on its own — the same reason the lineup draft lives in `GridStage`
 * rather than in the components that draw it.
 *
 * All three read facts the seed data already carries: `finalSeason`,
 * `debutSeason` and `birthYear`. Nothing here is a rating and nothing here
 * reaches the simulation — a filtered driver is hidden from a list, not barred
 * from a seat, and a reader who puts Alboreto in a 1980 car still gets a season
 * run on it.
 */
export interface DriverFilters {
  /** Hide anyone whose real career had already ended before this season. */
  readonly hideRetired: boolean;
  /** Hide anyone whose real career had not yet begun. */
  readonly hideFuture: boolean;
  readonly minAge: number;
  readonly maxAge: number;
}

/**
 * The widest the age range opens.
 *
 * Not a claim about who can drive a car — the extremes are there so the reader
 * can always get back to "everyone" — which is why they sit well outside any
 * age a real grid has seen.
 */
export const AGE_RANGE = { min: 16, max: 56 } as const;

/**
 * What the list opens on: the drivers who were actually around that year, at a
 * plausible racing age.
 *
 * All three narrow by default, because a pool spanning 1950 to 2026 is mostly
 * people who were children, pensioners, or not yet born in whatever year is on
 * screen, and a list of them is a list nobody can use. Casting a driver in a car
 * they never raced is still the premise of the app — the filters are three
 * clicks from off, and nothing they hide is barred from a seat.
 */
export const DEFAULT_DRIVER_FILTERS: DriverFilters = {
  hideRetired: true,
  hideFuture: true,
  minAge: 18,
  maxAge: 42,
};

/** An age the range can actually hold: a whole number, inside the limits. */
export function clampAge(value: number): number {
  if (!Number.isFinite(value)) {
    return AGE_RANGE.min;
  }
  return Math.min(AGE_RANGE.max, Math.max(AGE_RANGE.min, Math.round(value)));
}

/**
 * Moves one end of the age range, pushing the other out of the way if it has
 * to.
 *
 * Two inputs that can cross would let a reader ask for ages 50 to 20 and get an
 * empty list with nothing on screen explaining why. Shoving the far end is the
 * behaviour that cannot produce that.
 */
export function withAge(filters: DriverFilters, end: "min" | "max", value: number): DriverFilters {
  const age = clampAge(value);
  return end === "min"
    ? { ...filters, minAge: age, maxAge: Math.max(age, filters.maxAge) }
    : { ...filters, maxAge: age, minAge: Math.min(age, filters.minAge) };
}

/** Whether one driver survives the filters, ignoring who is exempt. */
export function matchesFilters(
  driver: Driver,
  seasonYear: number,
  filters: DriverFilters,
): boolean {
  if (filters.hideRetired && driver.finalSeason < seasonYear) {
    return false;
  }
  if (filters.hideFuture && driver.debutSeason > seasonYear) {
    return false;
  }
  const age = ageInSeason(seasonYear, driver.birthYear);
  return age >= filters.minAge && age <= filters.maxAge;
}

/**
 * The drivers a narrowed list shows, in the order they came in.
 *
 * `keep` is never filtered out, whatever the settings say. It holds everyone
 * the season actually entered plus whoever is currently selected, and it exists
 * to close a dead end: without it, dropping a 43-year-old from the grid while
 * the range ends at 42 would make them vanish from the pool with no way back
 * short of restoring the whole grid.
 */
export function filterDrivers(
  drivers: readonly Driver[],
  seasonYear: number,
  filters: DriverFilters,
  keep: ReadonlySet<string> = new Set(),
): readonly Driver[] {
  return drivers.filter(
    (driver) => keep.has(driver.id) || matchesFilters(driver, seasonYear, filters),
  );
}
