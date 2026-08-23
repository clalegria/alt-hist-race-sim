/**
 * Compile-time proof that the types in `types.ts` are derived from the JSON
 * rather than invented alongside it. Nothing here exists at runtime.
 *
 * Two directions are checked per file:
 *
 *  1. **Structural** — the JSON's inferred type must satisfy the interface.
 *     Fails if an interface declares a field the JSON lacks, or types it wrong.
 *  2. **Key completeness** — every key present in the JSON must be a key of the
 *     interface. Fails if the JSON grows a field the interface ignores.
 *
 * Direction 2 compares key sets rather than whole types on purpose: the
 * interfaces use `readonly` arrays, which are deliberately *not* assignable to
 * the mutable arrays TypeScript infers for JSON.
 *
 * Either failure is a type error, so `pnpm typecheck` breaks the moment the
 * seed files and the types drift apart.
 */

import type driversJson from "./drivers.json";
import type season1980Json from "./seasons/1980.json";
import type season1981Json from "./seasons/1981.json";
import type teamsJson from "./teams.json";
import type {
  CalendarRace,
  CarSpec,
  Driver,
  DriverOffSeason,
  DriverPeak,
  DriverSteepDecline,
  SeasonEntry,
  SeasonSeed,
  Team,
} from "./types.js";

/**
 * Resolves to `true` when `A` is assignable to `B`. When it is not, the
 * constraint fails and TypeScript reports an error at the use site.
 */
type Extends<A extends B, B> = A extends B ? true : never;

type DriverJson = (typeof driversJson)[number];
type TeamJson = (typeof teamsJson)[number];

/**
 * Every season file, as a union.
 *
 * A new `seasons/<year>.json` is added here as well as to the registry — two
 * lines rather than one, and the second is what stops a season file drifting
 * from the shape the engine reads. `keyof` a union collapses to the shared
 * keys, which is exactly the "no extra keys" question being asked.
 */
type SeasonJson = typeof season1980Json | typeof season1981Json;
type SeasonEntryJson = SeasonJson["entries"][number];
type CalendarRaceJson = SeasonJson["calendar"][number];

// drivers.json
export type DriversAreDrivers = Extends<DriverJson, Driver>;
export type DriversHaveNoExtraKeys = Extends<keyof DriverJson, keyof Driver>;
export type PeakHasNoExtraKeys = Extends<keyof DriverJson["peak"], keyof DriverPeak>;
// The two optional career events, checked on the drivers that actually carry
// them — `keyof` a union would collapse to the keys they share with everyone.
type SteepDeclineJson = Extract<DriverJson, { steepDecline: unknown }>["steepDecline"];
type OffSeasonJson = Extract<DriverJson, { offSeasons: unknown }>["offSeasons"][number];
export type SteepDeclinesMatch = Extends<SteepDeclineJson, DriverSteepDecline>;
export type SteepDeclinesHaveNoExtraKeys = Extends<
  keyof SteepDeclineJson,
  keyof DriverSteepDecline
>;
export type OffSeasonsMatch = Extends<OffSeasonJson, DriverOffSeason>;
export type OffSeasonsHaveNoExtraKeys = Extends<keyof OffSeasonJson, keyof DriverOffSeason>;

// teams.json
export type TeamsAreTeams = Extends<TeamJson, Team>;
export type TeamsHaveNoExtraKeys = Extends<keyof TeamJson, keyof Team>;

// seasons/*.json
export type SeasonIsSeasonSeed = Extends<SeasonJson, SeasonSeed>;
export type SeasonHasNoExtraKeys = Extends<keyof SeasonJson, keyof SeasonSeed>;
export type EntriesHaveNoExtraKeys = Extends<keyof SeasonEntryJson, keyof SeasonEntry>;
export type CarsHaveNoExtraKeys = Extends<keyof SeasonEntryJson["car"], keyof CarSpec>;
export type CalendarIsCalendarRaces = Extends<CalendarRaceJson, CalendarRace>;
export type CalendarHasNoExtraKeys = Extends<keyof CalendarRaceJson, keyof CalendarRace>;
