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

/** One driver's race. */
export interface RaceEntryResult {
  readonly driverId: string;
  readonly teamId: string;
  /** 1-based grid slot. Always present — qualifying happens before any retirement. */
  readonly gridPosition: number;
  /** 1-based finishing place among classified cars, or null if retired. */
  readonly finishPosition: number | null;
  readonly retired: boolean;
  /**
   * The recorded cause, or null if classified. Mechanical and driver-error rolls
   * are independent and both are always made; when both fail, mechanical is
   * recorded and `driverError` still reports true.
   */
  readonly dnfCause: DnfCause | null;
  readonly mechanicalFailure: boolean;
  readonly driverError: boolean;
  /** Diagnostics for calibration. Not part of the championship record. */
  readonly qualifyingScore: number;
  readonly raceScore: number;
}

/** The outcome of one race. */
export interface RaceResult {
  /** Every entrant, in the order the field was supplied. */
  readonly entries: readonly RaceEntryResult[];
  readonly poleDriverId: string;
  /** Null only if every car retired. */
  readonly winnerDriverId: string | null;
  readonly retirements: number;
  readonly classifiedCount: number;
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
