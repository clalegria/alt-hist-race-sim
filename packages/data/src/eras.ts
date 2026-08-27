/**
 * Reading a team's era lists.
 *
 * A team is one organisation for its whole life, but what it is *called*, where
 * it is registered and what colour it is painted are all facts about a span of
 * years rather than about the team. Each is a sorted list of eras on `Team`, and
 * this module is the only place the lists are indexed — so a badge, a
 * classification and a standings chart cannot disagree about what a team was in
 * 1986.
 *
 * The resolution rule is the same for every list and deliberately dull: the era
 * in force is **the last one whose `from` has arrived**. A year before the first
 * era falls back to that first era rather than throwing, because the caller is a
 * render and the alternative to an approximate name is no name at all.
 *
 * Nothing here is simulated. The engine reads none of it.
 */

import type { Era, Livery, Team, TeamIdentity } from "./types.js";

/**
 * The era in force in `year`, or the most recent one when no year is given.
 *
 * "Most recent" rather than "first" for the year-less case on purpose: asked
 * what a team is called with no season in hand, the useful answer is what it is
 * called *now* — the lineage that began as Toleman is Alpine to a reader
 * choosing a team from a list, and Toleman only to someone already in 1983.
 *
 * The lists are short — one to six entries — so this scans rather than
 * bisecting. A binary search here would be longer to read and no faster at this
 * size.
 */
export function eraAt<T extends Era>(eras: readonly T[], year?: number): T {
  const first = eras[0];
  if (first === undefined) {
    throw new Error("A team's era list is empty; every team has at least one era");
  }
  if (year === undefined) {
    return eras[eras.length - 1] as T;
  }
  let found = first;
  for (const era of eras) {
    if (era.from > year) {
      break;
    }
    found = era;
  }
  return found;
}

/** What the team was called in `year`, and where it was registered. */
export function teamIdentityIn(team: Team, year?: number): TeamIdentity {
  return eraAt(team.identity, year);
}

/** What the team was painted in `year`. */
export function teamLiveryIn(team: Team, year?: number): Livery {
  return eraAt(team.liveries, year);
}
