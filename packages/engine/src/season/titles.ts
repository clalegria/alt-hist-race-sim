/**
 * When a championship stops being a contest.
 *
 * A title is settled the moment nobody else can reach the leader's total, which
 * can happen with rounds still to run — the interesting case, and the reason
 * this is worth computing rather than waiting for the last race.
 */

import { SEASON_CONSTANTS, type SeasonConstants } from "./constants.js";
import type { ConstructorStanding, DriverStanding } from "./types.js";

/**
 * The most one round can be worth to a competitor fielding `cars` of them.
 *
 * A driver has one car, so this is the win. A constructor scores with every car
 * it enters, so a two-car team's best round is a one-two — 15 points on the 1980
 * scale, not 9. Getting this wrong declares titles settled a round or two early,
 * which is the kind of error that looks like a rounding slip and is not.
 */
export function bestPossibleRound(cars: number, constants: SeasonConstants): number {
  let total = 0;
  for (let position = 0; position < cars; position += 1) {
    total += constants.pointsByPosition[position] ?? 0;
  }
  return total;
}

/**
 * The competitor who can no longer be caught, or null while the title is live.
 *
 * While rounds remain the comparison is strict: a challenger who can *equal* the
 * leader has not been beaten, because a tie on points falls to countback, and
 * countback is a result rather than a certainty. Every challenger is checked,
 * not just the runner-up — with unequal car counts the biggest remaining threat
 * is not always the team currently second.
 *
 * Once no rounds remain that reasoning inverts: countback has *happened*, the
 * standings are final, and whoever the sort put first is the champion however
 * close the points are. Without this the strict comparison never resolves a
 * season that ends level on points — the title would read as still live after
 * the last race, which is how it was found.
 *
 * A field with nobody to catch the leader is settled by definition.
 */
export function titleClinchedBy<T extends { readonly points: number }>(
  standings: readonly T[],
  roundsRemaining: number,
  bestRound: (competitor: T) => number,
): T | null {
  const leader = standings[0];
  if (leader === undefined) {
    return null;
  }
  if (roundsRemaining <= 0) {
    return leader;
  }
  const challengers = standings.slice(1);
  if (challengers.length === 0) {
    return leader;
  }

  let bestChallenge = Number.NEGATIVE_INFINITY;
  for (const challenger of challengers) {
    const reachable = challenger.points + Math.max(roundsRemaining, 0) * bestRound(challenger);
    bestChallenge = Math.max(bestChallenge, reachable);
  }

  return leader.points > bestChallenge ? leader : null;
}

/** The drivers' champion, once the arithmetic says so. One car each. */
export function driversTitleClinchedBy(
  standings: readonly DriverStanding[],
  roundsRemaining: number,
  constants: SeasonConstants = SEASON_CONSTANTS,
): DriverStanding | null {
  const win = bestPossibleRound(1, constants);
  return titleClinchedBy(standings, roundsRemaining, () => win);
}

/** The constructors' champion, allowing each team its own number of cars. */
export function constructorsTitleClinchedBy(
  standings: readonly ConstructorStanding[],
  roundsRemaining: number,
  constants: SeasonConstants = SEASON_CONSTANTS,
): ConstructorStanding | null {
  return titleClinchedBy(standings, roundsRemaining, (team) =>
    bestPossibleRound(team.cars, constants),
  );
}
