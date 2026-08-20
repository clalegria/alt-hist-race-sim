/**
 * @alt-hist/data — authored seed data and typed loaders.
 *
 * The JSON is imported statically, so it is bundled and available in the
 * browser with no I/O. Referential integrity is checked on demand via
 * `validateSeedData()` rather than as a module-load side effect, so importing
 * this package stays pure.
 */

import driversJson from "./drivers.json";
import seasonJson from "./season-1980.json";
import teamsJson from "./teams.json";
import type { Driver, SeasonSeed, Team } from "./types.js";

export { buildField } from "./buildField.js";
export type {
  CalendarRace,
  CarSpec,
  Driver,
  DriverPeak,
  SeasonEntry,
  SeasonSeed,
  Team,
} from "./types.js";

/** Every driver in the pool, including those without a 1980 seat. */
export const drivers: readonly Driver[] = driversJson;

export const teams: readonly Team[] = teamsJson;

/** The starting season the simulation diverges from. */
export const season1980: SeasonSeed = seasonJson;

function indexById<T extends { readonly id: string }>(items: readonly T[]): ReadonlyMap<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

const driverIndex = indexById(drivers);
const teamIndex = indexById(teams);

export function driversById(): ReadonlyMap<string, Driver> {
  return driverIndex;
}

export function teamsById(): ReadonlyMap<string, Team> {
  return teamIndex;
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
 * Defaults to the bundled seed; the parameters exist so tests can check the
 * rules against deliberately broken data.
 */
export function validateSeedData(
  driverPool: readonly Driver[] = drivers,
  teamPool: readonly Team[] = teams,
  season: SeasonSeed = season1980,
): void {
  const duplicateDrivers = findDuplicates(driverPool.map((driver) => driver.id));
  if (duplicateDrivers.length > 0) {
    throw new Error(`Duplicate driver ids: ${duplicateDrivers.join(", ")}`);
  }

  const duplicateTeams = findDuplicates(teamPool.map((team) => team.id));
  if (duplicateTeams.length > 0) {
    throw new Error(`Duplicate team ids: ${duplicateTeams.join(", ")}`);
  }

  const knownDrivers = new Set(driverPool.map((driver) => driver.id));
  const knownTeams = new Set(teamPool.map((team) => team.id));
  const seatedDrivers = new Map<string, string>();

  for (const entry of season.entries) {
    if (!knownTeams.has(entry.teamId)) {
      throw new Error(`Season ${season.year} entry references unknown team "${entry.teamId}"`);
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
