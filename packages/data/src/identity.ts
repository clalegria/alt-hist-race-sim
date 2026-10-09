/**
 * Which year a team's name and base are read at in a run.
 *
 * As history had it, that is the season being shown: the lineage that raced as
 * Brawn in 2009 is Mercedes in 2010. Under an era's *Team name changes:
 * No*, each team keeps the identity of **the first season it appears in the
 * run** — the start year for a team on the opening grid, its debut year for one
 * that enters later — so Brawn stays Brawn. The livery is not part of this: it
 * still follows history, read at the season itself.
 *
 * A year, not a name, so every name and base still resolves through
 * `teamIdentityIn` (`eras.ts`), the one place an era list is indexed.
 *
 * Here rather than in `eras.ts` because it reads the seasons: who raced when is
 * the entry lists, and `eras.ts` deliberately knows only the team.
 */

import { authoredSeasons, seasonSeed } from "./seasons/index.js";

const firstSeasons = new Map<number, ReadonlyMap<string, number>>();

/**
 * Each team's first season at or after `from`, built once per start year: a
 * page asks for one per row, and the scan walks every entry list after it.
 */
function firstSeasonsFrom(from: number): ReadonlyMap<string, number> {
  const known = firstSeasons.get(from);
  if (known !== undefined) {
    return known;
  }
  const found = new Map<string, number>();
  for (const year of authoredSeasons) {
    if (year < from) {
      continue;
    }
    for (const entry of seasonSeed(year).entries) {
      if (!found.has(entry.teamId)) {
        found.set(entry.teamId, year);
      }
    }
  }
  firstSeasons.set(from, found);
  return found;
}

/**
 * The year `teamId`'s name and base are read at in `year`, for a run whose team
 * names are kept from `keptFrom` — null for each year's own, which is `year`.
 *
 * A year before the run, or a team the run has not reached yet, reads at
 * `year` itself: there is no first season in the run to keep.
 */
export function identityYear(teamId: string, year: number, keptFrom: number | null): number {
  if (keptFrom === null || year < keptFrom) {
    return year;
  }
  const first = firstSeasonsFrom(keptFrom).get(teamId);
  return first === undefined || first > year ? year : first;
}
