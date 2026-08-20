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

/**
 * One round of a season's calendar.
 *
 * Cosmetic. The race model has no notion of a circuit — every round is the same
 * race — so this exists purely so results can be labelled "Round 3, South
 * African Grand Prix at Kyalami" instead of "Round 3". If circuits ever gain
 * real character (a power track favouring the turbos, a street circuit
 * favouring grid position), it will hang off this record; nothing does yet.
 */
export interface CalendarRace {
  /** 1-based, and equal to the position in the array. */
  readonly round: number;
  readonly name: string;
  readonly circuit: string;
  /** ISO 3166-1 alpha-2 code for the host country, for the flag beside the name. */
  readonly country: string;
}

export interface SeasonSeed {
  readonly year: number;
  /** The season's rounds, in order. Its length is how many races the year has. */
  readonly calendar: readonly CalendarRace[];
  readonly entries: readonly SeasonEntry[];
}
