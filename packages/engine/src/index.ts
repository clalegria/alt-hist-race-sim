/**
 * @alt-hist/engine — pure simulation core.
 *
 * This package imports nothing outside itself and performs no I/O: no `fetch`,
 * no file reads, no `Date.now()`, no `Math.random()`. Inputs in, results out.
 */

/** Package version marker, used to prove the toolchain runs end to end. */
export const ENGINE_NAME = "alt-hist-race-sim engine";

/** The season the simulation starts from before any divergence. */
export const SEED_SEASON = 1980;

export type { CarSpec, DriverRatings } from "./model/index.js";
export { RACE_CONSTANTS, type RaceConstants } from "./race/constants.js";
export { qualifyingGapSeconds, raceGap } from "./race/gaps.js";
export { scoreAndSortRaceModel, simulateRace } from "./race/simulateRace.js";
export type {
  DnfCause,
  RaceEntrant,
  RaceEntryResult,
  RaceGap,
  RaceModel,
  RaceResult,
} from "./race/types.js";
export { createRng, createRngFromSource, createRngFromState } from "./rng/index.js";
export type { Rng, RngSource, RngState } from "./rng/types.js";
export { SEASON_CONSTANTS, type SeasonConstants } from "./season/constants.js";
export { simulateSeason } from "./season/simulateSeason.js";
export {
  championshipStandings,
  constructorStandings,
  pointsForPosition,
} from "./season/standings.js";
export type { ConstructorStanding, DriverStanding, SeasonResult } from "./season/types.js";
