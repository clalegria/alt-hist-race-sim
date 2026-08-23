import type { Rng } from "../rng/types.js";
import { RACE_CONSTANTS, type RaceConstants } from "./constants.js";
import { qualifyingGapSeconds, raceGap } from "./gaps.js";
import type {
  DnfCause,
  RaceEntrant,
  RaceEntryResult,
  RaceModel,
  RaceResult,
  RoundContext,
} from "./types.js";

/** Linear interpolation from `atZero` to `atHundred` across a 0-100 rating. */
function lerpFromRating(rating: number, atZero: number, atHundred: number): number {
  const t = Math.min(Math.max(rating, 0), 100) / 100;
  return atZero + (atHundred - atZero) * t;
}

/**
 * Whether two country codes are the same place. Case- and padding-insensitive,
 * and an absent code is nowhere: a field with no countries is never at home.
 */
function sameCountry(a: string | undefined, b: string | undefined): boolean {
  if (a === undefined || b === undefined) {
    return false;
  }
  const left = a.trim().toUpperCase();
  return left !== "" && left === b.trim().toUpperCase();
}

/**
 * Rating points a car collects for racing at home, added to both sessions.
 *
 * The driver's country and the team's are counted separately and stack, so an
 * Italian in a Ferrari at Monza gets both halves and a Brazilian in the same
 * car gets one. A round with no host country hands out nothing.
 */
function homeAdvantage(
  entrant: RaceEntrant,
  round: RoundContext,
  constants: RaceConstants,
): number {
  const driverAtHome = sameCountry(entrant.driverCountry, round.country);
  const teamAtHome = sameCountry(entrant.teamCountry, round.country);
  return (
    (driverAtHome ? constants.homeAdvantageDriver : 0) +
    (teamAtHome ? constants.homeAdvantageTeam : 0)
  );
}

/** Deterministic tie-break, so equal scores never depend on sort implementation. */
function compareIds(a: string, b: string): number {
  if (a < b) {
    return -1;
  }
  return a > b ? 1 : 0;
}

/** Working record for one car as it moves through the race weekend. */
interface Runner {
  readonly entrant: RaceEntrant;
  /** Standard-normal form for this weekend, shared by both sessions. */
  readonly weekendForm: number;
  readonly noiseScale: number;
  readonly pacePenalty: number;
  /** Rating points for racing at home, in both sessions. Usually 0. */
  readonly homeBonus: number;
  readonly qualifyingScore: number;
  gridPosition: number;
  started: boolean;
  raceScore: number | null;
  mechanicalFailure: boolean;
  driverError: boolean;
  finishPosition: number | null;
}

/**
 * Simulates one race with the v1 score-and-sort model.
 *
 * The whole field qualifies; only the fastest `maxStarters` of them take the
 * start. Anyone slower is a non-qualifier — ranked on the grid, absent from the
 * race.
 *
 * `round` says where the race is being held, which is what turns home advantage
 * on for the drivers and teams from that country. It defaults to a round with no
 * host country — a neutral race, scored exactly as it was before the term
 * existed — so nothing that does not know its calendar is affected. It draws no
 * randomness either way, so the RNG stream is identical with and without it.
 *
 * Pure and deterministic: the same field, seed, and constants always produce
 * the same result. Randomness is drawn in a fixed order — weekend form and
 * qualifying noise for the whole field, then race noise, then the two DNF rolls
 * per car, each pass walking the field in the order supplied. Every pass draws a
 * fixed number of values per car *whether or not that car started*, so appending
 * a car to the end of the field, or missing the cut, never disturbs anyone
 * else's draws.
 *
 * @throws RangeError if the field is empty or contains a duplicate driver.
 */
export function simulateRace(
  field: readonly RaceEntrant[],
  rng: Rng,
  constants: RaceConstants = RACE_CONSTANTS,
  round: RoundContext = {},
): RaceResult {
  if (field.length === 0) {
    throw new RangeError("Cannot simulate a race with an empty field");
  }
  const uniqueDrivers = new Set(field.map((entrant) => entrant.driverId));
  if (uniqueDrivers.size !== field.length) {
    throw new RangeError("A driver cannot appear twice in the same field");
  }

  // Splitting each session's noise into a shared and an independent part keeps
  // the per-session sigma unchanged while making the two correlate: the weights
  // are square roots because variances, not standard deviations, add.
  const share = Math.min(Math.max(constants.weekendFormShare, 0), 1);
  const sharedWeight = Math.sqrt(share);
  const independentWeight = Math.sqrt(1 - share);

  // --- Qualifying -----------------------------------------------------------
  const runners: Runner[] = field.map((entrant) => {
    const { driver, car } = entrant;

    const consistency =
      constants.weightCarConsistency * car.consistency +
      constants.weightDriverConsistency * driver.consistency;
    const noiseScale = lerpFromRating(
      consistency,
      constants.consistencyNoiseMultiplierAtZero,
      constants.consistencyNoiseMultiplierAtHundred,
    );
    const pacePenalty = lerpFromRating(
      consistency,
      constants.consistencyPacePenaltyAtZero,
      constants.consistencyPacePenaltyAtHundred,
    );

    // Drawn once and carried into the race, so a driver who is on it all
    // weekend qualifies and races well, and one who never gels does neither.
    const weekendForm = rng.gaussian();
    const qualifyingNoise =
      constants.qualifyingNoise *
      noiseScale *
      (sharedWeight * weekendForm + independentWeight * rng.gaussian());

    // Where the race is, not who is in it: the same number is added to both
    // sessions, so a home crowd is worth as much on Saturday as on Sunday.
    const homeBonus = homeAdvantage(entrant, round, constants);

    return {
      entrant,
      weekendForm,
      noiseScale,
      pacePenalty,
      homeBonus,
      qualifyingScore:
        constants.weightCarQualifying * car.qualifying +
        constants.weightDriverQualifying * driver.qualifying +
        homeBonus +
        qualifyingNoise -
        pacePenalty,
      gridPosition: 0,
      started: true,
      raceScore: null,
      mechanicalFailure: false,
      driverError: false,
      finishPosition: null,
    };
  });

  const grid = [...runners].sort(
    (a, b) =>
      b.qualifyingScore - a.qualifyingScore || compareIds(a.entrant.driverId, b.entrant.driverId),
  );
  const maxStarters = Math.max(1, Math.floor(constants.maxStarters));
  grid.forEach((runner, index) => {
    runner.gridPosition = index + 1;
    // Qualifying is the only thing standing between an entry and the race.
    runner.started = index < maxStarters;
  });

  // --- Race pace ------------------------------------------------------------
  for (const runner of runners) {
    const { driver, car } = runner.entrant;

    // Grid advantage decays with distance from pole rather than falling off
    // linearly, so the front row is worth materially more than mid-grid.
    const gridBonus =
      constants.gridAdvantagePole *
      Math.exp(-(runner.gridPosition - 1) / constants.gridAdvantageDecayPlaces);

    const racingNoise =
      constants.racingNoise *
      runner.noiseScale *
      (sharedWeight * runner.weekendForm + independentWeight * rng.gaussian());

    // A non-qualifier draws its noise and throws it away. Skipping the draw
    // would make every later car's stream position depend on who made the cut.
    if (!runner.started) {
      continue;
    }

    runner.raceScore =
      constants.weightCarRacing * car.racing +
      constants.weightDriverRacing * driver.racing +
      gridBonus +
      runner.homeBonus +
      racingNoise -
      runner.pacePenalty;
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

    // Both rolls always happen, for every car including the ones that did not
    // qualify, so the draw count per car is fixed regardless of outcome — that
    // keeps the stream position independent of results.
    const mechanicalFailure = rng.next() < Math.min(Math.max(mechanicalRisk, 0), 1);
    const driverError = rng.next() < Math.min(Math.max(errorRisk, 0), 1);
    if (!runner.started) {
      continue;
    }

    runner.mechanicalFailure = mechanicalFailure;
    runner.driverError = driverError;
  }

  // --- Classification -------------------------------------------------------
  const classified = runners
    .filter((runner) => runner.started && !runner.mechanicalFailure && !runner.driverError)
    .sort(
      (a, b) =>
        (b.raceScore ?? 0) - (a.raceScore ?? 0) ||
        compareIds(a.entrant.driverId, b.entrant.driverId),
    );
  classified.forEach((runner, index) => {
    runner.finishPosition = index + 1;
  });

  const poleSitter = grid[0];
  if (poleSitter === undefined) {
    throw new RangeError("Cannot simulate a race with an empty field");
  }
  const winner = classified[0];

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
      started: runner.started,
      finishPosition: runner.finishPosition,
      retired,
      dnfCause,
      mechanicalFailure: runner.mechanicalFailure,
      driverError: runner.driverError,
      qualifyingScore: runner.qualifyingScore,
      raceScore: runner.raceScore,
      qualifyingGapToPole: qualifyingGapSeconds(
        poleSitter.qualifyingScore,
        runner.qualifyingScore,
        constants,
      ),
      // Only a classified finisher has a gap. A retirement stopped and a
      // non-qualifier never started, and neither is "n seconds behind".
      raceGapToWinner:
        winner === undefined || runner.finishPosition === null || runner.raceScore === null
          ? null
          : raceGap(winner.raceScore ?? 0, runner.raceScore, constants),
    };
  });

  const starters = Math.min(runners.length, maxStarters);

  return {
    entries,
    poleDriverId: poleSitter.entrant.driverId,
    winnerDriverId: winner?.entrant.driverId ?? null,
    retirements: starters - classified.length,
    classifiedCount: classified.length,
    nonQualifiers: runners.length - starters,
  };
}

/** The v1 model, behind the swappable `RaceModel` interface. */
export const scoreAndSortRaceModel: RaceModel = {
  name: "score-and-sort-v1",
  simulate: simulateRace,
};
