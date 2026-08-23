/**
 * Rating tuner.
 *
 * Coordinate descent over the seed car and driver ratings, scored against the
 * 1980 targets in `targets.ts`. This exists so the authored JSON is derived
 * from the harness rather than guessed — run it, read the proposed ratings,
 * and apply the ones that make sense.
 *
 * It prints a diff of proposed changes; it does not write to the JSON itself.
 * A human decides what is a plausible rating and what is the optimiser
 * chasing noise.
 *
 *   pnpm --filter @alt-hist/calibrate tune
 */

import { driversById, seasonSeed } from "@alt-hist/data";
import {
  createRng,
  RACE_CONSTANTS,
  type RaceConstants,
  type RaceEntrant,
  simulateRace,
} from "@alt-hist/engine";
import { RETIREMENT_RATE_1980, share, TEAM_POLES_1980, TEAM_WINS_1980 } from "./targets.js";
import { parseYear } from "./year.js";

const RACES_PER_EVAL = 6000;
/**
 * The season being tuned. Defaults to the earliest authored one, so an
 * invocation with no flag means exactly what it always meant.
 */
const TUNED_SEASON = seasonSeed(parseYear(process.argv));

/** How far a rating may drift from its authored value, to preserve intent. */
const MAX_DRIFT = 8;
const SWEEPS = 10;

type CarField = "racing" | "qualifying" | "consistency" | "reliability";
type DriverField = "racing" | "qualifying";

interface Knob {
  readonly label: string;
  get(state: State): number;
  set(state: State, value: number): void;
  readonly authored: number;
  /** Candidate moves from the current value, already clamped to legal range. */
  candidates(current: number): number[];
}

/** Integer rating steps, held within MAX_DRIFT of the authored value. */
function ratingCandidates(authored: number): (current: number) => number[] {
  const low = Math.max(1, authored - MAX_DRIFT);
  const high = Math.min(100, authored + MAX_DRIFT);
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

interface State {
  cars: Map<
    string,
    { racing: number; qualifying: number; consistency: number; reliability: number }
  >;
  drivers: Map<string, { racing: number; qualifying: number }>;
  /** Noise constants are searched too — see the note in `buildKnobs`. */
  noise: { qualifying: number; racing: number };
}

function initialState(): State {
  const cars = new Map<
    string,
    { racing: number; qualifying: number; consistency: number; reliability: number }
  >();
  for (const entry of TUNED_SEASON.entries) {
    cars.set(entry.teamId, {
      racing: entry.car.racing,
      qualifying: entry.car.qualifying,
      consistency: entry.car.consistency,
      reliability: entry.car.reliability,
    });
  }

  const drivers = new Map<string, { racing: number; qualifying: number }>();
  for (const [id, driver] of driversById()) {
    drivers.set(id, { racing: driver.peak.racing, qualifying: driver.peak.qualifying });
  }

  return {
    cars,
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

function buildFieldFrom(state: State): RaceEntrant[] {
  const pool = driversById();
  const field: RaceEntrant[] = [];

  for (const entry of TUNED_SEASON.entries) {
    const car = state.cars.get(entry.teamId);
    if (car === undefined) {
      throw new Error(`No car state for ${entry.teamId}`);
    }
    for (const driverId of entry.drivers) {
      const authored = pool.get(driverId);
      const tuned = state.drivers.get(driverId);
      if (authored === undefined || tuned === undefined) {
        throw new Error(`No driver state for ${driverId}`);
      }
      field.push({
        driverId,
        teamId: entry.teamId,
        driver: {
          racing: tuned.racing,
          qualifying: tuned.qualifying,
          consistency: authored.peak.consistency,
          adaptability: authored.peak.adaptability,
          composure: authored.peak.composure,
        },
        car,
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
    total += WEIGHT_TEAM_WINS * (actual - share(TEAM_WINS_1980, teamId)) ** 2;

    const poleActual = (outcome.teamPoles.get(teamId) ?? 0) / races;
    total += WEIGHT_TEAM_POLES * (poleActual - share(TEAM_POLES_1980, teamId)) ** 2;
  }

  for (const driverId of driverIds) {
    const actual = (outcome.driverWins.get(driverId) ?? 0) / races;
    // Driver targets come from a 14-race sample; weight them gently.
    const target = share(
      { jones: 5, piquet: 3, arnoux: 2, reutemann: 1, laffite: 1, pironi: 1, jabouille: 1 },
      driverId,
    );
    total += WEIGHT_DRIVER_WINS * (actual - target) ** 2;
  }

  total += WEIGHT_RETIREMENTS * (outcome.retirementRate - RETIREMENT_RATE_1980) ** 2;
  return total;
}

function buildKnobs(state: State): Knob[] {
  const knobs: Knob[] = [];

  // Only the teams that contended, plus Alfa's qualifying pace. Tuning the
  // tail would be fitting noise: those cars never win regardless.
  const carKnobs: ReadonlyArray<[string, readonly CarField[]]> = [
    ["williams", ["racing", "qualifying", "reliability"]],
    ["ligier", ["racing", "qualifying", "reliability"]],
    ["brabham", ["racing", "qualifying", "reliability"]],
    ["renault", ["racing", "qualifying", "reliability"]],
    ["alfa_romeo", ["qualifying"]],
  ];

  for (const [teamId, fields] of carKnobs) {
    for (const field of fields) {
      const authored = state.cars.get(teamId)?.[field] ?? 0;
      knobs.push({
        label: `car ${teamId}.${field}`,
        authored,
        candidates: ratingCandidates(authored),
        get: (s) => s.cars.get(teamId)?.[field] ?? 0,
        set: (s, value) => {
          const car = s.cars.get(teamId);
          if (car !== undefined) {
            car[field] = value;
          }
        },
      });
    }
  }

  const driverKnobs: ReadonlyArray<[string, readonly DriverField[]]> = [
    ["jones", ["racing", "qualifying"]],
    ["reutemann", ["racing", "qualifying"]],
    ["piquet", ["racing", "qualifying"]],
    ["arnoux", ["racing", "qualifying"]],
    ["jabouille", ["racing", "qualifying"]],
    ["laffite", ["racing"]],
    ["pironi", ["racing"]],
  ];

  for (const [driverId, fields] of driverKnobs) {
    for (const field of fields) {
      const authored = state.drivers.get(driverId)?.[field] ?? 0;
      knobs.push({
        label: `driver ${driverId}.${field}`,
        authored,
        candidates: ratingCandidates(authored),
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

  // The noise constants are searched alongside the ratings. v1 has no track
  // model, so circuit-to-circuit character — a power track suiting the Renault
  // turbo, a tight one suiting the Cosworths — has nowhere to live except the
  // noise term. If the search wants more noise, that is the missing dimension
  // asking for room, not a data problem.
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

  return knobs;
}

function main(): void {
  const state = initialState();
  const knobs = buildKnobs(state);

  let best = error(state);
  console.log(`start error ${best.toFixed(5)}`);

  for (let sweep = 0; sweep < SWEEPS; sweep += 1) {
    let improved = false;
    for (const knob of knobs) {
      const current = knob.get(state);

      for (const candidate of knob.candidates(current)) {
        if (candidate === current) {
          continue;
        }
        knob.set(state, candidate);
        const score = error(state);
        if (score < best) {
          best = score;
          improved = true;
        } else {
          knob.set(state, current);
        }
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
      console.log(`  ${knob.label.padEnd(28)} ${knob.authored} -> ${value}`);
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
          `(target ${(share(TEAM_WINS_1980, teamId) * 100).toFixed(1)}%)   ` +
          `pole ${poles.toFixed(1).padStart(5)}%  ` +
          `(target ${(share(TEAM_POLES_1980, teamId) * 100).toFixed(1)}%)`,
      );
    }
  }
  console.log(`  retirement rate ${(outcome.retirementRate * 100).toFixed(1)}% (target 42.0%)`);
}

main();
