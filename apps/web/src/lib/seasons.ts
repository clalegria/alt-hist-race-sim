/**
 * Which seasons the app offers, and which of them can actually be run.
 *
 * The picker is built for the whole 1980–2026 range from the start, so the day
 * a second season is authored the only edit is a line in `AUTHORED` —
 * everything downstream (which years are listed, which are selectable, what a
 * world is built from) is derived from it. Roadmap 5 is where the rest of the
 * code stops being pinned to 1980; this is the part of it the UI needs early,
 * and it deliberately does not pretend the other 46 years exist.
 */

import { type SeasonSeed, season1980 } from "@alt-hist/data";

/** The season the simulation starts from, and the year it is being run towards. */
export const FIRST_SEASON = 1980;
export const LAST_SEASON = 2026;

/** Every year in the range, authored or not: the shape of the picker. */
export const SEASON_YEARS: readonly number[] = Array.from(
  { length: LAST_SEASON - FIRST_SEASON + 1 },
  (_, offset) => FIRST_SEASON + offset,
);

/** The seasons that have seed data. Add to this map, never to the UI. */
const AUTHORED: ReadonlyMap<number, SeasonSeed> = new Map([[season1980.year, season1980]]);

/** Playable years, earliest first — derived, so it cannot disagree with the map. */
export const PLAYABLE_SEASONS: readonly number[] = [...AUTHORED.keys()].sort((a, b) => a - b);

export function isPlayable(year: number): boolean {
  return AUTHORED.has(year);
}

/** The year a season starts from unless something offers a choice of another. */
export const DEFAULT_SEASON: number = PLAYABLE_SEASONS[0] ?? FIRST_SEASON;

/**
 * The seed data for a season, or a throw. Callers only ever reach this through
 * a year that came out of the picker, and the picker offers no unauthored one.
 */
export function seasonSeed(year: number): SeasonSeed {
  const seed = AUTHORED.get(year);
  if (seed === undefined) {
    throw new Error(`Season ${year} has not been authored yet`);
  }
  return seed;
}
