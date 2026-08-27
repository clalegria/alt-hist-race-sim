/**
 * Compile-time proof that the types in `types.ts` are derived from the JSON
 * rather than invented alongside it. Nothing here exists at runtime.
 *
 * **The pools only — not the seasons.** A season is discovered from disk rather
 * than imported, so checking one here means naming its file, and naming files
 * here is the registry `seasons/index.ts` exists to avoid: the next season
 * authored would be the one nobody checked, silently. Seasons are therefore
 * checked at *runtime* by `validateSeedData()`, over every year on disk, in both
 * of the directions below. The pools stay here because there is exactly one file
 * of each and it is imported by name anyway.
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
import type enginesJson from "./engines.json";
import type teamsJson from "./teams.json";
import type {
  Driver,
  DriverOffSeason,
  DriverPeak,
  DriverStepDown,
  EngineManufacturer,
  LiveryEra,
  Team,
  TeamIdentity,
} from "./types.js";

/**
 * Resolves to `true` when `A` is assignable to `B`. When it is not, the
 * constraint fails and TypeScript reports an error at the use site.
 */
type Extends<A extends B, B> = A extends B ? true : never;

type DriverJson = (typeof driversJson)[number];
type TeamJson = (typeof teamsJson)[number];
type EngineJson = (typeof enginesJson)[number];

// drivers.json
export type DriversAreDrivers = Extends<DriverJson, Driver>;
export type DriversHaveNoExtraKeys = Extends<keyof DriverJson, keyof Driver>;
export type PeakHasNoExtraKeys = Extends<keyof DriverJson["peak"], keyof DriverPeak>;
// The two optional career events, checked on the drivers that actually carry
// them — `keyof` a union would collapse to the keys they share with everyone.
type StepDownJson = Extract<DriverJson, { stepDown: unknown }>["stepDown"];
type OffSeasonJson = Extract<DriverJson, { offSeasons: unknown }>["offSeasons"][number];
export type StepDownsMatch = Extends<StepDownJson, DriverStepDown>;
export type StepDownsHaveNoExtraKeys = Extends<keyof StepDownJson, keyof DriverStepDown>;
export type OffSeasonsMatch = Extends<OffSeasonJson, DriverOffSeason>;
export type OffSeasonsHaveNoExtraKeys = Extends<keyof OffSeasonJson, keyof DriverOffSeason>;

// teams.json. The two era lists are checked in both directions as well: they
// are where every name and colour now lives, and a key the interfaces ignore
// would be authored data that silently renders as nothing.
type IdentityJson = TeamJson["identity"][number];
type LiveryEraJson = TeamJson["liveries"][number];
export type TeamsAreTeams = Extends<TeamJson, Team>;
export type TeamsHaveNoExtraKeys = Extends<keyof TeamJson, keyof Team>;
export type IdentitiesMatch = Extends<IdentityJson, TeamIdentity>;
export type IdentitiesHaveNoExtraKeys = Extends<keyof IdentityJson, keyof TeamIdentity>;
export type LiveryErasMatch = Extends<LiveryEraJson, LiveryEra>;
export type LiveryErasHaveNoExtraKeys = Extends<keyof LiveryEraJson, keyof LiveryEra>;

// engines.json
export type EnginesAreManufacturers = Extends<EngineJson, EngineManufacturer>;
export type EnginesHaveNoExtraKeys = Extends<keyof EngineJson, keyof EngineManufacturer>;
