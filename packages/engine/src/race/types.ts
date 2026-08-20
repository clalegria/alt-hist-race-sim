import type { CarSpec, DriverRatings } from "../model/ratings.js";
import type { Rng } from "../rng/types.js";
import type { RaceConstants } from "./constants.js";

/** One car on the grid: a driver, in a team's car. */
export interface RaceEntrant {
  readonly driverId: string;
  readonly teamId: string;
  readonly driver: DriverRatings;
  readonly car: CarSpec;
}

/** Why a car failed to finish. */
export type DnfCause = "mechanical" | "driver-error";

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
  simulate(field: readonly RaceEntrant[], rng: Rng, constants?: RaceConstants): RaceResult;
}
