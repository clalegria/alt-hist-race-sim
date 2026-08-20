import type { Rng } from "../rng/types.js";
import { RACE_CONSTANTS, type RaceConstants } from "./constants.js";
import type { DnfCause, RaceEntrant, RaceEntryResult, RaceModel, RaceResult } from "./types.js";

/** Linear interpolation from `atZero` to `atHundred` across a 0-100 rating. */
function lerpFromRating(rating: number, atZero: number, atHundred: number): number {
  const t = Math.min(Math.max(rating, 0), 100) / 100;
  return atZero + (atHundred - atZero) * t;
}

/** Deterministic tie-break, so equal scores never depend on sort implementation. */
function compareIds(a: string, b: string): number {
  if (a < b) {
    return -1;
  }
  return a > b ? 1 : 0;
}

/** Working record for one car as it moves through the race. */
interface Runner {
  readonly entrant: RaceEntrant;
  readonly qualifyingScore: number;
  gridPosition: number;
  raceScore: number;
  mechanicalFailure: boolean;
  driverError: boolean;
  finishPosition: number | null;
}

/**
 * Simulates one race with the v1 score-and-sort model.
 *
 * Pure and deterministic: the same field, seed, and constants always produce
 * the same result. Randomness is drawn in a fixed order — qualifying noise for
 * the whole field, then race noise, then the two DNF rolls per car, each pass
 * walking the field in the order supplied. Appending a car to the end of the
 * field therefore does not disturb anyone else's draws.
 *
 * @throws RangeError if the field is empty or contains a duplicate driver.
 */
export function simulateRace(
  field: readonly RaceEntrant[],
  rng: Rng,
  constants: RaceConstants = RACE_CONSTANTS,
): RaceResult {
  if (field.length === 0) {
    throw new RangeError("Cannot simulate a race with an empty field");
  }
  const uniqueDrivers = new Set(field.map((entrant) => entrant.driverId));
  if (uniqueDrivers.size !== field.length) {
    throw new RangeError("A driver cannot appear twice in the same field");
  }

  // --- Qualifying -----------------------------------------------------------
  const runners: Runner[] = field.map((entrant) => ({
    entrant,
    qualifyingScore:
      constants.weightCarQualifying * entrant.car.qualifying +
      constants.weightDriverQualifying * entrant.driver.qualifying +
      rng.gaussian(0, constants.qualifyingNoise),
    gridPosition: 0,
    raceScore: 0,
    mechanicalFailure: false,
    driverError: false,
    finishPosition: null,
  }));

  const grid = [...runners].sort(
    (a, b) =>
      b.qualifyingScore - a.qualifyingScore || compareIds(a.entrant.driverId, b.entrant.driverId),
  );
  grid.forEach((runner, index) => {
    runner.gridPosition = index + 1;
  });

  // --- Race pace ------------------------------------------------------------
  for (const runner of runners) {
    const { driver, car } = runner.entrant;

    const consistency =
      constants.weightCarConsistency * car.consistency +
      constants.weightDriverConsistency * driver.consistency;
    const noiseScale = lerpFromRating(
      consistency,
      constants.consistencyNoiseMultiplierAtZero,
      constants.consistencyNoiseMultiplierAtHundred,
    );

    // Grid advantage decays with distance from pole rather than falling off
    // linearly, so the front row is worth materially more than mid-grid.
    const gridBonus =
      constants.gridAdvantagePole *
      Math.exp(-(runner.gridPosition - 1) / constants.gridAdvantageDecayPlaces);

    runner.raceScore =
      constants.weightCarRacing * car.racing +
      constants.weightDriverRacing * driver.racing +
      gridBonus +
      rng.gaussian(0, constants.racingNoise * noiseScale);
  }

  // --- Retirements ----------------------------------------------------------
  for (const runner of runners) {
    const { driver, car } = runner.entrant;

    const mechanicalRisk =
      lerpFromRating(
        car.reliability,
        constants.mechanicalDnfAtZeroReliability,
        constants.mechanicalDnfAtFullReliability,
      ) * constants.mechanicalDnfEraScale;
    const errorRisk = lerpFromRating(
      driver.composure,
      constants.driverErrorDnfAtZeroComposure,
      constants.driverErrorDnfAtFullComposure,
    );

    // Both rolls always happen, so the draw count per car is fixed regardless
    // of outcome — that keeps the stream position independent of results.
    runner.mechanicalFailure = rng.next() < Math.min(Math.max(mechanicalRisk, 0), 1);
    runner.driverError = rng.next() < Math.min(Math.max(errorRisk, 0), 1);
  }

  // --- Classification -------------------------------------------------------
  const classified = runners
    .filter((runner) => !runner.mechanicalFailure && !runner.driverError)
    .sort(
      (a, b) => b.raceScore - a.raceScore || compareIds(a.entrant.driverId, b.entrant.driverId),
    );
  classified.forEach((runner, index) => {
    runner.finishPosition = index + 1;
  });

  const entries: RaceEntryResult[] = runners.map((runner) => {
    const retired = runner.mechanicalFailure || runner.driverError;
    let dnfCause: DnfCause | null = null;
    if (runner.mechanicalFailure) {
      dnfCause = "mechanical";
    } else if (runner.driverError) {
      dnfCause = "driver-error";
    }

    return {
      driverId: runner.entrant.driverId,
      teamId: runner.entrant.teamId,
      gridPosition: runner.gridPosition,
      finishPosition: runner.finishPosition,
      retired,
      dnfCause,
      mechanicalFailure: runner.mechanicalFailure,
      driverError: runner.driverError,
      qualifyingScore: runner.qualifyingScore,
      raceScore: runner.raceScore,
    };
  });

  const poleSitter = grid[0];
  if (poleSitter === undefined) {
    throw new RangeError("Cannot simulate a race with an empty field");
  }
  const winner = classified[0];

  return {
    entries,
    poleDriverId: poleSitter.entrant.driverId,
    winnerDriverId: winner?.entrant.driverId ?? null,
    retirements: runners.length - classified.length,
    classifiedCount: classified.length,
  };
}

/** The v1 model, behind the swappable `RaceModel` interface. */
export const scoreAndSortRaceModel: RaceModel = {
  name: "score-and-sort-v1",
  simulate: simulateRace,
};
