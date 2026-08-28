/**
 * Season Monte Carlo harness.
 *
 * `main.ts` runs one race N times; this runs one *season* N times and prints
 * what a year is worth to each driver and each team. Same grid, same seeded
 * determinism, seeds 1..N — one whole calendar per seed rather than one
 * afternoon.
 *
 *   pnpm calibrate-season              # 5000 seasons
 *   pnpm calibrate-season 20000        # more seasons, tighter numbers
 *   pnpm calibrate-season 20000 --year 1981
 *   pnpm calibrate-season 5000 --mode peak
 *   pnpm calibrate-season 5000 --randomness 5
 *
 * The race-level harness answers questions about the front of the grid — wins,
 * poles, retirements. It cannot answer what a midfield car is *worth*, because
 * a season is where sixth places add up. That is what the scoring columns here
 * are for: how often a car scores at all, and the points it ends the year on.
 *
 * **These numbers are not comparable with `pnpm calibrate`'s.** That harness runs
 * `simulateRace` with no `RoundContext`, so home advantage never pays; a season
 * runs the year's real calendar, so it pays at every round that has a host
 * country. A win share here and a win share there are two different quantities,
 * and the gap between them is exactly what home advantage is worth.
 *
 * The same no-re-calibration rules apply to what is done with this output as to
 * `pnpm calibrate` — see `.claude/rules/calibration.md`. It is an instrument the
 * author reads, not a test, and nothing in the suite runs it.
 */

import {
  buildField,
  driversById,
  RATING_MODES,
  type RatingMode,
  seasonConstants,
  seasonSeed,
  teamIdentityIn,
  teamsById,
} from "@alt-hist/data";
import {
  championshipStandings,
  constructorStandings,
  createRng,
  simulateSeason,
} from "@alt-hist/engine";
import { parseCount } from "./args.js";
import { padLeft, padRight, pct } from "./format.js";
import { CALIBRATION_RATING_MODE } from "./mode.js";
import { parseRandomness } from "./randomness.js";
import { parseYear } from "./year.js";

/**
 * The same 5000 the race harness defaults to. A season is a whole calendar of
 * races, so this is fourteen times the work of `pnpm calibrate` — a couple of
 * seconds, which is cheap enough not to trade a familiar default for. Pass
 * 20000 when the numbers need to be tight.
 */
const DEFAULT_SEASONS = 5000;

/**
 * Drivers at their ability *in that season*, not at their authored peak. Shared
 * with every other harness here — see `mode.ts` for why peak is not an option
 * for producing a figure. Overridden per run by `--mode peak`.
 */
const SEASON_RATING_MODE: RatingMode = CALIBRATION_RATING_MODE;

/** What one competitor — a driver or a team — accumulated over every season run. */
interface Tally {
  /** Driver id or team id. */
  key: string;
  /** How the row is labelled: the driver's or the team's name. */
  name: string;
  /** Only meaningful on a driver tally: the team that entered them. */
  teamId: string;
  titles: number;
  /** Seasons in which they won at least one race. */
  seasonsWithAWin: number;
  /** Seasons in which they scored at least one point. */
  seasonsWithAPoint: number;
  raceWins: number;
  podiums: number;
  points: number;
  bestPoints: number;
  /** Championship positions summed, for the average finishing position. */
  positions: number;
  /**
   * Seasons they appeared in. Every seed runs the same field today, so this is
   * the run length — but the transfer market will make that untrue, and a rate
   * wants its own denominator rather than the run's.
   */
  seasons: number;
}

/** The value of `--flag <value>`, or undefined. */
function flagValue(argv: readonly string[], ...names: readonly string[]): string | undefined {
  const index = argv.findIndex((arg) => names.includes(arg));
  return index === -1 ? undefined : argv[index + 1];
}

/**
 * Positional arguments only: every flag, and the value that follows it, removed.
 *
 * `year.ts` does this for `--year` alone; the season count has to survive
 * `--mode` too, so this drops any `-`-prefixed argument and its value rather
 * than naming them one at a time.
 */
function positionals(argv: readonly string[]): string[] {
  const kept: string[] = [];
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === undefined) {
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

/**
 * `aged` (the default here) or `peak`.
 *
 * This harness deliberately differs from the package-wide `DEFAULT_RATING_MODE`
 * and from `pnpm calibrate`, both of which are `peak`. A season is a year in
 * someone's career: running it with every driver at their authored peak asks
 * what a grid of thirty simultaneous career-bests would do, which is not a year
 * that ever happens. Ageing the field to the season's own year is the question
 * worth measuring. `--mode peak` is still there for comparing against the
 * race-level figures, which are all peak.
 *
 * An unknown mode throws rather than falling back, for the same reason an
 * unauthored year does: a silent substitution prints one grid under another
 * grid's heading.
 */
function parseMode(argv: readonly string[]): RatingMode {
  const raw = flagValue(argv, "--mode", "-m");
  if (raw === undefined) {
    return SEASON_RATING_MODE;
  }
  const mode = RATING_MODES.find((candidate) => candidate === raw);
  if (mode === undefined) {
    throw new Error(`--mode must be one of ${RATING_MODES.join(", ")}, received "${raw}"`);
  }
  return mode;
}

function per(value: number, seasons: number, digits: number): string {
  return seasons === 0 ? (0).toFixed(digits) : (value / seasons).toFixed(digits);
}

function emptyTally(key: string, name: string, teamId: string): Tally {
  return {
    key,
    name,
    teamId,
    titles: 0,
    seasonsWithAWin: 0,
    seasonsWithAPoint: 0,
    raceWins: 0,
    podiums: 0,
    points: 0,
    bestPoints: 0,
    positions: 0,
    seasons: 0,
  };
}

/** The parts of a standing this harness reads — drivers and teams share them. */
interface Scored {
  readonly points: number;
  readonly wins: number;
  readonly podiums: number;
}

/** One competitor's season folded into their running tally. */
function record(tally: Tally, standing: Scored, position: number, champion: boolean): void {
  tally.seasons += 1;
  tally.points += standing.points;
  tally.raceWins += standing.wins;
  tally.podiums += standing.podiums;
  tally.positions += position;
  tally.bestPoints = Math.max(tally.bestPoints, standing.points);
  if (standing.wins > 0) {
    tally.seasonsWithAWin += 1;
  }
  if (standing.points > 0) {
    tally.seasonsWithAPoint += 1;
  }
  if (champion) {
    tally.titles += 1;
  }
}

/** Titles first, then the points that separate everyone below the champion. */
function ranked(tallies: Iterable<Tally>): Tally[] {
  return [...tallies].sort(
    (a, b) => b.titles - a.titles || b.points - a.points || b.raceWins - a.raceWins,
  );
}

/** Progress on a run long enough to wonder whether it has hung. Stderr, so
 *  piping the table to a file still gives a clean table. */
function reportProgress(done: number, total: number): void {
  if (process.stderr.isTTY) {
    process.stderr.write(`\r  ${done}/${total} seasons…`);
  }
}

function clearProgress(): void {
  if (process.stderr.isTTY) {
    process.stderr.write(`\r${" ".repeat(40)}\r`);
  }
}

function main(): void {
  const year = parseYear(process.argv);
  const count = parseCount(positionals(process.argv)[0], DEFAULT_SEASONS, "Season count");
  const mode = parseMode(process.argv);
  const randomness = parseRandomness(process.argv);
  const authored = seasonSeed(year);
  const constants = seasonConstants(authored, randomness);
  const field = buildField(authored, undefined, mode);
  const teams = teamsById();

  /**
   * What a team was called in the year being run. A lineage carries one name
   * per era — the team that raced as Toleman is Alpine by 2021 — so anything
   * printed has to say which year it is printing.
   */
  const teamNameOf = (teamId: string): string => {
    const team = teams.get(teamId);
    return team === undefined ? teamId : teamIdentityIn(team, year).name;
  };

  const drivers = driversById();

  const driverTallies = new Map<string, Tally>();
  const teamTallies = new Map<string, Tally>();
  for (const entrant of field) {
    driverTallies.set(
      entrant.driverId,
      emptyTally(
        entrant.driverId,
        drivers.get(entrant.driverId)?.name ?? entrant.driverId,
        entrant.teamId,
      ),
    );
    if (!teamTallies.has(entrant.teamId)) {
      const name = teamNameOf(entrant.teamId);
      teamTallies.set(entrant.teamId, emptyTally(entrant.teamId, name, entrant.teamId));
    }
  }

  /**
   * Seasons whose title came down to a tie on points. The standings settle
   * those on countback and, failing that, on id — so a tie is the one place
   * this table reports something the sport might have decided another way, and
   * it is worth knowing how often it happens.
   */
  let tiedTitles = 0;
  let championPoints = 0;
  const startedAt = performance.now();

  for (let seed = 1; seed <= count; seed += 1) {
    // One RNG per season, seeded by the season number: seed 7 here is the same
    // year `pnpm season 7` prints, so anything odd in this table can be read
    // race by race without re-running anything.
    const season = simulateSeason(field, authored.calendar, createRng(seed), constants);
    const table = championshipStandings(season, authored.points);
    const constructors = constructorStandings(season, authored.points);

    const champion = table[0];
    const runnerUp = table[1];
    if (champion !== undefined) {
      championPoints += champion.points;
      if (runnerUp !== undefined && runnerUp.points === champion.points) {
        tiedTitles += 1;
      }
    }

    table.forEach((standing, index) => {
      const tally = driverTallies.get(standing.driverId);
      if (tally === undefined) {
        throw new Error(`Unexpected driver in the standings: ${standing.driverId}`);
      }
      record(tally, standing, index + 1, index === 0);
    });

    constructors.forEach((standing, index) => {
      const tally = teamTallies.get(standing.teamId);
      if (tally === undefined) {
        throw new Error(`Unexpected team in the standings: ${standing.teamId}`);
      }
      record(tally, standing, index + 1, index === 0);
    });

    if (seed % 250 === 0) {
      reportProgress(seed, count);
    }
  }

  clearProgress();
  const elapsed = performance.now() - startedAt;
  const rounds = authored.calendar.length;

  console.log("");
  console.log(`${authored.year} grid — ${count} seasons, seeds 1..${count}, ${mode} ratings`);
  console.log(
    `${rounds} rounds, ${field.length} cars, ${teamTallies.size} teams, ` +
      `${count * rounds} races in ${(elapsed / 1000).toFixed(1)}s`,
  );
  console.log("");

  const teamHeader = [
    padRight("TEAM", 14),
    padLeft("TITLE%", 8),
    padLeft("WIN%", 7),
    padLeft("SCORE%", 8),
    padLeft("AVGPTS", 8),
    padLeft("BEST", 6),
    padLeft("AVGPOS", 8),
    padLeft("WINS/S", 8),
    padLeft("PODS/S", 8),
  ].join("");
  console.log(teamHeader);
  console.log("-".repeat(teamHeader.length));

  for (const team of ranked(teamTallies.values())) {
    console.log(
      [
        padRight(team.name, 14),
        padLeft(pct(team.titles, team.seasons), 8),
        padLeft(pct(team.seasonsWithAWin, team.seasons), 7),
        padLeft(pct(team.seasonsWithAPoint, team.seasons), 8),
        padLeft(per(team.points, team.seasons, 1), 8),
        padLeft(String(team.bestPoints), 6),
        padLeft(per(team.positions, team.seasons, 1), 8),
        padLeft(per(team.raceWins, team.seasons, 2), 8),
        padLeft(per(team.podiums, team.seasons, 2), 8),
      ].join(""),
    );
  }

  console.log("");
  const driverHeader = [
    padRight("DRIVER", 22),
    padRight("TEAM", 14),
    padLeft("TITLE%", 8),
    padLeft("WIN%", 7),
    padLeft("SCORE%", 8),
    padLeft("AVGPTS", 8),
    padLeft("BEST", 6),
    padLeft("AVGPOS", 8),
    padLeft("WINS/S", 8),
    padLeft("PODS/S", 8),
  ].join("");
  console.log(driverHeader);
  console.log("-".repeat(driverHeader.length));

  for (const driver of ranked(driverTallies.values())) {
    console.log(
      [
        padRight(driver.name, 22),
        padRight(teamNameOf(driver.teamId), 14),
        padLeft(pct(driver.titles, driver.seasons), 8),
        padLeft(pct(driver.seasonsWithAWin, driver.seasons), 7),
        padLeft(pct(driver.seasonsWithAPoint, driver.seasons), 8),
        padLeft(per(driver.points, driver.seasons, 1), 8),
        padLeft(String(driver.bestPoints), 6),
        padLeft(per(driver.positions, driver.seasons, 1), 8),
        padLeft(per(driver.raceWins, driver.seasons, 2), 8),
        padLeft(per(driver.podiums, driver.seasons, 2), 8),
      ].join(""),
    );
  }

  const championDrivers = [...driverTallies.values()].filter((tally) => tally.titles > 0).length;
  const championTeams = [...teamTallies.values()].filter((tally) => tally.titles > 0).length;

  console.log("");
  console.log(
    `${championDrivers} of ${driverTallies.size} drivers took a drivers' title; ` +
      `${championTeams} of ${teamTallies.size} teams took a constructors' title.`,
  );
  console.log(
    `Champion's average score: ${per(championPoints, count, 1)} points. ` +
      `Titles tied on points and settled on countback: ${tiedTitles} (${pct(tiedTitles, count)}).`,
  );
  console.log("");
}

main();
