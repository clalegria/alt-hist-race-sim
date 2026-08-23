/**
 * Which seasons the app offers, and which of them can actually be run.
 *
 * The picker is built for the whole 1980–2026 range from the start, so the day
 * a season is authored the only edit is in `@alt-hist/data` — a `<year>.json`
 * in `packages/data/src/seasons/` and a line in that folder's registry. Which
 * years are listed, which are selectable and what a world is built from all
 * derive from it, so this module holds no list of its own.
 *
 * The range is a *display* decision and belongs here; which years exist is a
 * *data* decision and belongs there. 1950-onwards and post-2026 seasons are
 * both future work, and both are a change to `FIRST_SEASON` / `LAST_SEASON`
 * plus the JSON — nothing else.
 */

import { authoredSeasons, hasSeason, type SeasonSeed, seasonSeed } from "@alt-hist/data";

/** The earliest and latest years the picker draws. Not what has been authored. */
export const FIRST_SEASON = 1950;
export const LAST_SEASON = 2026;

/** Every year in the range, authored or not: the shape of the picker. */
export const SEASON_YEARS: readonly number[] = Array.from(
  { length: LAST_SEASON - FIRST_SEASON + 1 },
  (_, offset) => FIRST_SEASON + offset,
);

/** Playable years, earliest first — the authored seasons, straight from the data. */
export const PLAYABLE_SEASONS: readonly number[] = authoredSeasons;

export function isPlayable(year: number): boolean {
  return hasSeason(year);
}

/** The year a season starts from unless something offers a choice of another. */
export const DEFAULT_SEASON: number = PLAYABLE_SEASONS[0] ?? FIRST_SEASON;

export type { SeasonSeed };
/**
 * The seed data for a season, or a throw. Callers only ever reach this through
 * a year that came out of the picker, and the picker offers no unauthored one.
 */
export { seasonSeed };

/**
 * The authored years as a phrase, for the picker's subtitle.
 *
 * Contiguous runs collapse to a range, because the end state is forty-odd
 * consecutive years and "1980, 1981, 1982, 1983…" is not a sentence. Written
 * here rather than in the component so the copy cannot fall out of step with
 * which years are actually live — it said "Only 1980" for a while after 1981
 * landed, which is the failure this prevents.
 */
export function playableSummary(years: readonly number[] = PLAYABLE_SEASONS): string {
  if (years.length === 0) {
    return "No season has been authored yet";
  }
  const runs: string[] = [];
  let start = years[0] ?? 0;
  let previous = start;
  for (const year of years.slice(1)) {
    if (year !== previous + 1) {
      runs.push(start === previous ? `${start}` : `${start}–${previous}`);
      start = year;
    }
    previous = year;
  }
  runs.push(start === previous ? `${start}` : `${start}–${previous}`);

  const list =
    runs.length === 1
      ? (runs[0] ?? "")
      : `${runs.slice(0, -1).join(", ")} and ${runs[runs.length - 1]}`;
  return years.length === 1 ? `Only ${list} has been authored so far` : `${list} are authored`;
}
