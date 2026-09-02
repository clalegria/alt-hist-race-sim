/**
 * Season fitter.
 *
 * Proposes the chassis and engine ratings that reproduce a real season, given
 * that season's actual results in `tools/calibrate/targets/<year>.json`.
 *
 *   pnpm fit 2026                  # propose, write nothing
 *   pnpm fit 2026 --write          # apply to packages/data/src/seasons/2026.json
 *   pnpm fit 2026 --stage pace     # reliability | pace | both (default both)
 *   pnpm fit 2026 --seasons 800    # sample per candidate (default 500)
 *   pnpm fit 2026 --drift 6        # cap on how far any pace rating may move
 *   pnpm fit 2026 --hold ferrari,mclaren
 *
 * Two things it does NOT vary, and the reason for each:
 *
 * - **Rating mode and randomness are fixed** at `aged` and level 1. They are
 *   not flags because varying them silently makes two runs incomparable, and a
 *   `peak` fit is the specific mistake `mode.ts` exists to prevent.
 * - **Driver ratings, consistency, `retirementFactor` and every engine constant
 *   are untouched.** The car absorbs the error; that is the whole point of
 *   holding the drivers fixed. Anything this cannot reach is reported as a rail
 *   rather than absorbed by widening the model.
 *
 * Reliability is fitted before pace, and pace with reliability pinned. The
 * order matters: reliability inverts almost closed-form from a retirement
 * count, and doing it second would let pace quietly absorb reliability error.
 */

import {
  buildField,
  hasSeason,
  seasonConstants,
  seasonSeed,
  teamIdentityIn,
  teamsById,
} from "@alt-hist/data";
import { constructorStandings, createRng, powertrain, simulateSeason } from "@alt-hist/engine";
import { parseCount } from "./args.js";
import { type FitTargets, fitTargets, pointsShare } from "./fitTargets.js";
import { padLeft, padRight } from "./format.js";
import { CALIBRATION_RATING_MODE } from "./mode.js";
import { writeSeasonRatings } from "./writeSeason.js";

/** The level every fit measures at. See the header. */
const FIT_RANDOMNESS = 1;

/**
 * Reliability bounds, in rating points.
 *
 * The authored range across all 77 seasons is 12-94 for both chassis and
 * engines. A fit that proposes 0 or 100 is not being realistic, it is being
 * cornered — and those values would poison the progression and game modes
 * later, where a car has to be able to get better or worse from where it is.
 * So the search is bounded well inside the authored range and reports when a
 * target needed something outside it.
 */
const RELIABILITY_FLOOR_ENGINE = 35;
const RELIABILITY_FLOOR_CHASSIS = 60;
const RELIABILITY_CEILING = 94;

/** Default cap on how far a pace rating may move from what is authored. */
const DEFAULT_DRIFT = 12;

/**
 * Cap on how far a *shared engine's* reliability may move.
 *
 * Without it, one fragile customer walks a works engine down the scale and
 * takes every other customer with it. The mechanism is the chassis floor: a car
 * cannot be more fragile than `(floor + engine) / 2`, so once a customer's real
 * retirement rate is below that, the only lever left is the engine — and on
 * 2026, McLaren's 25% pulled the Mercedes unit from 92 to 74, worsening
 * Mercedes and Alpine to chase a car McLaren could not have had anyway.
 *
 * An engine rating is also a claim about a real manufacturer, so walking one 18
 * points to fit a customer's gearbox failures is the wrong answer even when it
 * scores better. Bounded here and reported when it binds.
 */
const DEFAULT_RELIABILITY_DRIFT = 10;
const DEFAULT_SEASONS = 500;

const lerp = (rating: number, atZero: number, atHundred: number): number => {
  const t = Math.min(Math.max(rating, 0), 100) / 100;
  return atZero + (atHundred - atZero) * t;
};
const clamp = (value: number, lo: number, hi: number): number => Math.min(Math.max(value, lo), hi);

function flagValue(argv: readonly string[], ...names: readonly string[]): string | undefined {
  const index = argv.findIndex((arg) => names.includes(arg));
  return index === -1 ? undefined : argv[index + 1];
}

function parseFitYear(argv: readonly string[]): number {
  const positional = argv.slice(2).find((arg) => /^\d{4}$/.test(arg));
  const raw = flagValue(argv, "--year", "-y") ?? positional;
  const parsed = raw === undefined ? Number.NaN : Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error("Which season? e.g. `pnpm fit 2026`");
  }
  if (!hasSeason(parsed)) {
    throw new Error(`Season ${parsed} has not been authored.`);
  }
  return parsed;
}

type Stage = "reliability" | "pace" | "both";
function parseStage(argv: readonly string[]): Stage {
  const raw = flagValue(argv, "--stage", "-s");
  if (raw === undefined) {
    return "both";
  }
  if (raw !== "reliability" && raw !== "pace" && raw !== "both") {
    throw new Error(`--stage must be reliability, pace or both, received "${raw}"`);
  }
  return raw;
}

/** A season's ratings as the fit manipulates them: pace and reliability, per team. */
interface Candidate {
  /** teamId -> chassis racing. Qualifying tracks it at its authored offset. */
  readonly racing: Map<string, number>;
  /** teamId -> chassis reliability. */
  readonly chassisReliability: Map<string, number>;
  /** engineId -> engine reliability. */
  readonly engineReliability: Map<string, number>;
}

type Seed = ReturnType<typeof seasonSeed>;

/**
 * A deeply writable `SeasonSeed`, for the one place that needs one: the
 * structured clone this tool mutates before handing it to the sim. `SeasonSeed`
 * is readonly all the way down on purpose — nothing should edit authored data
 * in place — so a copy is the only honest way to try a candidate.
 */
type Writable<T> = T extends readonly (infer Item)[]
  ? Writable<Item>[]
  : T extends object
    ? { -readonly [Key in keyof T]: Writable<T[Key]> }
    : T;

/** A season seed with a candidate's ratings written into it. */
function seedWith(base: Seed, candidate: Candidate, qualifyingOffset: Map<string, number>): Seed {
  const seed = JSON.parse(JSON.stringify(base)) as Writable<Seed>;
  for (const engine of seed.engines) {
    const reliability = candidate.engineReliability.get(engine.engineId);
    if (reliability !== undefined) {
      engine.reliability = Math.round(reliability);
    }
  }
  for (const entry of seed.entries) {
    const racing = candidate.racing.get(entry.teamId);
    if (racing !== undefined) {
      entry.chassis.racing = Math.round(racing);
      entry.chassis.qualifying = Math.round(racing - (qualifyingOffset.get(entry.teamId) ?? 0));
    }
    const reliability = candidate.chassisReliability.get(entry.teamId);
    if (reliability !== undefined) {
      entry.chassis.reliability = Math.round(reliability);
    }
  }
  return seed as Seed;
}

interface Measured {
  readonly pointsShare: Map<string, number>;
  readonly winShare: Map<string, number>;
  readonly podiumShare: Map<string, number>;
  readonly dnfRate: Map<string, number>;
}

/**
 * Runs `seasons` seasons and tallies per team.
 *
 * **Every call uses the same seed block on purpose.** Two candidates differ
 * only slightly, so scoring them on identical dice makes the *difference*
 * between them far less noisy than either absolute estimate — which is what
 * lets the search discriminate at 500 seasons instead of 5,000. Changing this
 * to a moving seed would not make the fit more honest, it would make it slower
 * and noisier.
 */
function measure(seed: Seed, seasons: number): Measured {
  const field = buildField(seed, undefined, CALIBRATION_RATING_MODE);
  const constants = seasonConstants(seed, FIT_RANDOMNESS);
  const teamIds = [...new Set(field.map((entrant) => entrant.teamId))];
  const points = new Map(teamIds.map((id) => [id, 0]));
  const wins = new Map(teamIds.map((id) => [id, 0]));
  const podiums = new Map(teamIds.map((id) => [id, 0]));
  const retired = new Map(teamIds.map((id) => [id, 0]));
  const starts = new Map(teamIds.map((id) => [id, 0]));

  for (let index = 0; index < seasons; index += 1) {
    const season = simulateSeason(field, seed.calendar, createRng(1 + index), constants);
    for (const team of constructorStandings(season, seed.points)) {
      points.set(team.teamId, (points.get(team.teamId) ?? 0) + team.points);
    }
    for (const race of season.races) {
      for (const entry of race.entries) {
        if (!entry.started) {
          continue;
        }
        starts.set(entry.teamId, (starts.get(entry.teamId) ?? 0) + 1);
        if (entry.retired) {
          retired.set(entry.teamId, (retired.get(entry.teamId) ?? 0) + 1);
        }
        if (entry.finishPosition === 1) {
          wins.set(entry.teamId, (wins.get(entry.teamId) ?? 0) + 1);
        }
        if (entry.finishPosition !== null && entry.finishPosition <= 3) {
          podiums.set(entry.teamId, (podiums.get(entry.teamId) ?? 0) + 1);
        }
      }
    }
  }

  const totalPoints = [...points.values()].reduce((a, b) => a + b, 0);
  const races = seasons * seed.calendar.length;
  const share = (map: Map<string, number>, denominator: number): Map<string, number> =>
    new Map([...map].map(([id, value]) => [id, denominator === 0 ? 0 : value / denominator]));
  return {
    pointsShare: share(points, totalPoints),
    winShare: share(wins, races),
    podiumShare: share(podiums, races * 3),
    dnfRate: new Map(
      [...retired].map(([id, value]) => [
        id,
        (starts.get(id) ?? 0) === 0 ? 0 : value / (starts.get(id) as number),
      ]),
    ),
  };
}

/** Summed squared points-share error, in percentage points. The fit's objective. */
function scoreOf(measured: Measured, target: Map<string, number>): number {
  let error = 0;
  for (const [teamId, share] of measured.pointsShare) {
    error += (100 * share - 100 * (target.get(teamId) ?? 0)) ** 2;
  }
  return error;
}

// --- Stage 1: reliability ----------------------------------------------------

interface ReliabilityRow {
  readonly teamId: string;
  readonly wanted: number;
  readonly chassis: number;
  readonly car: number;
  readonly railed: boolean;
}

/**
 * The blended car reliability a team's real retirement rate implies.
 *
 * Inverts `1 - (1 - mechanical)(1 - driverError)` for the mechanical risk, then
 * inverts the reliability lerp. Returns a value outside 0-100 when the target
 * is unreachable, which is information the caller reports rather than hides.
 */
function wantedCarReliability(
  target: number,
  meanErrorRisk: number,
  constants: ReturnType<typeof seasonConstants>,
): number {
  const mechanical = 1 - (1 - target) / (1 - meanErrorRisk);
  const atZero = constants.mechanicalDnfAtZeroReliability * constants.mechanicalDnfEraScale;
  const atHundred = constants.mechanicalDnfAtFullReliability * constants.mechanicalDnfEraScale;
  return ((mechanical - atZero) / (atHundred - atZero)) * 100;
}

/**
 * The lowest blended car reliability the bands allow — a car is the mean of its
 * chassis and its engine, so both at their floors is as fragile as this gets.
 */
const CAR_RELIABILITY_FLOOR = (RELIABILITY_FLOOR_CHASSIS + RELIABILITY_FLOOR_ENGINE) / 2;

/**
 * A target pulled inside what the model can actually express.
 *
 * This is why stage 1 is not a plain least squares, and it is the single most
 * important line in it. A season's real retirement rates span far more than the
 * model can: 2026 ran from 4.2% to 45.8%, a factor of eleven, where a fixed
 * `retirementFactor` reaches about four. Fitted raw, the unreachable extremes
 * dominate the residual and drag the *shared engine* with them — on 2026 that
 * pulled the Ferrari unit from 82 down to 40 chasing Cadillac's 41.7%, and made
 * Ferrari, Haas and Cadillac all worse to chase a number none of them could
 * have had.
 *
 * Clipping first says the honest thing instead: get the ORDER of retirements
 * right and give up on the magnitude. A team already at its rail contributes no
 * further error and stops pulling, while the raw figure is still reported, so
 * the gap stays visible rather than being silently absorbed by its suppliers.
 */
function reachable(wanted: number): number {
  return clamp(wanted, CAR_RELIABILITY_FLOOR, RELIABILITY_CEILING);
}

function fitReliability(
  base: Seed,
  targets: FitTargets,
  held: ReadonlySet<string>,
  engineDrift: number,
): { engines: Map<string, number>; rows: ReliabilityRow[] } {
  const field = buildField(base, undefined, CALIBRATION_RATING_MODE);
  const constants = seasonConstants(base, FIT_RANDOMNESS);
  const engineOf = new Map(base.entries.map((entry) => [entry.teamId, entry.engineId]));
  const authoredEngine = new Map(
    base.engines.map((engine) => [engine.engineId, engine.reliability]),
  );
  const authoredChassis = new Map(
    base.entries.map((entry) => [entry.teamId, entry.chassis.reliability]),
  );

  /** Mean driver-error risk across a team's cars, which the drivers own. */
  const errorRiskOf = new Map<string, number>();
  for (const entry of base.entries) {
    const cars = field.filter((runner) => runner.teamId === entry.teamId);
    const risk =
      cars.reduce(
        (sum, runner) =>
          sum +
          lerp(
            runner.driver.composure,
            constants.driverErrorDnfAtZeroComposure,
            constants.driverErrorDnfAtFullComposure,
          ),
        0,
      ) / Math.max(cars.length, 1);
    errorRiskOf.set(entry.teamId, risk);
  }

  const wantedOf = new Map<string, number>();
  for (const entry of base.entries) {
    const target = targets.teams[entry.teamId];
    if (target === undefined || held.has(entry.teamId)) {
      continue;
    }
    wantedOf.set(
      entry.teamId,
      wantedCarReliability(
        target.dnfs / targets.startsPerTeam,
        errorRiskOf.get(entry.teamId) ?? 0,
        constants,
      ),
    );
  }

  // One shared engine value per supplier, chosen by least squares over the
  // chassis values its customers would then need. Searched rather than solved
  // because both the chassis and the engine are clamped, which makes the
  // objective piecewise.
  const engines = new Map(authoredEngine);
  const rows: ReliabilityRow[] = [];
  for (const engineId of new Set(engineOf.values())) {
    const customers = base.entries
      .map((entry) => entry.teamId)
      .filter((teamId) => engineOf.get(teamId) === engineId && wantedOf.has(teamId));
    if (customers.length === 0) {
      continue;
    }
    const authoredValue = authoredEngine.get(engineId) ?? RELIABILITY_CEILING;
    const lowest = Math.max(RELIABILITY_FLOOR_ENGINE, authoredValue - engineDrift);
    const highest = Math.min(RELIABILITY_CEILING, authoredValue + engineDrift);
    let bestError = Number.POSITIVE_INFINITY;
    let bestEngine = authoredValue;
    for (let candidate = lowest; candidate <= highest; candidate += 1) {
      let error = 0;
      for (const teamId of customers) {
        const wanted = reachable(wantedOf.get(teamId) as number);
        const chassis = clamp(
          2 * wanted - candidate,
          RELIABILITY_FLOOR_CHASSIS,
          RELIABILITY_CEILING,
        );
        error += ((chassis + candidate) / 2 - wanted) ** 2;
      }
      // Ties break toward what is already authored, and that is not cosmetic.
      // An engine with one customer is not separately identifiable from that
      // customer's chassis — every split with the same blended reliability fits
      // exactly as well — so a scan that took the first best would walk the
      // engine to whichever end it happened to start from. The chassis floor
      // makes this bite even with several customers: below `(60 + engine) / 2`
      // the only way to reach a fragile car is to blame the engine. When the
      // data cannot tell two answers apart, the right move is to not move.
      const authored = authoredEngine.get(engineId);
      const better = error < bestError - 1e-9;
      const tied = Math.abs(error - bestError) <= 1e-9;
      const closer =
        authored === undefined
          ? false
          : Math.abs(candidate - authored) < Math.abs(bestEngine - authored);
      if (better || (tied && closer)) {
        bestError = Math.min(error, bestError);
        bestEngine = candidate;
      }
    }
    engines.set(engineId, bestEngine);
    for (const teamId of customers) {
      const raw = wantedOf.get(teamId) as number;
      const wanted = reachable(raw);
      const chassis = Math.round(
        clamp(2 * wanted - bestEngine, RELIABILITY_FLOOR_CHASSIS, RELIABILITY_CEILING),
      );
      rows.push({
        teamId,
        wanted: raw,
        chassis,
        car: (chassis + bestEngine) / 2,
        railed: raw < CAR_RELIABILITY_FLOOR || raw > RELIABILITY_CEILING,
      });
    }
  }
  // Teams held or untargeted keep what they have.
  for (const entry of base.entries) {
    if (!rows.some((row) => row.teamId === entry.teamId)) {
      const chassis = authoredChassis.get(entry.teamId) ?? RELIABILITY_CEILING;
      const engine = engines.get(engineOf.get(entry.teamId) ?? "") ?? chassis;
      rows.push({
        teamId: entry.teamId,
        wanted: Number.NaN,
        chassis,
        car: (chassis + engine) / 2,
        railed: false,
      });
    }
  }
  return { engines, rows };
}

// --- Stage 2: pace -----------------------------------------------------------

/**
 * Coordinate descent on chassis racing, one team at a time.
 *
 * Deliberately a plain line search rather than anything cleverer: the objective
 * is a Monte Carlo estimate, so a gradient method would be chasing sampling
 * noise, and with a dozen teams the search space is small enough that three
 * passes over a few step sizes converges. `pnpm tune` had a stalling bug once
 * from keeping a score that disagreed with its state — this recomputes the best
 * score from the accepted candidate every time rather than carrying one along.
 */
function fitPace(
  base: Seed,
  candidate: Candidate,
  qualifyingOffset: Map<string, number>,
  target: Map<string, number>,
  held: ReadonlySet<string>,
  seasons: number,
  drift: number,
  onPass: (pass: number, score: number) => void,
): Candidate {
  const authored = new Map(base.entries.map((entry) => [entry.teamId, entry.chassis.racing]));
  let best: Candidate = {
    racing: new Map(candidate.racing),
    chassisReliability: candidate.chassisReliability,
    engineReliability: candidate.engineReliability,
  };
  let bestScore = scoreOf(measure(seedWith(base, best, qualifyingOffset), seasons), target);

  for (let pass = 1; pass <= 3; pass += 1) {
    for (const entry of base.entries) {
      const teamId = entry.teamId;
      if (held.has(teamId) || !target.has(teamId)) {
        continue;
      }
      const from = best.racing.get(teamId) as number;
      const origin = authored.get(teamId) as number;
      for (const step of [-3, -2, -1, 1, 2, 3]) {
        const moved = clamp(from + step, origin - drift, origin + drift);
        if (moved === from) {
          continue;
        }
        const trial = new Map(best.racing);
        trial.set(teamId, clamp(moved, 20, 99));
        const score = scoreOf(
          measure(seedWith(base, { ...best, racing: trial }, qualifyingOffset), seasons),
          target,
        );
        if (score < bestScore - 0.01) {
          bestScore = score;
          best = { ...best, racing: trial };
        }
      }
    }
    onPass(pass, bestScore);
  }
  return best;
}

// --- Reporting ---------------------------------------------------------------

const HELP = `
pnpm fit <year> [flags]   propose the chassis and engine ratings that reproduce
                          a real season, from tools/calibrate/targets/<year>.json

  --write                 apply the proposal to the season file
  --stage <s>             reliability | pace | both        (default both)
  --seasons <n>           sample per candidate             (default ${DEFAULT_SEASONS})
  --drift <n>             cap on pace movement             (default ${DEFAULT_DRIFT})
  --engine-drift <n>      cap on engine reliability movement (default ${DEFAULT_RELIABILITY_DRIFT})
  --hold a,b              leave these teams alone

Always runs aged ratings at randomness ${FIT_RANDOMNESS}; never touches drivers,
consistency, the retirement factor or any engine constant. Fits points SHARE —
wins and podiums are printed as a check, because over a dozen-odd real races
their sampling error swamps anything a rating could express.
`;

function main(): void {
  const argv = process.argv;
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(HELP);
    return;
  }
  const year = parseFitYear(argv);
  const stage = parseStage(argv);
  const seasons = parseCount(flagValue(argv, "--seasons"), DEFAULT_SEASONS, "--seasons");
  const drift = parseCount(flagValue(argv, "--drift"), DEFAULT_DRIFT, "--drift");
  const engineDrift = parseCount(
    flagValue(argv, "--engine-drift"),
    DEFAULT_RELIABILITY_DRIFT,
    "--engine-drift",
  );
  const held = new Set(
    (flagValue(argv, "--hold") ?? "")
      .split(",")
      .map((name) => name.trim())
      .filter((name) => name !== ""),
  );
  const write = argv.includes("--write");

  const base = seasonSeed(year);
  const targets = fitTargets(year);
  const target = pointsShare(targets);

  const known = new Set(base.entries.map((entry) => entry.teamId));
  const unknown = Object.keys(targets.teams).filter((teamId) => !known.has(teamId));
  if (unknown.length > 0) {
    throw new Error(
      `targets/${year}.json names teams not in the season: ${unknown.join(", ")}. ` +
        "Targets are keyed by teamId, not by display name.",
    );
  }

  const teams = teamsById();
  const nameOf = (teamId: string): string => {
    const team = teams.get(teamId);
    return team === undefined ? teamId : teamIdentityIn(team, year).name;
  };
  const qualifyingOffset = new Map(
    base.entries.map((entry) => [entry.teamId, entry.chassis.racing - entry.chassis.qualifying]),
  );

  console.log("");
  console.log(
    `${year} — ${base.entries.length} teams, ${base.calendar.length} rounds, ` +
      `${CALIBRATION_RATING_MODE} ratings, randomness ${FIT_RANDOMNESS}, ${seasons} seasons/eval`,
  );
  console.log(
    `targets: ${targets.races} real races, ${targets.startsPerTeam} starts per team` +
      (targets.note === undefined ? "" : `\n         ${targets.note}`),
  );
  if (held.size > 0) {
    console.log(`holding: ${[...held].join(", ")}`);
  }

  let candidate: Candidate = {
    racing: new Map(base.entries.map((entry) => [entry.teamId, entry.chassis.racing])),
    chassisReliability: new Map(
      base.entries.map((entry) => [entry.teamId, entry.chassis.reliability]),
    ),
    engineReliability: new Map(base.engines.map((engine) => [engine.engineId, engine.reliability])),
  };
  const before = measure(base, seasons);
  const beforeScore = scoreOf(before, target);

  const rails: string[] = [];

  if (stage === "reliability" || stage === "both") {
    const totalDnfs = Object.values(targets.teams).reduce((sum, t) => sum + t.dnfs, 0);
    const totalStarts = Object.keys(targets.teams).length * targets.startsPerTeam;
    console.log("");
    console.log(
      `STAGE 1 — reliability, from ${totalDnfs} real retirements in ${totalStarts} starts`,
    );
    const { engines, rows } = fitReliability(base, targets, held, engineDrift);
    console.log("");
    console.log(
      `  ${padRight("ENGINE", 12)}${padLeft("now", 5)} ->${padLeft("fit", 5)}   customers`,
    );
    const engineOf = new Map(base.entries.map((entry) => [entry.teamId, entry.engineId]));
    for (const [engineId, value] of engines) {
      const customers = base.entries
        .filter((entry) => engineOf.get(entry.teamId) === engineId)
        .map((entry) => nameOf(entry.teamId));
      const authored = base.engines.find((engine) => engine.engineId === engineId);
      console.log(
        `  ${padRight(engineId, 12)}${padLeft(String(authored?.reliability ?? "?"), 5)} ->` +
          `${padLeft(String(Math.round(value)), 5)}   ${customers.join(", ")}` +
          (customers.length === 1 ? "  (single customer — not separately identifiable)" : ""),
      );
    }
    candidate = {
      ...candidate,
      engineReliability: engines,
      chassisReliability: new Map(rows.map((row) => [row.teamId, row.chassis])),
    };
    for (const row of rows) {
      if (row.railed) {
        rails.push(
          `${nameOf(row.teamId)} needs car reliability ${row.wanted.toFixed(0)}, outside the ` +
            `${RELIABILITY_FLOOR_CHASSIS}-${RELIABILITY_CEILING} band this fit will propose`,
        );
      }
    }
  }

  if (stage === "pace" || stage === "both") {
    console.log("");
    console.log(`STAGE 2 — pace, reliability pinned, drift capped at ${drift}`);
    candidate = fitPace(
      base,
      candidate,
      qualifyingOffset,
      target,
      held,
      seasons,
      drift,
      (pass, score) => console.log(`  pass ${pass}  err ${score.toFixed(2)}`),
    );
  }

  const fitted = seedWith(base, candidate, qualifyingOffset);
  const after = measure(fitted, seasons);

  console.log("");
  console.log(
    `  ${padRight("TEAM", 15)}${padRight("racing", 12)}${padRight("rel", 11)}` +
      `${padLeft("eff", 5)}  ${padLeft("pts%", 6)}${padLeft("real", 7)}${padLeft("delta", 8)}` +
      `${padLeft("dnf%", 8)}${padLeft("real", 7)}`,
  );
  console.log(`  ${"-".repeat(79)}`);
  const fittedField = buildField(fitted, undefined, CALIBRATION_RATING_MODE);
  const ordered = [...base.entries].sort(
    (a, b) => (after.pointsShare.get(b.teamId) ?? 0) - (after.pointsShare.get(a.teamId) ?? 0),
  );
  let worst = 0;
  for (const entry of ordered) {
    const teamId = entry.teamId;
    const fittedEntry = fitted.entries.find((e) => e.teamId === teamId);
    const runner = fittedField.find((r) => r.teamId === teamId);
    const eff = runner === undefined ? 0 : powertrain(runner.chassis, runner.engine).racing;
    const real = targets.teams[teamId];
    const pts = 100 * (after.pointsShare.get(teamId) ?? 0);
    const realPts = 100 * (target.get(teamId) ?? 0);
    const delta = real === undefined ? Number.NaN : pts - realPts;
    if (Number.isFinite(delta)) {
      worst = Math.max(worst, Math.abs(delta));
    }
    const paceMoved = entry.chassis.racing !== fittedEntry?.chassis.racing;
    const relMoved = entry.chassis.reliability !== fittedEntry?.chassis.reliability;
    console.log(
      `  ${padRight(nameOf(teamId), 15)}` +
        padRight(
          paceMoved
            ? `${entry.chassis.racing} -> ${fittedEntry?.chassis.racing}`
            : `${entry.chassis.racing}`,
          12,
        ) +
        padRight(
          relMoved
            ? `${entry.chassis.reliability} -> ${fittedEntry?.chassis.reliability}`
            : `${entry.chassis.reliability}`,
          11,
        ) +
        padLeft(eff.toFixed(1), 5) +
        padLeft(pts.toFixed(1), 6) +
        padLeft(real === undefined ? "—" : realPts.toFixed(1), 7) +
        padLeft(Number.isFinite(delta) ? `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}` : "—", 8) +
        padLeft((100 * (after.dnfRate.get(teamId) ?? 0)).toFixed(1), 8) +
        padLeft(
          real === undefined ? "—" : ((100 * real.dnfs) / targets.startsPerTeam).toFixed(1),
          7,
        ),
    );
  }

  const afterScore = scoreOf(after, target);
  console.log("");
  console.log(
    `  squared error ${beforeScore.toFixed(2)} -> ${afterScore.toFixed(2)}   ` +
      `worst points-share error ${worst.toFixed(1)}`,
  );

  // Wins and podiums are shown, never fitted: over a dozen-odd real races the
  // sampling error on a win count swamps anything a rating could express.
  console.log("");
  console.log("  not fitted, shown as a check (real counts are small samples):");
  for (const entry of ordered.slice(0, 5)) {
    const real = targets.teams[entry.teamId];
    if (real === undefined) {
      continue;
    }
    console.log(
      `    ${padRight(nameOf(entry.teamId), 15)}` +
        `win ${padLeft((100 * (after.winShare.get(entry.teamId) ?? 0)).toFixed(1), 5)}% vs ` +
        `${padLeft(((100 * real.wins) / targets.races).toFixed(1), 5)}%   ` +
        `podium ${padLeft((100 * (after.podiumShare.get(entry.teamId) ?? 0)).toFixed(1), 5)}% vs ` +
        `${padLeft(((100 * real.podiums) / (targets.races * 3)).toFixed(1), 5)}%`,
    );
  }

  if (rails.length > 0) {
    console.log("");
    console.log(`  ${rails.length} target(s) the model cannot reach:`);
    for (const rail of rails) {
      console.log(`    - ${rail}`);
    }
    console.log(
      "    Reaching them needs engine constants, which re-tunes every season. Not attempted.",
    );
  }

  console.log("");
  if (write) {
    writeSeasonRatings(year, fitted);
    console.log(`  Written to packages/data/src/seasons/${year}.json`);
  } else {
    console.log("  Nothing written. Re-run with --write to apply.");
  }
  console.log("");
}

main();
