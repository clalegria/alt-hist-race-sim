/**
 * Every authored season, one JSON file per year.
 *
 * **Adding a season is two lines**: drop `<year>.json` in this folder, and add
 * it to `AUTHORED` below. Everything downstream derives — which years the
 * picker offers, which of them are playable, what a world is built from — so
 * there is no UI change and no second list to keep in step.
 *
 * The registry is written out rather than globbed on purpose. `import.meta.glob`
 * would auto-discover the folder in Vite and break every CLI tool the moment
 * `tsx` ran it, and a filesystem read would break the browser. A static import
 * per season is the one form that works in both, keeps the JSON in the bundle
 * with no I/O, and lets `tsc` check each file against `SeasonSeed`.
 *
 * The end state is 1950 to 2026 and beyond. Nothing here is sized for two.
 */

import type { SeasonSeed } from "../types.js";
import season1980 from "./1980.json";
import season1981 from "./1981.json";

/** Add a season here, and nowhere else. Order does not matter. */
const AUTHORED: readonly SeasonSeed[] = [season1980, season1981];

/** Authored seasons by year. */
export const seasons: ReadonlyMap<number, SeasonSeed> = new Map(
  AUTHORED.map((season) => [season.year, season]),
);

/** The years that have seed data, earliest first. */
export const authoredSeasons: readonly number[] = [...seasons.keys()].sort((a, b) => a - b);

/** The earliest authored season — where a run starts unless told otherwise. */
export const FIRST_AUTHORED_SEASON: number = authoredSeasons[0] ?? 1980;

export function hasSeason(year: number): boolean {
  return seasons.has(year);
}

/**
 * The seed data for a year, or a throw.
 *
 * A throw rather than a fallback: a picker that offered an unauthored year by
 * mistake would otherwise look like it worked, quietly running someone else's
 * season under the wrong heading.
 */
export function seasonSeed(year: number): SeasonSeed {
  const seed = seasons.get(year);
  if (seed === undefined) {
    throw new Error(`Season ${year} has not been authored yet`);
  }
  return seed;
}
