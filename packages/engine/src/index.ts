/**
 * @alt-hist/engine — pure simulation core.
 *
 * This package imports nothing outside itself and performs no I/O: no `fetch`,
 * no file reads, no `Date.now()`, no `Math.random()`. Inputs in, results out.
 */

export type { CarSpec, ChassisSpec, DriverRatings, EngineSpec } from "./model/index.js";
export {
  type AbilityAnchor,
  AGEING_CONSTANTS,
  type AgeingConstants,
  type AttributeSensitivity,
  CANONICAL_ABILITY,
  type CanonicalAges,
  canonicalAbility,
  canonicalAge,
  type DriverCareer,
  type OffSeason,
  type PeakWindow,
  peakWindow,
  ratingsForSeason,
  type StepDown,
  seasonDeficits,
} from "./progression/index.js";
export { RACE_CONSTANTS, type RaceConstants } from "./race/constants.js";
export {
  DEVELOPMENT_TREND_LIMIT,
  developedCar,
  developmentSwing,
  MID_SEASON_PROGRESS,
  seasonProgress,
} from "./race/development.js";
export { qualifyingGapSeconds, raceGap } from "./race/gaps.js";
export { powertrain } from "./race/powertrain.js";
export {
  DEFAULT_RANDOMNESS_LEVEL,
  parseRandomnessLevel,
  RANDOMNESS_LEVELS,
  type RandomnessLevel,
  randomnessNoiseScale,
  randomnessTeamFormBoost,
  withRandomness,
} from "./race/randomness.js";
export {
  DEFAULT_RETIREMENT_FACTOR,
  parseRetirementFactor,
  RETIREMENT_FACTORS,
  type RetirementFactor,
  retirementScale,
  withRetirementFactor,
} from "./race/retirement.js";
export { scoreAndSortRaceModel, simulateRace } from "./race/simulateRace.js";
export type {
  DnfCause,
  RaceEntrant,
  RaceEntryResult,
  RaceGap,
  RaceModel,
  RaceResult,
  RoundContext,
} from "./race/types.js";
export { createRng, createRngFromSource, createRngFromState } from "./rng/index.js";
export type { Rng, RngSource, RngState } from "./rng/types.js";
export { simulateSeason } from "./season/simulateSeason.js";
export {
  championshipStandings,
  constructorStandings,
  pointsForPosition,
} from "./season/standings.js";
export {
  bestPossibleRound,
  constructorsTitleClinchedBy,
  driversTitleClinchedBy,
  titleClinchedBy,
} from "./season/titles.js";
export type {
  ConstructorStanding,
  DriverStanding,
  PointsScale,
  SeasonResult,
} from "./season/types.js";
export {
  DRY,
  type RaceWeather,
  rollWeather,
  WEATHER_CONSTANTS,
  type WeatherConstants,
  wetConstants,
  wetDriver,
} from "./weather/index.js";
