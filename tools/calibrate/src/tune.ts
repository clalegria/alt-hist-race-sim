/**
 * Rating tuner.
 *
 * Coordinate descent over the seed car and engine ratings, scored against the
 * targets in `targets.ts`. This exists so the authored JSON is derived from the
 * harness rather than guessed — run it, read the proposed ratings, and apply the
 * ones that make sense.
 *
 * It prints a diff of proposed changes; it does not write to the JSON itself.
 * A human decides what is a plausible rating and what is the optimiser chasing
 * noise.
 *
 *   pnpm --filter @alt-hist/calibrate tune
 *   pnpm --filter @alt-hist/calibrate tune -- --year 1981
 *   pnpm --filter @alt-hist/calibrate tune -- --drivers --noise
 *
 * **Cars and engines are what it moves by default.** Driver ratings are the
 * author's and whether to fit them at all is an open decision, so they need
 * `--drivers`; the noise constants are not ratings at all, so they need
 * `--noise`. Both are off unless asked for, because the failure mode of a tuner
 * is that it quietly rewrites more than you meant.
 *
 * **Engines are tuned against the same objective as cars, and that is the point
 * of them being here.** One engine knob moves every customer at once — a change
 * to `ford` in 1980 moves ten of the fifteen entries — so the engine ratings are
 * where a whole-grid effect like the retirement rate is actually reachable,
 * and the car knobs are left to say what separates one chassis from another.
 */

import { driverRatingsFor, driversById, seasonSeed } from "@alt-hist/data";
import {
  createRng,
  type EngineSpec,
  RACE_CONSTANTS,
  type RaceConstants,
  type RaceEntrant,
  simulateRace,
} from "@alt-hist/engine";
import { CALIBRATION_RATING_MODE } from "./mode.js";
import {
  type ChassisField,
  type EngineField,
  type SeasonTargets,
  share,
  targetsFor,
} from "./targets.js";
import { parseYear } from "./year.js";

const RACES_PER_EVAL = 6000;
/**
 * The season being tuned. Defaults to the earliest authored one, so an
 * invocation with no flag means exactly what it always meant.
 */
const YEAR = parseYear(process.argv);
const TUNED_SEASON = seasonSeed(YEAR);
const TARGETS: SeasonTargets = targetsFor(YEAR);

const TUNE_DRIVERS = process.argv.includes("--drivers");
const TUNE_NOISE = process.argv.includes("--noise");

/**
 * How far a rating may drift from its authored value, to preserve intent.
 *
 * Engines get a wider band than chassis. The chassis band still has to leave
 * room for the engine: a car's pace blends the two (`weightChassisPerformance`
 * in the race constants), so holding a car's pace steady while its engine moves
 * asks the chassis to move by 1 / that weight times what the engine took out.
 */
const MAX_DRIFT_CHASSIS = 12;
const MAX_DRIFT_ENGINE = 15;
const SWEEPS = 10;

type DriverField = "racing" | "qualifying";

interface Knob {
  readonly label: string;
  get(state: State): number;
  set(state: State, value: number): void;
  readonly authored: number;
  /** Candidate moves from the current value, already clamped to legal range. */
  candidates(current: number): number[];
}

/** Integer rating steps, held within `drift` of the authored value. */
function ratingCandidates(authored: number, drift: number): (current: number) => number[] {
  const low = Math.max(1, authored - drift);
  const high = Math.min(100, authored + drift);
  return (current) =>
    [-3, -2, -1, 1, 2, 3]
      .map((step) => current + step)
      .filter((value) => value >= low && value <= high);
}

/** Continuous noise steps, kept in a range that stays physically sensible. */
function noiseCandidates(low: number, high: number): (current: number) => number[] {
  return (current) =>
    [-0.5, -0.25, 0.25, 0.5]
      .map((step) => Math.round((current + step) * 100) / 100)
      .filter((value) => value >= low && value <= high);
}

interface ChassisState {
  racing: number;
  qualifying: number;
  consistency: number;
  reliability: number;
}

interface State {
  chassis: Map<string, ChassisState>;
  engines: Map<string, EngineSpec & { racing: number; qualifying: number; reliability: number }>;
  drivers: Map<string, { racing: number; qualifying: number }>;
  /** Noise constants are searched too, on `--noise` — see the note in `buildKnobs`. */
  noise: { qualifying: number; racing: number };
}

function initialState(): State {
  const chassis = new Map<string, ChassisState>();
  for (const entry of TUNED_SEASON.entries) {
    chassis.set(entry.teamId, {
      racing: entry.chassis.racing,
      qualifying: entry.chassis.qualifying,
      consistency: entry.chassis.consistency,
      reliability: entry.chassis.reliability,
    });
  }

  const engines = new Map<string, { racing: number; qualifying: number; reliability: number }>();
  for (const engine of TUNED_SEASON.engines) {
    engines.set(engine.engineId, {
      racing: engine.racing,
      qualifying: engine.qualifying,
      reliability: engine.reliability,
    });
  }

  const drivers = new Map<string, { racing: number; qualifying: number }>();
  for (const [id, driver] of driversById()) {
    // Seeded from the driver's ability *in the tuned year*, not from his peak —
    // see `mode.ts`. A tuner seeded at peak starts from a grid that never
    // existed, and every point of the difference between a driver and his own
    // prime gets fitted into the car beside him.
    const rated = driverRatingsFor(driver, YEAR, CALIBRATION_RATING_MODE);
    drivers.set(id, { racing: rated.racing, qualifying: rated.qualifying });
  }

  return {
    chassis,
    engines,
    drivers,
    noise: {
      qualifying: RACE_CONSTANTS.qualifyingNoise,
      racing: RACE_CONSTANTS.racingNoise,
    },
  };
}

function constantsFor(state: State): RaceConstants {
  return {
    ...RACE_CONSTANTS,
    qualifyingNoise: state.noise.qualifying,
    racingNoise: state.noise.racing,
  };
}

/**
 * The field as the race model will see it — engine included.
 *
 * Built here rather than through `buildField` because the whole point is to
 * race ratings that are not in the JSON yet. It must otherwise match what
 * `buildField` produces attribute for attribute, or the tuner optimises a model
 * the sim does not run. Countries are the one deliberate omission: the harness
 * measures a neutral race with no `RoundContext`, so home advantage pays
 * nothing in any of these and carrying the codes would be dead weight.
 */
function buildFieldFrom(state: State): RaceEntrant[] {
  const pool = driversById();
  const field: RaceEntrant[] = [];

  for (const entry of TUNED_SEASON.entries) {
    const chassis = state.chassis.get(entry.teamId);
    if (chassis === undefined) {
      throw new Error(`No chassis state for ${entry.teamId}`);
    }
    const engine = state.engines.get(entry.engineId);
    if (engine === undefined) {
      throw new Error(`No engine state for ${entry.engineId}`);
    }
    for (const driverId of entry.drivers) {
      const authored = pool.get(driverId);
      const tuned = state.drivers.get(driverId);
      if (authored === undefined || tuned === undefined) {
        throw new Error(`No driver state for ${driverId}`);
      }
      const rated = driverRatingsFor(authored, YEAR, CALIBRATION_RATING_MODE);
      field.push({
        driverId,
        teamId: entry.teamId,
        driver: {
          racing: tuned.racing,
          qualifying: tuned.qualifying,
          // The four the tuner does not move still have to be the ones the sim
          // would race in this year, or `buildFieldFrom` stops matching
          // `buildField` and the tuner optimises a model nothing runs.
          consistency: rated.consistency,
          adaptability: rated.adaptability,
          composure: rated.composure,
          wetWeather: rated.wetWeather,
        },
        chassis,
        engineId: entry.engineId,
        engine,
      });
    }
  }
  return field;
}

interface Outcome {
  teamWins: Map<string, number>;
  teamPoles: Map<string, number>;
  driverWins: Map<string, number>;
  retirementRate: number;
}

function run(
  field: readonly RaceEntrant[],
  races: number,
  constants: RaceConstants = RACE_CONSTANTS,
): Outcome {
  const teamWins = new Map<string, number>();
  const teamPoles = new Map<string, number>();
  const driverWins = new Map<string, number>();
  let retirements = 0;
  let starters = 0;

  const teamOf = new Map(field.map((e) => [e.driverId, e.teamId]));

  for (let seed = 1; seed <= races; seed += 1) {
    const result = simulateRace(field, createRng(seed), constants);
    retirements += result.retirements;
    starters += field.length - result.nonQualifiers;

    const winner = result.winnerDriverId;
    if (winner !== null) {
      driverWins.set(winner, (driverWins.get(winner) ?? 0) + 1);
      const team = teamOf.get(winner);
      if (team !== undefined) {
        teamWins.set(team, (teamWins.get(team) ?? 0) + 1);
      }
    }
    const poleTeam = teamOf.get(result.poleDriverId);
    if (poleTeam !== undefined) {
      teamPoles.set(poleTeam, (teamPoles.get(poleTeam) ?? 0) + 1);
    }
  }

  return {
    teamWins,
    teamPoles,
    driverWins,
    retirementRate: retirements / starters,
  };
}

const WEIGHT_TEAM_WINS = 1.0;
const WEIGHT_TEAM_POLES = 0.35;
const WEIGHT_DRIVER_WINS = 0.5;
const WEIGHT_RETIREMENTS = 2.0;

function error(state: State, races = RACES_PER_EVAL): number {
  const field = buildFieldFrom(state);
  const outcome = run(field, races, constantsFor(state));
  const teamIds = new Set(field.map((e) => e.teamId));
  const driverIds = new Set(field.map((e) => e.driverId));

  let total = 0;

  for (const teamId of teamIds) {
    const actual = (outcome.teamWins.get(teamId) ?? 0) / races;
    total += WEIGHT_TEAM_WINS * (actual - share(TARGETS, TARGETS.teamWins, teamId)) ** 2;

    const poleActual = (outcome.teamPoles.get(teamId) ?? 0) / races;
    total += WEIGHT_TEAM_POLES * (poleActual - share(TARGETS, TARGETS.teamPoles, teamId)) ** 2;
  }

  for (const driverId of driverIds) {
    const actual = (outcome.driverWins.get(driverId) ?? 0) / races;
    // Driver targets come from a 14- or 15-race sample; weight them gently. With
    // driver knobs off they are mostly a constant offset — the car cannot decide
    // which of its two drivers wins — but they still separate a season whose wins
    // fall to the right cars from one where the right team wins with the wrong man.
    total += WEIGHT_DRIVER_WINS * (actual - share(TARGETS, TARGETS.driverWins, driverId)) ** 2;
  }

  total += WEIGHT_RETIREMENTS * (outcome.retirementRate - TARGETS.retirementRate) ** 2;
  return total;
}

function buildKnobs(state: State): Knob[] {
  const knobs: Knob[] = [];

  // Only the chassis that contended. Tuning the tail would be fitting noise:
  // those cars never win regardless of where in range their rating sits.
  for (const [teamId, fields] of TARGETS.tunedChassis) {
    for (const field of fields as readonly ChassisField[]) {
      const authored = state.chassis.get(teamId)?.[field] ?? 0;
      knobs.push({
        label: `chassis ${teamId}.${field}`,
        authored,
        candidates: ratingCandidates(authored, MAX_DRIFT_CHASSIS),
        get: (s) => s.chassis.get(teamId)?.[field] ?? 0,
        set: (s, value) => {
          const tub = s.chassis.get(teamId);
          if (tub !== undefined) {
            tub[field] = value;
          }
        },
      });
    }
  }

  // Every engine the season rates, on all three attributes. Unlike a chassis there is
  // no tail to leave alone: an engine nobody at the front runs is still in ten
  // cars at the back, and those cars are most of the retirement rate.
  const engineFields: readonly EngineField[] = ["racing", "qualifying", "reliability"];
  for (const engine of TUNED_SEASON.engines) {
    for (const field of engineFields) {
      const authored = state.engines.get(engine.engineId)?.[field] ?? 0;
      knobs.push({
        label: `engine ${engine.engineId}.${field}`,
        authored,
        candidates: ratingCandidates(authored, MAX_DRIFT_ENGINE),
        get: (s) => s.engines.get(engine.engineId)?.[field] ?? 0,
        set: (s, value) => {
          const unit = s.engines.get(engine.engineId);
          if (unit !== undefined) {
            unit[field] = value;
          }
        },
      });
    }
  }

  // Driver ratings are the author's, and whether to fit them against a season
  // most of this grid peaks after is an open decision. Opt in, never default.
  if (TUNE_DRIVERS) {
    for (const [driverId, fields] of TARGETS.tunedDrivers) {
      for (const field of fields as readonly DriverField[]) {
        const authored = state.drivers.get(driverId)?.[field] ?? 0;
        knobs.push({
          label: `driver ${driverId}.${field}`,
          authored,
          candidates: ratingCandidates(authored, MAX_DRIFT_CHASSIS),
          get: (s) => s.drivers.get(driverId)?.[field] ?? 0,
          set: (s, value) => {
            const driver = s.drivers.get(driverId);
            if (driver !== undefined) {
              driver[field] = value;
            }
          },
        });
      }
    }
  }

  // The noise constants can be searched alongside the ratings. v1 has no track
  // model, so circuit-to-circuit character — a power track suiting the Renault
  // turbo, a tight one suiting the Cosworths — has nowhere to live except the
  // noise term. If the search wants more noise, that is the missing dimension
  // asking for room, not a data problem. Opt in: these are constants, not
  // ratings, and they are shared by every season rather than owned by this one.
  if (TUNE_NOISE) {
    knobs.push({
      label: "const qualifyingNoise",
      authored: RACE_CONSTANTS.qualifyingNoise,
      candidates: noiseCandidates(1.5, 8),
      get: (s) => s.noise.qualifying,
      set: (s, value) => {
        s.noise.qualifying = value;
      },
    });
    knobs.push({
      label: "const racingNoise",
      authored: RACE_CONSTANTS.racingNoise,
      candidates: noiseCandidates(2, 10),
      get: (s) => s.noise.racing,
      set: (s, value) => {
        s.noise.racing = value;
      },
    });
  }

  return knobs;
}

function main(): void {
  const state = initialState();
  const knobs = buildKnobs(state);

  console.log(
    `tuning ${YEAR}: ${knobs.length} knobs` +
      `${TUNE_DRIVERS ? " (+drivers)" : ""}${TUNE_NOISE ? " (+noise)" : ""}`,
  );

  let best = error(state);
  console.log(`start error ${best.toFixed(5)}`);

  for (let sweep = 0; sweep < SWEEPS; sweep += 1) {
    let improved = false;
    for (const knob of knobs) {
      // A proper line search per coordinate: try every candidate, keep the best
      // one, and only then commit.
      //
      // The obvious shape — accept as you go, revert otherwise — is wrong, and
      // was wrong here for a long time: reverting restores the value the knob
      // had *before the sweep*, so an improvement accepted at candidate 1 is
      // silently thrown away by a rejection at candidate 2 while `best` keeps
      // the improved score. State and score then disagree, nothing can beat the
      // stale `best`, and the descent stalls after a single sweep. It did:
      // every run of this tool stopped at sweep 2 having moved almost nothing.
      let bestValue = knob.get(state);
      let bestScore = best;

      for (const candidate of knob.candidates(bestValue)) {
        if (candidate === bestValue) {
          continue;
        }
        knob.set(state, candidate);
        const score = error(state);
        if (score < bestScore) {
          bestScore = score;
          bestValue = candidate;
        }
      }

      knob.set(state, bestValue);
      if (bestScore < best) {
        best = bestScore;
        improved = true;
      }
    }
    console.log(`sweep ${sweep + 1}: error ${best.toFixed(5)}`);
    if (!improved) {
      break;
    }
  }

  console.log("\nproposed changes (authored -> tuned):");
  for (const knob of knobs) {
    const value = knob.get(state);
    if (value !== knob.authored) {
      console.log(`  ${knob.label.padEnd(30)} ${knob.authored} -> ${value}`);
    }
  }

  const outcome = run(buildFieldFrom(state), 10_000, constantsFor(state));
  console.log("\nresulting shares (10000 races):");
  const teams = [...new Set(TUNED_SEASON.entries.map((e) => e.teamId))];
  for (const teamId of teams) {
    const wins = ((outcome.teamWins.get(teamId) ?? 0) / 10_000) * 100;
    const poles = ((outcome.teamPoles.get(teamId) ?? 0) / 10_000) * 100;
    if (wins > 0.05 || poles > 0.05) {
      console.log(
        `  ${teamId.padEnd(12)} win ${wins.toFixed(1).padStart(5)}%  ` +
          `(target ${(share(TARGETS, TARGETS.teamWins, teamId) * 100).toFixed(1)}%)   ` +
          `pole ${poles.toFixed(1).padStart(5)}%  ` +
          `(target ${(share(TARGETS, TARGETS.teamPoles, teamId) * 100).toFixed(1)}%)`,
      );
    }
  }
  console.log(
    `  retirement rate ${(outcome.retirementRate * 100).toFixed(1)}% ` +
      `(target ${(TARGETS.retirementRate * 100).toFixed(1)}%)`,
  );
}

main();
