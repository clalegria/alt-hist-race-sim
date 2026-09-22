import type { CarSpec, DriverRatings } from "../model/ratings.js";
import type { Rng } from "../rng/types.js";
import { rollWeather, wetConstants, wetDriver } from "../weather/weather.js";
import { driverErrorRisk } from "./composure.js";
import { RACE_CONSTANTS, type RaceConstants } from "./constants.js";
import { developedCar } from "./development.js";
import { qualifyingGapSeconds, raceGap } from "./gaps.js";
import { homeAdvantage, homeAllegiances } from "./home.js";
import { powertrain } from "./powertrain.js";
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
 * The standard normal CDF, to about seven decimal places.
 *
 * Abramowitz & Stegun 7.1.26 on `erf`, inlined rather than taken from a
 * dependency because the engine has none and is not about to acquire one for
 * six lines of arithmetic. Its only job is to turn a correlated normal draw
 * back into a uniform, so that a car's mechanical failure can be correlated
 * with its teammate's without disturbing its own failure *rate* — see
 * `mechanicalDnfTeamCorrelation`. Accuracy well beyond what a probability
 * compared against a rating-derived risk needs.
 */
function normalCdf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * z);
  const poly =
    t *
    (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-z * z);
  return 0.5 * (1 + sign * erf);
}

/** Deterministic tie-break, so equal scores never depend on sort implementation. */
function compareIds(a: string, b: string): number {
  if (a < b) {
    return -1;
  }
  return a > b ? 1 : 0;
}

/**
 * What a team draws once per weekend, shared by every car it enters: its form,
 * its luck in each session, and how fragile its car is that day.
 */
interface TeamDraws {
  readonly form: number;
  readonly qualifyingLuck: number;
  readonly raceLuck: number;
  readonly fragility: number;
}

/** Working record for one car as it moves through the race weekend. */
interface Runner {
  readonly entrant: RaceEntrant;
  /**
   * The ratings this driver actually raced on. The entrant's own in the dry;
   * in the wet, blended toward their `wetWeather` rating in proportion to how
   * wet it was — see `weather/weather.ts`.
   */
  readonly driver: DriverRatings;
  /** Chassis and engine blended into one car — what every score below reads. */
  readonly car: CarSpec;
  /** This car's own standard-normal form for the weekend, shared by both sessions. */
  readonly carForm: number;
  /** Everything its team drew for the weekend, shared with the other side of the garage. */
  readonly team: TeamDraws;
  /** Spread multiplier for the team's shared terms, from the car's consistency. */
  readonly teamNoiseScale: number;
  /** Spread multiplier for this entry's own terms, from the driver's consistency. */
  readonly carNoiseScale: number;
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
 * Each car is scored on its chassis and engine blended together — see
 * `powertrain()` — so a team that changed supplier is a different car. An
 * entrant with no engine is scored on its chassis alone.
 *
 * A car with a `developmentTrend` is then scored at the pace it held *at this
 * point in its season*, which `round.seasonProgress` supplies — see
 * `development.ts`. A round that does not say when it is, which is every lone
 * race, is mid-season: every trend is worth nothing there.
 *
 * `round` says where the race is being held, which is what turns home advantage
 * on for the drivers and teams from that country. It defaults to a round with no
 * host country — a neutral race, scored exactly as it was before the term
 * existed — so nothing that does not know its calendar is affected. It draws no
 * randomness either way, so the RNG stream is identical with and without it.
 *
 * The first thing the round does is roll its weather. About one race in seven
 * is declared wet, and a wet one is scored on derived constants — wider noise,
 * far more driver error, and a score leaning further onto the driver and the
 * chassis — with each driver blended toward their `wetWeather` rating in
 * proportion to how wet it was. A `RoundContext` may force a particular
 * afternoon, and will one day say how likely rain is *here*. The weather is
 * reported back on the result, because a classification has to say it rained.
 *
 * Pure and deterministic: the same field, seed, and constants always produce
 * the same result. Randomness is drawn in a fixed order — the weather, then
 * weekend form and
 * qualifying noise for the whole field, then race noise, then the two DNF rolls
 * per car, each pass walking the field in the order supplied. Every pass draws a
 * fixed number of values per car *whether or not that car started*, so appending
 * a car to the end of the field, or missing the cut, never disturbs anyone
 * else's draws. The weather pass draws its two values whether it rains or not,
 * and before everything else, for the same reason.
 *
 * @throws RangeError if the field is empty or contains a duplicate driver.
 */
export function simulateRace(
  field: readonly RaceEntrant[],
  rng: Rng,
  raceConstants: RaceConstants = RACE_CONSTANTS,
  round: RoundContext = {},
): RaceResult {
  if (field.length === 0) {
    throw new RangeError("Cannot simulate a race with an empty field");
  }
  const uniqueDrivers = new Set(field.map((entrant) => entrant.driverId));
  if (uniqueDrivers.size !== field.length) {
    throw new RangeError("A driver cannot appear twice in the same field");
  }

  // The first thing that happens, before a single car is scored: the weather.
  // It is rolled whether or not the round already carries one, so a forced
  // afternoon costs nobody their place in the stream, and it comes first so
  // that adding weather to a field cannot reorder the draws inside it.
  const rolled = rollWeather(rng, undefined, round.wetChance);
  const weather = round.weather ?? rolled;
  // Everything below reads `constants`, which on a wet afternoon is a derived
  // copy: wider noise, harsher retirements, and the score leaning further onto
  // the driver and the chassis. A dry one is the constants object itself.
  const constants = wetConstants(weather, raceConstants);

  // Each session's noise is split on two independent axes at once: how much of
  // it carries from Saturday to Sunday (`weekendFormShare`), and how much of it
  // belongs to the team rather than to the individual car (`teamFormShare`).
  // Crossing them gives four draws, weighted by the square roots of the four
  // products — square roots because variances, not standard deviations, add,
  // and the four products sum to 1, so the total sigma is exactly what the
  // constants say however either share moves.
  //
  // The team half is much the larger, and that is the point: what swings a
  // car's level between weekends mostly belongs to the garage, so it moves both
  // of its cars together and cannot decide which one finishes ahead. Both team
  // terms cancel out of a teammate comparison, which is what leaves that battle
  // to the ratings while the spread across the field is untouched.
  const weekendShare = Math.min(Math.max(constants.weekendFormShare, 0), 1);
  const teamShare = Math.min(Math.max(constants.teamFormShare, 0), 1);
  const boost = Math.max(constants.teamFormBoost, 0);
  const teamWeekendWeight = Math.sqrt(weekendShare * teamShare) * boost;
  const carWeekendWeight = Math.sqrt(weekendShare * (1 - teamShare));
  const teamSessionWeight = Math.sqrt((1 - weekendShare) * teamShare) * boost;
  const carSessionWeight = Math.sqrt((1 - weekendShare) * (1 - teamShare));

  // What a team draws once per weekend and both its cars read: its form, its
  // luck in each of the two sessions, and how fragile its car is today. Taken
  // lazily, at the first car of each team in field order, so that appending an
  // entrant cannot shift anyone already in the field along the RNG stream.
  const teamDraws = new Map<string, TeamDraws>();
  const drawsFor = (teamId: string): TeamDraws => {
    const existing = teamDraws.get(teamId);
    if (existing !== undefined) {
      return existing;
    }
    const fresh: TeamDraws = {
      form: rng.gaussian(),
      qualifyingLuck: rng.gaussian(),
      raceLuck: rng.gaussian(),
      fragility: rng.gaussian(),
    };
    teamDraws.set(teamId, fresh);
    return fresh;
  };

  // --- Qualifying -----------------------------------------------------------
  const runners: Runner[] = field.map((entrant) => {
    // Who this driver is when it rains. Unchanged in the dry, and unchanged in
    // the wet for the majority of the pool whose wet rating matches their dry
    // one — the blend exists for the exceptions.
    const driver = wetDriver(entrant.driver, weather);
    // Blended once, here, rather than at each of the three places a car rating
    // is read: the engine is part of what the car *is* for this weekend — and
    // so is where in the season the weekend falls, for a car whose year had a
    // shape to it. A field with no development trends, or a round that does not
    // say when it is, gets the blend back unchanged.
    const car = developedCar(
      powertrain(entrant.chassis, entrant.engine, constants),
      entrant.developmentTrend,
      round.seasonProgress,
      constants,
    );

    // Consistency modulates the spread on both axes, but each half reads the
    // rating that owns it. The team's form belongs to the car, so the *car's*
    // consistency scales it and both sides of the garage get the same number —
    // which is what makes the team terms cancel exactly out of a teammate
    // comparison. The entry's own scatter belongs to whoever is driving it, so
    // the *driver's* consistency scales that. Scaling everything by one blended
    // figure, as this did before, quietly leaked the driver's consistency into
    // the team's weekend and let two teammates experience different team form.
    const teamNoiseScale = lerpFromRating(
      car.consistency,
      constants.consistencyNoiseMultiplierAtZero,
      constants.consistencyNoiseMultiplierAtHundred,
    );
    const carNoiseScale = lerpFromRating(
      driver.consistency,
      constants.consistencyNoiseMultiplierAtZero,
      constants.consistencyNoiseMultiplierAtHundred,
    );
    // The pace penalty is a shift in the mean, owed jointly by an erratic
    // driver and a car that will not repeat itself — so it is the sum of what
    // each side owes, weighted by the same two shares as before. Each side is
    // interpolated down its *own* span to the shared floor, rather than both
    // being read off one line through the blended rating: that lets the driver's
    // consistency be priced more steeply than the car's without touching the
    // car's half at all. Set the two spans equal and this is exactly the single
    // blended interpolation it replaced.
    const pacePenalty =
      constants.weightCarConsistency *
        lerpFromRating(
          car.consistency,
          constants.carConsistencyPacePenaltyAtZero,
          constants.consistencyPacePenaltyAtHundred,
        ) +
      constants.weightDriverConsistency *
        lerpFromRating(
          driver.consistency,
          constants.driverConsistencyPacePenaltyAtZero,
          constants.consistencyPacePenaltyAtHundred,
        );

    // Both form draws are made once and carried into the race, so a team that
    // brought a working car has it on Saturday and Sunday, and a driver who is
    // on it all weekend qualifies and races well.
    const team = drawsFor(entrant.teamId);
    const carForm = rng.gaussian();
    const qualifyingNoise =
      constants.qualifyingNoise *
      (teamNoiseScale * (teamWeekendWeight * team.form + teamSessionWeight * team.qualifyingLuck) +
        carNoiseScale * (carWeekendWeight * carForm + carSessionWeight * rng.gaussian()));

    // Where the race is, not who is in it: the same number is added to both
    // sessions, so a home crowd is worth as much on Saturday as on Sunday.
    const homeBonus = homeAdvantage(homeAllegiances(entrant, round), constants);

    return {
      entrant,
      driver,
      car,
      carForm,
      team,
      teamNoiseScale,
      carNoiseScale,
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
    const { driver, car } = runner;

    // Grid advantage decays with distance from pole rather than falling off
    // linearly, so the front row is worth materially more than mid-grid.
    const gridBonus =
      constants.gridAdvantagePole *
      Math.exp(-(runner.gridPosition - 1) / constants.gridAdvantageDecayPlaces);

    const racingNoise =
      constants.racingNoise *
      (runner.teamNoiseScale *
        (teamWeekendWeight * runner.team.form + teamSessionWeight * runner.team.raceLuck) +
        runner.carNoiseScale *
          (carWeekendWeight * runner.carForm + carSessionWeight * rng.gaussian()));

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
    const { driver, car } = runner;

    const mechanicalRisk =
      lerpFromRating(
        car.reliability,
        constants.mechanicalDnfAtZeroReliability,
        constants.mechanicalDnfAtFullReliability,
      ) * constants.mechanicalDnfEraScale;
    // Not a plain interpolation across the rating scale: the line is rotated
    // about `composureSpreadPivot` so that composure separates drivers by more
    // than a field's narrow band of it would otherwise allow. See
    // `composure.ts` — and note it returns an already-clamped probability,
    // because the rotation is allowed to run past both anchors.
    const errorRisk = driverErrorRisk(driver.composure, constants);

    // The mechanical roll is drawn partly off the team's fragility for the
    // weekend and partly off this car's own luck, then pushed back through the
    // normal CDF into a uniform. That last step is what makes the correlation
    // free: the result is still uniform on [0, 1), so comparing it against the
    // risk leaves this car's failure *rate* exactly what its reliability says,
    // and only changes how often it fails on the same afternoon as its
    // teammate. A correlation of 0 reduces to an independent uniform.
    const correlation = Math.min(Math.max(constants.mechanicalDnfTeamCorrelation, 0), 1);
    const fragility =
      Math.sqrt(correlation) * runner.team.fragility + Math.sqrt(1 - correlation) * rng.gaussian();

    // Both rolls always happen, for every car including the ones that did not
    // qualify, so the draw count per car is fixed regardless of outcome — that
    // keeps the stream position independent of results.
    const mechanicalFailure = normalCdf(fragility) < Math.min(Math.max(mechanicalRisk, 0), 1);
    // Driver error stays independent: it belongs to the driver, not the car,
    // and two drivers do not spin in sympathy.
    const driverError = rng.next() < errorRisk;
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
    weather,
  };
}

/** The v1 model, behind the swappable `RaceModel` interface. */
export const scoreAndSortRaceModel: RaceModel = {
  name: "score-and-sort-v1",
  simulate: simulateRace,
};
