/** Small facts the UI shows that the engine does not model. */

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
