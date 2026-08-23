/**
 * Turns the authored seed into a race field.
 *
 * This is the seam between authored data and the engine's runtime model, and it
 * belongs here rather than in either: the engine may not read data, and every
 * consumer that wants to run a race needs exactly this mapping. The dependency
 * on `@alt-hist/engine` is type-only for the types and a plain function call for
 * the ageing curve — no runtime edge exists in the other direction.
 *
 * Two rating modes, and the choice belongs to whoever is running the season:
 *
 * - **`peak`** feeds every driver's authored peak ratings in, whatever season it
 *   is. A 1980 grid of drivers at the best they ever were. This is the original
 *   behaviour and stays the default, because the 1980 calibration was measured
 *   against it.
 * - **`aged`** runs each driver's career through the engine's ageing curve and
 *   uses the ratings they held *in that season*. 1980 Prost is a rookie again.
 *
 * Each entrant also carries the driver's nationality and the team's base, which
 * is how the engine knows who is racing at home without ever reading this data.
 */

import { type DriverCareer, type RaceEntrant, ratingsForSeason } from "@alt-hist/engine";
import { drivers as driverPool, teams as teamPool } from "./index.js";
import type { Driver, SeasonSeed, Team } from "./types.js";

/** Whether a field is built from authored peaks or from age-adjusted ratings. */
export type RatingMode = "peak" | "aged";

export const RATING_MODES: readonly RatingMode[] = ["peak", "aged"];

/** The default, and the mode the calibration figures describe. */
export const DEFAULT_RATING_MODE: RatingMode = "peak";

/**
 * The authored career in the shape the engine's curve wants.
 *
 * Exported because the progression tool reports on drivers who hold no seat in
 * any season, so it cannot go through `buildField` to reach one.
 */
export function driverCareer(driver: Driver): DriverCareer {
  return {
    debutSeason: driver.debutSeason,
    peakSeason: driver.peak.season,
    peakSeasons: driver.peakSeasons,
    developmentSpeed: driver.developmentSpeed,
    declineSpeed: driver.declineSpeed,
    peak: {
      racing: driver.peak.racing,
      qualifying: driver.peak.qualifying,
      consistency: driver.peak.consistency,
      adaptability: driver.peak.adaptability,
      composure: driver.peak.composure,
    },
    ...(driver.steepDecline === undefined ? {} : { steepDecline: driver.steepDecline }),
    ...(driver.offSeasons === undefined ? {} : { offSeasons: driver.offSeasons }),
  };
}

/** A driver's ratings for a season under the given mode. */
export function driverRatingsFor(driver: Driver, season: number, mode: RatingMode) {
  return mode === "peak"
    ? driverCareer(driver).peak
    : ratingsForSeason(driverCareer(driver), season);
}

/**
 * The season is required rather than defaulted: a field built from whichever
 * year happened to be the default is the bug this seam exists to prevent, and
 * every caller knows which season it is running.
 */
export function buildField(
  season: SeasonSeed,
  pool: readonly Driver[] = driverPool,
  mode: RatingMode = DEFAULT_RATING_MODE,
  teams: readonly Team[] = teamPool,
): RaceEntrant[] {
  const byId = new Map(pool.map((driver) => [driver.id, driver]));
  // Where each team is based, for the engine's home-advantage term. A team the
  // pool does not know still races — it simply never races at home, which is
  // the same thing the engine does with a missing code.
  const baseOf = new Map(teams.map((team) => [team.id, team.base]));
  const field: RaceEntrant[] = [];

  for (const entry of season.entries) {
    for (const driverId of entry.drivers) {
      const driver = byId.get(driverId);
      if (driver === undefined) {
        throw new Error(`Season entry "${entry.teamId}" references unknown driver "${driverId}"`);
      }

      const base = baseOf.get(entry.teamId);
      field.push({
        driverId,
        teamId: entry.teamId,
        driver: driverRatingsFor(driver, season.year, mode),
        car: entry.car,
        driverCountry: driver.nationality,
        ...(base === undefined ? {} : { teamCountry: base }),
      });
    }
  }

  return field;
}
