/**
 * Ages, and how a list of drivers is narrowed.
 *
 * Small facts *about* a driver that the engine does not model: what age the
 * ratings on screen belong to, and which drivers a reader has asked to see.
 * Nothing here is a rating and nothing here reaches the simulation — a filtered
 * driver is hidden from a list, not barred from a seat.
 *
 * It lived in `apps/web/src/lib/people.ts` while the only thing that narrowed a
 * list was a list. `arrange.ts` changed that: the grid's bulk rules draw on
 * "the drivers without a drive, as the reader has filtered them", so the
 * *filter* is now an input to a rule that a season is run on, and it has to be
 * readable by the package that owns the rule. Two copies of `matchesFilters`
 * would be two answers to which drivers someone is playing with.
 *
 * The same move `rating.ts` made, and for the same reason — and like that one,
 * `apps/web/src/lib/people.ts` re-exports it, so the app still reads as though
 * it owns its own idea of a driver's age.
 */

import type { RatingMode } from "./buildField.js";
import type { Driver } from "./types.js";

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
 * The age a driver was in the season they were at their best.
 *
 * Authored, not derived from form: `peak.season` is the year the ratings in the
 * seed file describe, so this is the age those ratings belong to.
 */
export function peakAge(driver: Driver): number {
  return ageInSeason(driver.peak.season, driver.birthYear);
}

/**
 * The age that goes with the ratings on screen.
 *
 * The two rating modes are two different claims, and the age has to make the
 * same one. In `aged` the grid shows what a driver was worth *that year*, so the
 * age is the age they were that year. In `peak` it shows what they were worth at
 * their best, wherever in history that fell — a 1980 grid can carry Fangio's
 * 1954 ratings — and printing "1980 minus his birth year" beside those numbers
 * describes nobody: not the ratings, which are a 43-year-old's, and not the
 * season, which he did not race.
 *
 * It is also what makes the pool filters usable in `peak` mode. Filtering the
 * pool on an age nothing on screen shows is what kept a dream field of the best
 * drivers ever out of reach: every one of them was a child or a pensioner in
 * whatever year was loaded, so the age range hid them however the ratings read.
 * Against peak age, every driver in the pool sits inside a plausible racing
 * range, and opening the range fully reaches all of them.
 */
export function ratedAge(driver: Driver, seasonYear: number, mode: RatingMode): number {
  return mode === "peak" ? peakAge(driver) : ageInSeason(seasonYear, driver.birthYear);
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

/**
 * What the list opens on for a given rating mode.
 *
 * The age range is the same either way — it reads whichever age the mode shows,
 * and 18 to 42 is a racing age on both scales. The two career filters are not:
 * in `peak` mode they open *off*, because a grid built from authored peaks is
 * already out of time, and hiding everyone whose career missed the loaded year
 * is the app enforcing a chronology the mode has explicitly set aside. They stay
 * on the panel and still work — a reader who wants "the drivers of 1980, at
 * their best" is one click from it — but the field of the best drivers ever is
 * the thing `peak` is for, and it should not open three clicks away from itself.
 */
export function defaultDriverFilters(mode: RatingMode): DriverFilters {
  return mode === "peak"
    ? { ...DEFAULT_DRIVER_FILTERS, hideRetired: false, hideFuture: false }
    : DEFAULT_DRIVER_FILTERS;
}

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
  /** Which age the range is read against. See `ratedAge`. */
  mode: RatingMode = "aged",
): boolean {
  if (filters.hideRetired && driver.finalSeason < seasonYear) {
    return false;
  }
  if (filters.hideFuture && driver.debutSeason > seasonYear) {
    return false;
  }
  const age = ratedAge(driver, seasonYear, mode);
  return age >= filters.minAge && age <= filters.maxAge;
}

/**
 * The drivers a narrowed list shows, in the order they came in.
 *
 * `keep` is never filtered out, whatever the settings say. It holds whoever is
 * currently selected, and only them: a driver being held has to stay on screen
 * to be put down again. Losing a seat is not itself an exemption — a driver
 * swapped out of the grid rejoins the pool on the same terms as everyone else,
 * and is reached the same way, by widening the filters.
 */
export function filterDrivers(
  drivers: readonly Driver[],
  seasonYear: number,
  filters: DriverFilters,
  keep: ReadonlySet<string> = new Set(),
  mode: RatingMode = "aged",
): readonly Driver[] {
  return drivers.filter(
    (driver) => keep.has(driver.id) || matchesFilters(driver, seasonYear, filters, mode),
  );
}
