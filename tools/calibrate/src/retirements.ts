/**
 * Retirement harness — the instrument behind the per-season retirement factor.
 *
 * Runs every authored season N times and prints the share of starters that
 * failed to see the flag, against what the real season did. It is the only
 * harness here with a *measured* target for every year rather than for two, and
 * the only one whose output is meant to be acted on: `--sweep` reports the
 * factor that fits each year best, and those are the numbers that end up in the
 * season files.
 *
 *   pnpm retirements              # every year, at its authored factor
 *   pnpm retirements 500          # seasons per year (default 200)
 *   pnpm retirements --year 1980  # one year
 *   pnpm retirements --sweep      # every factor 1-10 per year, best fit marked
 *   pnpm retirements --mode aged  # drivers at their ability that season
 *
 * **DNQs are not retirements and are not in the denominator.** A car that
 * failed to qualify never started; counting it as a failure would make an
 * over-subscribed grid look fragile. The engine already separates the two —
 * `retirements` and `classifiedCount` are starters, `nonQualifiers` are not —
 * and the real-season figures are counted the same way, from Ergast's
 * classification rather than its entry list.
 *
 * Unlike the other harnesses here, this one is *for* a calibration the author
 * asked for: roadmap item 5, the per-season retirement rate. The general
 * no-re-calibration rule still covers everything else it touches — nothing in
 * this run is a reason to move a chassis, an engine or a driver rating.
 */

import {
  authoredSeasons,
  buildField,
  DEFAULT_RATING_MODE,
  RATING_MODES,
  type RatingMode,
  seasonConstants,
  seasonSeed,
} from "@alt-hist/data";
import {
  createRng,
  parseRetirementFactor,
  type RandomnessLevel,
  RETIREMENT_FACTORS,
  type RetirementFactor,
  simulateSeason,
  withRandomness,
  withRetirementFactor,
} from "@alt-hist/engine";
import { parseCount } from "./args.js";
import { padLeft } from "./format.js";
import { parseRandomness } from "./randomness.js";
import { realRetirementRate } from "./realRetirements.js";
import { parseYear } from "./year.js";

/**
 * Seasons per year. Far fewer than the other harnesses need, because a
 * retirement rate is a much cheaper thing to measure than a title share: one
 * season is already ~400 independent coin flips, so 200 of them puts the
 * standard error on a 45% rate near a tenth of a point — an order of magnitude
 * finer than the factor scale can resolve. The sweep runs this ten times per
 * year over seventy-seven years, so the default is what keeps that under a
 * couple of minutes.
 */
const DEFAULT_SEASONS = 200;

/** The share of starters that retired, over `count` runs of one season. */
function simulatedRate(
  year: number,
  count: number,
  factor: RetirementFactor | null,
  mode: RatingMode,
  randomness: RandomnessLevel,
): number {
  const authored = seasonSeed(year);
  const field = buildField(authored, undefined, mode);
  // `null` means "whatever the season file says", which is what the plain
  // report shows; the sweep overrides it with each factor in turn. The override
  // goes through the same two helpers `seasonConstants` composes, in the same
  // order, so the two paths cannot drift apart.
  const constants =
    factor === null
      ? seasonConstants(authored, randomness)
      : withRetirementFactor(factor, withRandomness(randomness));

  let starters = 0;
  let retirements = 0;
  for (let seed = 1; seed <= count; seed += 1) {
    const season = simulateSeason(field, authored.calendar, createRng(seed), constants);
    for (const race of season.races) {
      starters += race.retirements + race.classifiedCount;
      retirements += race.retirements;
    }
  }
  return starters === 0 ? 0 : retirements / starters;
}

/** The value of `--flag <value>`, or undefined. */
function flagValue(argv: readonly string[], ...names: readonly string[]): string | undefined {
  const index = argv.findIndex((arg) => names.includes(arg));
  return index === -1 ? undefined : argv[index + 1];
}

function parseMode(argv: readonly string[]): RatingMode {
  const raw = flagValue(argv, "--mode", "-m");
  if (raw === undefined) {
    return DEFAULT_RATING_MODE;
  }
  const mode = RATING_MODES.find((candidate) => candidate === raw);
  if (mode === undefined) {
    throw new Error(`--mode must be one of ${RATING_MODES.join(", ")}, received "${raw}"`);
  }
  return mode;
}

/** Positional arguments only: every flag, and the value that follows it, gone. */
function positionals(argv: readonly string[]): string[] {
  const kept: string[] = [];
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === undefined) {
      continue;
    }
    if (arg === "--sweep") {
      continue;
    }
    if (arg.startsWith("-")) {
      index += 1;
      continue;
    }
    kept.push(arg);
  }
  return kept;
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/** `+3.2` / `-1.4`, in percentage points, or a dash when there is no target. */
function delta(simulated: number, real: number | null): string {
  if (real === null) {
    return "—";
  }
  const points = (simulated - real) * 100;
  return `${points >= 0 ? "+" : ""}${points.toFixed(1)}`;
}

function main(): void {
  const argv = process.argv;
  const sweep = argv.includes("--sweep");
  const count = parseCount(positionals(argv)[0], DEFAULT_SEASONS, "Season count");
  const mode = parseMode(argv);
  const randomness = parseRandomness(argv);
  const years =
    argv.includes("--year") || argv.includes("-y") ? [parseYear(argv)] : authoredSeasons;

  console.log("");
  console.log(
    `Retirement rates — ${count} seasons per year, ${mode} ratings, randomness ${randomness}`,
  );
  console.log("Share of *starters* that failed to finish. DNQs are excluded from both sides.");
  console.log("");

  const header = sweep
    ? [
        padLeft("YEAR", 6),
        padLeft("REAL", 8),
        padLeft("NOW", 6),
        padLeft("BEST", 6),
        "  ",
        ...RETIREMENT_FACTORS.map((factor) => padLeft(String(factor), 7)),
      ].join("")
    : [
        padLeft("YEAR", 6),
        padLeft("FACTOR", 8),
        padLeft("SIM", 8),
        padLeft("REAL", 8),
        padLeft("DELTA", 8),
      ].join("");
  console.log(header);
  console.log("-".repeat(header.length));

  let worst = 0;
  let total = 0;
  let measured = 0;

  for (const year of years) {
    const real = realRetirementRate(year);
    const authoredFactor = parseRetirementFactor(seasonSeed(year).retirementFactor);

    if (!sweep) {
      const simulated = simulatedRate(year, count, null, mode, randomness);
      if (real !== null) {
        worst = Math.max(worst, Math.abs(simulated - real));
        total += Math.abs(simulated - real);
        measured += 1;
      }
      console.log(
        [
          padLeft(String(year), 6),
          padLeft(String(authoredFactor), 8),
          padLeft(percent(simulated), 8),
          padLeft(real === null ? "—" : percent(real), 8),
          padLeft(delta(simulated, real), 8),
        ].join(""),
      );
      continue;
    }

    const rates = RETIREMENT_FACTORS.map((factor) =>
      simulatedRate(year, count, factor, mode, randomness),
    );
    let best = RETIREMENT_FACTORS[0] ?? 5;
    if (real !== null) {
      let bestGap = Number.POSITIVE_INFINITY;
      RETIREMENT_FACTORS.forEach((factor, index) => {
        const gap = Math.abs((rates[index] ?? 0) - real);
        if (gap < bestGap) {
          bestGap = gap;
          best = factor;
        }
      });
      worst = Math.max(worst, bestGap);
      total += bestGap;
      measured += 1;
    }
    console.log(
      [
        padLeft(String(year), 6),
        padLeft(real === null ? "—" : percent(real), 8),
        padLeft(String(authoredFactor), 6),
        padLeft(real === null ? "—" : String(best), 6),
        "  ",
        ...rates.map((rate) => padLeft(percent(rate), 7)),
      ].join(""),
    );
  }

  console.log("");
  if (measured > 0) {
    console.log(
      `${measured} years with a measured target. ` +
        `Mean absolute error ${((total / measured) * 100).toFixed(2)} points, worst ${(worst * 100).toFixed(2)}.`,
    );
  }
  console.log("");
}

main();
