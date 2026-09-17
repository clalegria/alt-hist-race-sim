/**
 * @alt-hist/data — authored seed data and typed loaders.
 *
 * The JSON is imported statically, so it is bundled and available in the
 * browser with no I/O. Referential integrity is checked on demand via
 * `validateSeedData()` rather than as a module-load side effect, so importing
 * this package stays pure.
 */

import { DEVELOPMENT_TREND_LIMIT } from "@alt-hist/engine";
import driversJson from "./drivers.json";
import enginesJson from "./engines.json";
import { seasons } from "./seasons/index.js";
import teamsJson from "./teams.json";
import type {
  Driver,
  EngineManufacturer,
  Era,
  Livery,
  LiveryEra,
  SeasonEntry,
  SeasonSeed,
  Team,
  TeamIdentity,
} from "./types.js";

export {
  ARRANGEMENT_KINDS,
  type ArrangementKind,
  type ArrangeOptions,
  arrangeLineup,
  type GridArrangement,
  isArrangementKind,
} from "./arrange.js";
export {
  buildField,
  DEFAULT_RATING_MODE,
  driverCareer,
  driverRatingsFor,
  RATING_MODES,
  type RatingMode,
} from "./buildField.js";
export {
  CARRY_OVER_AGES,
  type CarryOverOptions,
  carryOverLineup,
} from "./carryOver.js";
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
export { eraAt, teamIdentityIn, teamLiveryIn } from "./eras.js";
export {
  applyDraft,
  applyLineup,
  authoredLineup,
  type DraftSeat,
  driverAt,
  emptySeats,
  exchangePicks,
  filledLineup,
  type GridPick,
  isAuthoredLineup,
  type LineupDraft,
  lineupChanges,
  reserveDrivers,
  type SeasonLineup,
  type SeatChange,
  type SeatRef,
  seatedDriverIds,
  seatOf,
  seatRefOf,
  swapDrivers,
} from "./lineup.js";
export {
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
export { carOverall, carRacing, compareByRating, driverOverall, type Rated } from "./rating.js";
export { seasonConstants } from "./seasonConstants.js";
export {
  authoredSeasons,
  FIRST_AUTHORED_SEASON,
  hasSeason,
  seasonSeed,
  seasons,
} from "./seasons/index.js";
export type {
  CalendarRace,
  ChassisSpec,
  Driver,
  DriverOffSeason,
  DriverPeak,
  DriverStepDown,
  EngineManufacturer,
  Era,
  Livery,
  LiveryEra,
  SeasonEngine,
  SeasonEntry,
  SeasonSeed,
  Team,
  TeamIdentity,
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
 * The season half of what `type-checks.ts` does for the pools, done at runtime
 * because a season is discovered from disk rather than imported.
 *
 * Naming season files in `type-checks.ts` would rebuild the registry
 * `seasons/index.ts` exists to avoid — the next year authored would be the one
 * nobody checked. These two run over *every* season instead, and cover the same
 * two directions: every declared field is present and a number, and no field is
 * present that the type does not declare.
 */
function checkRatings(where: string, ratings: object, keys: readonly string[]): void {
  const fields = ratings as Record<string, unknown>;
  for (const key of keys) {
    const value = fields[key];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(`${where} has ${key} "${String(value)}"; every rating must be a number`);
    }
    if (value < 0 || value > 100) {
      throw new Error(`${where} has ${key} ${value}; ratings run from 0 to 100`);
    }
  }
}

/** Fails on a field the type does not declare — an authoring slip nothing reads. */
function checkNoExtraKeys(where: string, record: object, keys: readonly string[]): void {
  const extra = Object.keys(record).filter((key) => !keys.includes(key));
  if (extra.length > 0) {
    throw new Error(`${where} has fields nothing reads: ${extra.join(", ")}`);
  }
}

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

/**
 * A livery's four fields, wherever they appear — a team's default or a season's
 * override. Nothing simulated depends on these, but a malformed colour reaches
 * the DOM as a silently ignored CSS value, which shows up as a team rendered in
 * the fallback grey rather than as an error.
 */
function checkLivery(where: string, livery: Livery | LiveryEra): void {
  for (const key of ["primaryColor", "secondaryColor1", "secondaryColor2"] as const) {
    const value = livery[key];
    if (typeof value !== "string" || !HEX_COLOR.test(value)) {
      throw new Error(`${where} has ${key} "${String(value)}", not a #RRGGBB colour`);
    }
  }
  const { badgeStripes } = livery;
  if (badgeStripes !== 0 && badgeStripes !== 1 && badgeStripes !== 2) {
    throw new Error(
      `${where} has badgeStripes ${String(badgeStripes)}; a badge wears 0, 1 or 2 stripes`,
    );
  }
}

/**
 * An era list, whichever kind: at least one era, no unread fields, and strictly
 * ascending `from` years.
 *
 * Strictly ascending is the load-bearing rule. `eraAt` returns the last era
 * whose year has arrived, so two eras sharing a `from` would make one of them
 * dead data that reads as authored, and an out-of-order list would silently
 * skip an era for every year after it. Neither shows up as an error anywhere
 * downstream — the team simply wears the wrong name or the wrong colours.
 */
function checkEras(where: string, list: readonly Era[], keys: readonly string[]): void {
  if (list.length === 0) {
    throw new Error(`${where} is empty; a team has at least one era`);
  }
  let previous: number | undefined;
  for (const era of list) {
    if (!Number.isInteger(era.from)) {
      throw new Error(
        `${where} has an era starting "${String(era.from)}"; a year is a whole number`,
      );
    }
    if (previous !== undefined && era.from <= previous) {
      throw new Error(
        `${where} has an era starting ${era.from} after one starting ${previous}; eras run earliest first and never share a year`,
      );
    }
    previous = era.from;
    checkNoExtraKeys(`${where} from ${era.from}`, era, keys);
  }
}

/** A name and a flag, on one identity era. */
function checkIdentity(where: string, identity: TeamIdentity): void {
  if (identity.name.trim() === "") {
    throw new Error(`${where} has no name`);
  }
  if (!/^[A-Z]{2}$/.test(identity.base)) {
    throw new Error(`${where} has base "${identity.base}", not an ISO alpha-2 code`);
  }
}

/**
 * A season entry's optional livery override, which is all-or-nothing: four
 * fields or none.
 *
 * A partial override would blend authored colours with fallen-back ones into a
 * livery nobody chose, so it is an authoring error rather than a merge.
 */
function checkLiveryOverride(where: string, entry: SeasonEntry): void {
  const present = LIVERY_KEYS.filter((key) => entry[key] !== undefined);
  if (present.length === 0) {
    return;
  }
  if (present.length < LIVERY_KEYS.length) {
    const missing = LIVERY_KEYS.filter((key) => entry[key] === undefined);
    throw new Error(
      `${where} overrides livery fields ${present.join(", ")} but not ${missing.join(", ")}; a season livery is all four fields or none`,
    );
  }
  checkLivery(`${where} livery`, entry as Livery);
}

const LIVERY_KEYS = ["primaryColor", "secondaryColor1", "secondaryColor2", "badgeStripes"] as const;
const IDENTITY_KEYS = ["from", "name", "base"] as const;
const LIVERY_ERA_KEYS = ["from", ...LIVERY_KEYS] as const;
const TEAM_KEYS = ["id", "foundedYear", "identity", "liveries"] as const;
const CHASSIS_KEYS = ["racing", "qualifying", "consistency", "reliability"] as const;
const ENGINE_RATING_KEYS = ["racing", "qualifying", "reliability"] as const;
const ENTRY_KEYS = [
  "teamId",
  "engineId",
  "chassis",
  "developmentTrend",
  "drivers",
  ...LIVERY_KEYS,
] as const;
const SEASON_ENGINE_KEYS = ["engineId", ...ENGINE_RATING_KEYS] as const;
const CALENDAR_KEYS = ["round", "name", "circuit", "country"] as const;
const SEASON_KEYS = [
  "year",
  "points",
  "retirementFactor",
  "calendar",
  "engines",
  "entries",
] as const;

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

  for (const team of teamPool) {
    const where = `Team "${team.id}"`;
    checkNoExtraKeys(where, team, TEAM_KEYS);
    checkEras(`${where} identity`, team.identity, IDENTITY_KEYS);
    checkEras(`${where} liveries`, team.liveries, LIVERY_ERA_KEYS);
    for (const identity of team.identity) {
      checkIdentity(`${where} identity from ${identity.from}`, identity);
    }
    for (const era of team.liveries) {
      checkLivery(`${where} livery from ${era.from}`, era);
    }
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
    // A step down persists for the rest of a career, so it stays on the 0-1
    // scale its constant sizes. An off-season is one year and is deliberately
    // uncapped — see `DriverOffSeason` — so all that is rejected there is a
    // number that means nothing: negative, or not a number at all.
    if (driver.stepDown !== undefined) {
      const { season, severity } = driver.stepDown;
      if (!(severity >= 0 && severity <= 1)) {
        throw new Error(
          `Driver "${driver.id}" steps down in ${season} with severity ${severity}; it must be between 0 and 1`,
        );
      }
    }
    for (const off of driver.offSeasons ?? []) {
      if (!(off.severity >= 0) || !Number.isFinite(off.severity)) {
        throw new Error(
          `Driver "${driver.id}" has an off season in ${off.season} with severity ${off.severity}; it must be 0 or more`,
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
  checkNoExtraKeys(`Season ${season.year}`, season, SEASON_KEYS);

  // The points scale, before anything that could be scored on it. A season
  // without one would silently crown whoever the countback favoured, and a
  // scale that pays 4th more than 3rd is an authoring slip that looks like a
  // simulation bug three tables downstream.
  if (season.points.length === 0) {
    throw new Error(`Season ${season.year} has no points scale`);
  }

  // The retirement dial, which is authored per year and read by nothing else in
  // this package. Out of range it would silently fall back to the default and
  // the season would race at 1980's attrition under whatever number was typed.
  if (
    !Number.isInteger(season.retirementFactor) ||
    season.retirementFactor < 1 ||
    season.retirementFactor > 10
  ) {
    throw new Error(
      `Season ${season.year} has retirementFactor ${season.retirementFactor}; it must be a whole number from 1 to 10`,
    );
  }
  season.points.forEach((points, index) => {
    if (!Number.isFinite(points) || points < 0) {
      throw new Error(
        `Season ${season.year} pays ${points} for position ${index + 1}; points must be a non-negative number`,
      );
    }
    const ahead = season.points[index - 1];
    if (ahead !== undefined && points > ahead) {
      throw new Error(
        `Season ${season.year} pays ${points} for position ${index + 1} but only ${ahead} for position ${index}; the scale must never rise`,
      );
    }
  });

  // The season's own engine menu, checked before the entries that draw on it —
  // an entry naming a unit the year does not have is the failure this catches,
  // and it would otherwise surface as a car quietly racing without an engine.
  for (const engine of season.engines) {
    if (!knownEngines.has(engine.engineId)) {
      throw new Error(`Season ${season.year} rates unknown engine "${engine.engineId}"`);
    }
    const where = `Season ${season.year} engine "${engine.engineId}"`;
    checkRatings(where, engine, ENGINE_RATING_KEYS);
    checkNoExtraKeys(where, engine, SEASON_ENGINE_KEYS);
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

    const where = `Season ${season.year} entry "${entry.teamId}"`;
    checkNoExtraKeys(where, entry, ENTRY_KEYS);
    checkLiveryOverride(where, entry);
    checkRatings(`${where} chassis`, entry.chassis, CHASSIS_KEYS);
    checkNoExtraKeys(`${where} chassis`, entry.chassis, CHASSIS_KEYS);
    // Which way the team's year ran. Optional, and out of range it would be
    // silently absorbed by the race model as a very large or fractional swing
    // — the same failure mode as `retirementFactor`, and caught the same way.
    if (entry.developmentTrend !== undefined) {
      const trend = entry.developmentTrend;
      if (
        !Number.isInteger(trend) ||
        trend < -DEVELOPMENT_TREND_LIMIT ||
        trend > DEVELOPMENT_TREND_LIMIT
      ) {
        throw new Error(
          `${where} has developmentTrend ${String(trend)}; it must be a whole number from -${DEVELOPMENT_TREND_LIMIT} to ${DEVELOPMENT_TREND_LIMIT}`,
        );
      }
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
    checkNoExtraKeys(`Season ${season.year} round ${race.round}`, race, CALENDAR_KEYS);
  });

  const duplicateEntries = findDuplicates(season.entries.map((entry) => entry.teamId));
  if (duplicateEntries.length > 0) {
    throw new Error(
      `Season ${season.year} has duplicate entries for: ${duplicateEntries.join(", ")}`,
    );
  }
}
