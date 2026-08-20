/**
 * Types for the authored seed data.
 *
 * These describe the JSON files in this folder as they actually are — every
 * field below was read off the files, and `type-checks.ts` asserts in both
 * directions that the declarations and the JSON still agree. They are seed /
 * authoring shapes, deliberately independent of the engine's runtime model.
 */

/** A driver's ratings at their nominal peak. Higher is better on all five. */
export interface DriverPeak {
  /** Nominal peak season. The sim rolls a realized peak from this. */
  readonly season: number;
  readonly racing: number;
  readonly qualifying: number;
  readonly consistency: number;
  readonly adaptability: number;
  /** Low composure = crash-prone. */
  readonly composure: number;
}

export interface Driver {
  readonly id: string;
  readonly name: string;
  /** ISO 3166-1 alpha-2 country code. */
  readonly nationality: string;
  readonly birthYear: number;
  /** Nominal debut season. The sim rolls a realized debut from this. */
  readonly debutSeason: number;
  readonly peak: DriverPeak;
  readonly developmentSpeed: number;
  readonly declineSpeed: number;
}

export interface Team {
  readonly id: string;
  readonly name: string;
  /** ISO 3166-1 alpha-2 country code. */
  readonly base: string;
  readonly foundedYear: number;
}

/** A team's car attributes for one season. */
export interface CarSpec {
  readonly racing: number;
  readonly qualifying: number;
  readonly consistency: number;
  readonly reliability: number;
}

/** One team's participation in one season: a team, a car, and its drivers. */
export interface SeasonEntry {
  readonly teamId: string;
  readonly car: CarSpec;
  /** Driver ids. Length varies — some teams field a single car. */
  readonly drivers: readonly string[];
}

export interface SeasonSeed {
  readonly year: number;
  readonly entries: readonly SeasonEntry[];
}
