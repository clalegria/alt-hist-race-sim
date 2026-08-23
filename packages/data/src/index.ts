/**
 * @alt-hist/data — authored seed data and typed loaders.
 *
 * The JSON is imported statically, so it is bundled and available in the
 * browser with no I/O. Referential integrity is checked on demand via
 * `validateSeedData()` rather than as a module-load side effect, so importing
 * this package stays pure.
 */

import driversJson from "./drivers.json";
import enginesJson from "./engines.json";
import { seasons } from "./seasons/index.js";
import teamsJson from "./teams.json";
import type { Driver, EngineManufacturer, SeasonSeed, Team } from "./types.js";

export {
  buildField,
  DEFAULT_RATING_MODE,
  driverCareer,
  driverRatingsFor,
  RATING_MODES,
  type RatingMode,
} from "./buildField.js";
export {
  applyEngines,
  authoredEngines,
  availableEngines,
  type EngineChange,
  engineChanges,
  engineSpecOf,
  isAuthoredEngines,
  type SeasonEngines,
} from "./engines.js";
export {
  applyLineup,
  authoredLineup,
  isAuthoredLineup,
  lineupChanges,
  reserveDrivers,
  type SeasonLineup,
  type SeatChange,
  seatedDriverIds,
  seatOf,
  swapDrivers,
} from "./lineup.js";
export { carOverall, driverOverall } from "./rating.js";
export {
  authoredSeasons,
  FIRST_AUTHORED_SEASON,
  hasSeason,
  seasonSeed,
  seasons,
} from "./seasons/index.js";
export type {
  CalendarRace,
  CarSpec,
  Driver,
  DriverOffSeason,
  DriverPeak,
  DriverSteepDecline,
  EngineManufacturer,
  SeasonEngine,
  SeasonEntry,
  SeasonSeed,
  Team,
} from "./types.js";

/**
 * Every driver the sim knows about, across every authored season.
 *
 * Deliberately larger than any one grid: drivers without a seat in the season
 * being run sit in the pool, available to the grid editor now and to the
 * transfer market later.
 */
export const drivers: readonly Driver[] = driversJson;

/** Every team, likewise across all seasons — Shadow raced in 1980 and not 1981. */
export const teams: readonly Team[] = teamsJson;

/**
 * Every engine manufacturer, across every season.
 *
 * Identity only — what a unit was *worth* is a per-season fact and lives in the
 * season file, because Ferrari's 1980 flat-12 and its 1981 turbo V6 are the same
 * manufacturer and not remotely the same engine.
 */
export const engines: readonly EngineManufacturer[] = enginesJson;

function indexById<T extends { readonly id: string }>(items: readonly T[]): ReadonlyMap<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

const driverIndex = indexById(drivers);
const teamIndex = indexById(teams);
const engineIndex = indexById(engines);

export function driversById(): ReadonlyMap<string, Driver> {
  return driverIndex;
}

export function teamsById(): ReadonlyMap<string, Team> {
  return teamIndex;
}

export function enginesById(): ReadonlyMap<string, EngineManufacturer> {
  return engineIndex;
}

function findDuplicates(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      duplicates.add(id);
    }
    seen.add(id);
  }
  return [...duplicates];
}

/**
 * Checks referential integrity of the seed data, throwing on the first problem
 * found. Drivers without a seat are legal — they sit in the pool available to
 * the transfer market — as are teams entering a single car.
 *
 * **Every authored season is checked**, not one: adding a year should not need
 * anyone to remember to validate it, and a driver who is fine in 1980 can be
 * seated at two teams in 1981. A driver may of course hold a seat in as many
 * seasons as they like — the one-seat rule is per season.
 *
 * Defaults to the bundled seed; the parameters exist so tests can check the
 * rules against deliberately broken data.
 */
export function validateSeedData(
  driverPool: readonly Driver[] = drivers,
  teamPool: readonly Team[] = teams,
  seasonPool: readonly SeasonSeed[] = [...seasons.values()],
  enginePool: readonly EngineManufacturer[] = engines,
): void {
  const duplicateDrivers = findDuplicates(driverPool.map((driver) => driver.id));
  if (duplicateDrivers.length > 0) {
    throw new Error(`Duplicate driver ids: ${duplicateDrivers.join(", ")}`);
  }

  const duplicateTeams = findDuplicates(teamPool.map((team) => team.id));
  if (duplicateTeams.length > 0) {
    throw new Error(`Duplicate team ids: ${duplicateTeams.join(", ")}`);
  }

  const duplicateEngines = findDuplicates(enginePool.map((maker) => maker.id));
  if (duplicateEngines.length > 0) {
    throw new Error(`Duplicate engine ids: ${duplicateEngines.join(", ")}`);
  }

  // Career shape: the ageing curve reads all of these, and a nonsense value
  // produces a plausible-looking curve rather than an error, which is worse.
  for (const driver of driverPool) {
    if (!Number.isInteger(driver.peakSeasons) || driver.peakSeasons < 1) {
      throw new Error(
        `Driver "${driver.id}" has peakSeasons ${driver.peakSeasons}; it must be a whole season count of at least 1`,
      );
    }
    if (driver.finalSeason < driver.debutSeason) {
      throw new Error(
        `Driver "${driver.id}" retires in ${driver.finalSeason}, before debuting in ${driver.debutSeason}`,
      );
    }
    if (driver.peak.season < driver.debutSeason) {
      throw new Error(
        `Driver "${driver.id}" peaks in ${driver.peak.season}, before debuting in ${driver.debutSeason}`,
      );
    }
    const severities = [
      ...(driver.steepDecline === undefined ? [] : [driver.steepDecline]),
      ...(driver.offSeasons ?? []),
    ];
    for (const event of severities) {
      if (event.severity < 0 || event.severity > 1) {
        throw new Error(
          `Driver "${driver.id}" has a career event in ${event.season} with severity ${event.severity}; it must be between 0 and 1`,
        );
      }
    }
  }

  const knownDrivers = new Set(driverPool.map((driver) => driver.id));
  const knownTeams = new Set(teamPool.map((team) => team.id));
  const knownEngines = new Set(enginePool.map((maker) => maker.id));

  for (const season of seasonPool) {
    validateSeason(season, knownDrivers, knownTeams, knownEngines);
  }
}

/** One season's entries and calendar, against the pools that must contain them. */
function validateSeason(
  season: SeasonSeed,
  knownDrivers: ReadonlySet<string>,
  knownTeams: ReadonlySet<string>,
  knownEngines: ReadonlySet<string>,
): void {
  const seatedDrivers = new Map<string, string>();

  // The season's own engine menu, checked before the entries that draw on it —
  // an entry naming a unit the year does not have is the failure this catches,
  // and it would otherwise surface as a car quietly racing without an engine.
  for (const engine of season.engines) {
    if (!knownEngines.has(engine.engineId)) {
      throw new Error(`Season ${season.year} rates unknown engine "${engine.engineId}"`);
    }
  }
  const duplicateEngines = findDuplicates(season.engines.map((engine) => engine.engineId));
  if (duplicateEngines.length > 0) {
    throw new Error(
      `Season ${season.year} rates these engines twice: ${duplicateEngines.join(", ")}`,
    );
  }
  const available = new Set(season.engines.map((engine) => engine.engineId));

  for (const entry of season.entries) {
    if (!knownTeams.has(entry.teamId)) {
      throw new Error(`Season ${season.year} entry references unknown team "${entry.teamId}"`);
    }

    if (!available.has(entry.engineId)) {
      throw new Error(
        `Season ${season.year} entry "${entry.teamId}" runs engine "${entry.engineId}", which the season does not rate`,
      );
    }

    for (const driverId of entry.drivers) {
      if (!knownDrivers.has(driverId)) {
        throw new Error(
          `Season ${season.year} entry "${entry.teamId}" references unknown driver "${driverId}"`,
        );
      }

      const existingSeat = seatedDrivers.get(driverId);
      if (existingSeat !== undefined) {
        throw new Error(
          `Driver "${driverId}" is seated at both "${existingSeat}" and "${entry.teamId}" in season ${season.year}`,
        );
      }
      seatedDrivers.set(driverId, entry.teamId);
    }
  }

  // The calendar is cosmetic, but a round number that disagrees with its
  // position would quietly mislabel every result printed from it.
  season.calendar.forEach((race, index) => {
    if (race.round !== index + 1) {
      throw new Error(
        `Season ${season.year} calendar round ${race.round} sits at position ${index + 1}`,
      );
    }
    if (race.name.trim() === "" || race.circuit.trim() === "") {
      throw new Error(`Season ${season.year} round ${race.round} is missing a name or circuit`);
    }
    if (!/^[A-Z]{2}$/.test(race.country)) {
      throw new Error(
        `Season ${season.year} round ${race.round} has country "${race.country}", not an ISO alpha-2 code`,
      );
    }
  });

  const duplicateEntries = findDuplicates(season.entries.map((entry) => entry.teamId));
  if (duplicateEntries.length > 0) {
    throw new Error(
      `Season ${season.year} has duplicate entries for: ${duplicateEntries.join(", ")}`,
    );
  }
}
