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
 * - **`aged`**, the default, runs each driver's career through the engine's
 *   ageing curve and uses the ratings they held *in that season*. 1980 Prost is
 *   a rookie again.
 * - **`peak`** feeds every driver's authored peak ratings in, whatever season it
 *   is: a 1980 grid of drivers at the best they ever were. A what-if, chosen on
 *   purpose.
 *
 * Each entrant also carries the driver's nationality, the team's base and the
 * engine manufacturer's, which is how the engine knows who is racing at home
 * without ever reading this data — all three stack.
 *
 * It carries the team's engine too, looked up in the season's own engine table.
 * The blend with the chassis is not done here: `powertrain()` in the engine
 * package owns it, so the number the race is run on and the number the grid page
 * shows come from one place. An entry naming an engine the season does not rate
 * gets none — `validateSeedData` rejects that, and a field is not the place to
 * discover it.
 */

import { type DriverCareer, type RaceEntrant, ratingsForSeason } from "@alt-hist/engine";
import { teamIdentityIn } from "./eras.js";
import { identityYear } from "./identity.js";
import { drivers as driverPool, engines as enginePool, teams as teamPool } from "./index.js";
import type { Driver, EngineManufacturer, SeasonSeed, Team } from "./types.js";

/** Whether a field is built from authored peaks or from age-adjusted ratings. */
export type RatingMode = "peak" | "aged";

export const RATING_MODES: readonly RatingMode[] = ["peak", "aged"];

/** The default: each driver's ability in the season, via the ageing curve. */
export const DEFAULT_RATING_MODE: RatingMode = "aged";

/**
 * The authored career in the shape the engine's curve wants.
 *
 * Exported because the progression tool reports on drivers who hold no seat in
 * any season, so it cannot go through `buildField` to reach one.
 */
export function driverCareer(driver: Driver): DriverCareer {
  return {
    birthYear: driver.birthYear,
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
      wetWeather: driver.peak.wetWeather,
    },
    ...(driver.stepDown === undefined ? {} : { stepDown: driver.stepDown }),
    ...(driver.offSeasons === undefined ? {} : { offSeasons: driver.offSeasons }),
  };
}

/**
 * The driver with no career events: no `stepDown`, no `offSeasons`, so the
 * ageing curve runs plain. What the era's *Driver career events: No* races on.
 */
export function withoutCareerEvents(driver: Driver): Driver {
  const { stepDown: _stepDown, offSeasons: _offSeasons, ...career } = driver;
  return career;
}

let eventFree: readonly Driver[] | null = null;

/**
 * The whole pool without career events, built once so every call hands back
 * the same array — every function here that reads ratings takes a pool. Built
 * on first call rather than at import, because this module and `index.ts`
 * import each other and the pool may not exist yet while this one loads.
 */
export function driversWithoutCareerEvents(): readonly Driver[] {
  eventFree ??= driverPool.map(withoutCareerEvents);
  return eventFree;
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
 *
 * `keptFrom` is an era's *Team name changes: No* (`identity.ts`): each
 * team is based where it was in its first season of the run, since the base
 * moves with the name.
 */
export function buildField(
  season: SeasonSeed,
  pool: readonly Driver[] = driverPool,
  mode: RatingMode = DEFAULT_RATING_MODE,
  teams: readonly Team[] = teamPool,
  makers: readonly EngineManufacturer[] = enginePool,
  keptFrom: number | null = null,
): RaceEntrant[] {
  const byId = new Map(pool.map((driver) => [driver.id, driver]));
  // Where each team is based, for the engine's home-advantage term. Read for
  // the season being built, because a base moves with a rename — the team that
  // was Toleman is registered in France as Alpine — and racing at home is a
  // fact about the year, not about the lineage — unless the run keeps each
  // team's first name, and with it the base. A team the pool does not know
  // still races; it simply never races at home, which is the same thing the
  // engine does with a missing code.
  const baseOf = new Map(
    teams.map((team) => [
      team.id,
      teamIdentityIn(team, identityYear(team.id, season.year, keptFrom)).base,
    ]),
  );
  const engineOf = new Map(season.engines.map((engine) => [engine.engineId, engine]));
  // Where each engine was built, for the third share of home advantage. Same
  // treatment as a team the pool does not know: no code, so never at home.
  const engineBaseOf = new Map(makers.map((maker) => [maker.id, maker.base]));
  const field: RaceEntrant[] = [];

  for (const entry of season.entries) {
    for (const driverId of entry.drivers) {
      const driver = byId.get(driverId);
      if (driver === undefined) {
        throw new Error(`Season entry "${entry.teamId}" references unknown driver "${driverId}"`);
      }

      const base = baseOf.get(entry.teamId);
      const engine = engineOf.get(entry.engineId);
      const engineBase = engineBaseOf.get(entry.engineId);
      field.push({
        driverId,
        teamId: entry.teamId,
        driver: driverRatingsFor(driver, season.year, mode),
        chassis: entry.chassis,
        // Which way the team's year ran, carried across as authored. Only a
        // season feels it — a lone race is mid-season, where every trend is
        // worth nothing — so a field is the right place for it either way.
        ...(entry.developmentTrend === undefined || entry.developmentTrend === 0
          ? {}
          : { developmentTrend: entry.developmentTrend }),
        engineId: entry.engineId,
        ...(engine === undefined
          ? {}
          : {
              engine: {
                racing: engine.racing,
                qualifying: engine.qualifying,
                reliability: engine.reliability,
              },
            }),
        driverCountry: driver.nationality,
        ...(base === undefined ? {} : { teamCountry: base }),
        ...(engineBase === undefined ? {} : { engineCountry: engineBase }),
      });
    }
  }

  return field;
}
