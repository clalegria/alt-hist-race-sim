/**
 * Reading a season's result rows one competitor at a time.
 *
 * The engine stores a row per (driver, race) and derives the championship from
 * it on read. A standings table is that data sliced by *who*; this module
 * slices the same data by who as well, but keeps the rounds — which is what a
 * reader wants when they ask "how did Jones actually get to 67 points?".
 *
 * Nothing is stored and nothing is counted twice: `driverRounds` and
 * `teamRounds` walk the same `SeasonResult` the standings do.
 */

import {
  championshipStandings,
  pointsForPosition,
  type RaceEntryResult,
  type SeasonResult,
} from "@alt-hist/engine";

/**
 * Classification order for the rows of one race: finishers by position, then
 * the retirements, then the cars that never started — the last two by grid
 * slot, since they have no finishing position to sort on.
 *
 * Shared by the full classification and by a team's two or three cars within a
 * round, so a team's own rows are ordered exactly as the race sheet ordered
 * them.
 */
export function byClassification(a: RaceEntryResult, b: RaceEntryResult): number {
  const group = (entry: RaceEntryResult): number => {
    if (entry.finishPosition !== null) {
      return 0;
    }
    return entry.started ? 1 : 2;
  };
  const difference = group(a) - group(b);
  if (difference !== 0) {
    return difference;
  }
  if (a.finishPosition !== null && b.finishPosition !== null) {
    return a.finishPosition - b.finishPosition;
  }
  return a.gridPosition - b.gridPosition;
}

/** What became of one entry, in the words the race classification uses. */
export function statusOf(entry: RaceEntryResult): string {
  if (!entry.started) {
    return "Did not qualify";
  }
  if (entry.dnfCause === "mechanical") {
    return "Retired — mechanical";
  }
  if (entry.dnfCause === "driver-error") {
    return "Retired — driver error";
  }
  return "Finished";
}

/** What a result row was worth. Zero for a retirement, a DNQ, and 7th down. */
export function pointsFor(entry: RaceEntryResult): number {
  // The default scale, as the classification uses: nothing yet runs a season on
  // another one.
  return entry.finishPosition === null ? 0 : pointsForPosition(entry.finishPosition);
}

/** One result row, with the round it came from. */
export interface RoundEntry {
  /** Zero-based index into `season.races`, so `round + 1` is what a reader sees. */
  readonly round: number;
  readonly entry: RaceEntryResult;
  readonly points: number;
}

/**
 * Every round a competitor appears in, in order.
 *
 * Rounds they do not appear in are **left out rather than listed as blanks**.
 * Today every entry list runs the whole season so that never happens, but the
 * transfer market will make it ordinary — a driver signed mid-season has no row
 * for the rounds before it, and a team that folds has none after — and a gap in
 * the round numbers says that better than a column of dashes.
 *
 * More than one row per round is likewise ordinary: a team runs one car, two,
 * or occasionally three, and every one of them is a row.
 */
function roundsMatching(
  season: SeasonResult,
  matches: (entry: RaceEntryResult) => boolean,
  within: (a: RaceEntryResult, b: RaceEntryResult) => number = byClassification,
): readonly RoundEntry[] {
  const rounds: RoundEntry[] = [];
  season.races.forEach((race, round) => {
    // `filter` copies, so the sort cannot disturb the stored result order.
    for (const entry of race.entries.filter(matches).sort(within)) {
      rounds.push({ round, entry, points: pointsFor(entry) });
    }
  });
  return rounds;
}

/** One driver's season, round by round. One row per round they entered. */
export function driverRounds(season: SeasonResult, driverId: string): readonly RoundEntry[] {
  return roundsMatching(season, (entry) => entry.driverId === driverId);
}

/**
 * Where each driver finished the drivers' championship, by id.
 *
 * Derived from the same results as everything else here, so it costs a walk of
 * the season and never disagrees with the table on screen.
 */
function championshipOrder(season: SeasonResult): ReadonlyMap<string, number> {
  return new Map(
    championshipStandings(season).map((standing, index) => [standing.driverId, index]),
  );
}

/**
 * One team's season, round by round — **one row per car**, not per round.
 *
 * A round where a team ran three cars is three rows and a round where it ran
 * one is one, which is the only shape that survives a grid the reader can edit
 * and eras that entered whatever they felt like.
 *
 * The cars within a round are ordered by where their drivers **finished the
 * championship**, not by where they finished that race. Race order sounds like
 * the obvious choice and reads badly: the same two names swap places down the
 * page round after round, and a reader trying to follow one of them has to find
 * the name again every line. A fixed order turns the panel into two columns of
 * one driver each. Classification order breaks a tie — two cars level in the
 * championship, or a driver who somehow has no standing at all.
 */
export function teamRounds(season: SeasonResult, teamId: string): readonly RoundEntry[] {
  const order = championshipOrder(season);
  const place = (entry: RaceEntryResult) => order.get(entry.driverId) ?? Number.MAX_SAFE_INTEGER;
  return roundsMatching(
    season,
    (entry) => entry.teamId === teamId,
    (a, b) => place(a) - place(b) || byClassification(a, b),
  );
}
