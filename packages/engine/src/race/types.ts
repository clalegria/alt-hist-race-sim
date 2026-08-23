import type { CarSpec, DriverRatings } from "../model/ratings.js";
import type { Rng } from "../rng/types.js";
import type { RaceConstants } from "./constants.js";

/** One car on the grid: a driver, in a team's car. */
export interface RaceEntrant {
  readonly driverId: string;
  readonly teamId: string;
  readonly driver: DriverRatings;
  readonly car: CarSpec;
  /**
   * Where the driver and the team are from, as ISO 3166-1 alpha-2 codes, for
   * the home-advantage term. Both optional and compared case-insensitively: a
   * field built without them simply races everywhere as a visitor, which is
   * exactly what every field did before home advantage existed.
   *
   * Identity, not rating — it travels with the entrant because that is where
   * the rest of a car's identity already lives, and the engine may not read the
   * seed data to look it up.
   */
  readonly driverCountry?: string;
  readonly teamCountry?: string;
}

/**
 * What the engine knows about one round of a season.
 *
 * Deliberately thin. Home advantage needs the host country and nothing else,
 * and this is the seam every later circuit feature hangs off — a power track,
 * a street circuit, weather — rather than each one growing its own parameter.
 * Everything on it is optional, so a round nobody described is a neutral race.
 */
export interface RoundContext {
  /** ISO 3166-1 alpha-2 code for the host country. */
  readonly country?: string;
}

/** Why a car failed to finish. */
export type DnfCause = "mechanical" | "driver-error";

/**
 * A cosmetic race gap: seconds behind the winner, or whole laps once the gap
 * grows past one. Two shapes rather than one number because they are different
 * units — a real classification switches from "+12.320s" to "+1 lap" and never
 * mixes them.
 */
export type RaceGap =
  | { readonly kind: "time"; readonly seconds: number }
  | { readonly kind: "laps"; readonly laps: number };

/** One driver's weekend. */
export interface RaceEntryResult {
  readonly driverId: string;
  readonly teamId: string;
  /**
   * 1-based qualifying rank. Always present — the whole entry list qualifies,
   * and it is qualifying that decides who starts. A car ranked beyond the
   * starting limit keeps its rank here but did not take the start.
   */
  readonly gridPosition: number;
  /**
   * Whether the car took the start. False means DNQ: it qualified outside
   * `maxStarters` and its race never happened, so `retired` is false, both DNF
   * flags are false, and `raceScore` is null. Check this before reading anything
   * about the race — "not retired" alone does not mean "finished".
   */
  readonly started: boolean;
  /** 1-based finishing place among classified cars, or null if retired or DNQ. */
  readonly finishPosition: number | null;
  /** Retired from a race it started. Always false for a non-qualifier. */
  readonly retired: boolean;
  /**
   * The recorded cause, or null if classified or DNQ. Mechanical and
   * driver-error rolls are independent and both are always made; when both fail,
   * mechanical is recorded and `driverError` still reports true.
   */
  readonly dnfCause: DnfCause | null;
  readonly mechanicalFailure: boolean;
  readonly driverError: boolean;
  /** Diagnostics for calibration. Not part of the championship record. */
  readonly qualifyingScore: number;
  /** Null for a non-qualifier: there is no race pace without a race. */
  readonly raceScore: number | null;
  /**
   * Seconds behind pole, and behind the winner. Both are decoration derived from
   * the scores above — they make a classification readable and carry no
   * information the finishing order does not already have. Nothing in the sim
   * reads them; do not build championship logic on them.
   *
   * Pole sits at 0, and so does the winner. `raceGapToWinner` is null for anyone
   * without a finishing position: a retirement and a DNQ have no gap.
   */
  readonly qualifyingGapToPole: number;
  readonly raceGapToWinner: RaceGap | null;
}

/** The outcome of one race weekend. */
export interface RaceResult {
  /** Every entrant, in the order the field was supplied — non-qualifiers included. */
  readonly entries: readonly RaceEntryResult[];
  /** Pole always exists: everyone entered qualifies, whatever the starting limit. */
  readonly poleDriverId: string;
  /** Null only if every starter retired. */
  readonly winnerDriverId: string | null;
  /** Counts starters only, as does `classifiedCount`. The two sum to the starters. */
  readonly retirements: number;
  readonly classifiedCount: number;
  /** Cars that qualified outside the starting limit (DNQ). Zero for a field within it. */
  readonly nonQualifiers: number;
}

/**
 * The swappable race model seam.
 *
 * v1 is score-and-sort: one performance number per driver, sorted, with DNFs
 * applied. A richer model (lap-by-lap, pit strategy, weather) can implement the
 * same interface without callers changing.
 */
export interface RaceModel {
  readonly name: string;
  simulate(
    field: readonly RaceEntrant[],
    rng: Rng,
    constants?: RaceConstants,
    round?: RoundContext,
  ): RaceResult;
}
