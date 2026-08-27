/**
 * Which seasons the app offers, and which of them can actually be run.
 *
 * The picker is built for the whole 1950–2026 range from the start, so adding a
 * season is one file in `@alt-hist/data` — a `<year>.json` in
 * `packages/data/src/seasons/`, which that package discovers by itself. Which
 * years are listed, which are selectable and what a world is built from all
 * derive from it, so this module holds no list of its own.
 *
 * The range is a *display* decision and belongs here; which years exist is a
 * *data* decision and belongs there. 1950-onwards and post-2026 seasons are
 * both future work, and both are a change to `FIRST_SEASON` / `LAST_SEASON`
 * plus the JSON — nothing else.
 */

import { authoredSeasons, hasSeason, type SeasonSeed, seasonSeed } from "@alt-hist/data";

/** The earliest and latest years the picker draws. Not what has seed data. */
export const FIRST_SEASON = 1950;
export const LAST_SEASON = 2026;

/** Every year in the range, playable or not: the shape of the picker. */
export const SEASON_YEARS: readonly number[] = Array.from(
  { length: LAST_SEASON - FIRST_SEASON + 1 },
  (_, offset) => FIRST_SEASON + offset,
);

/** Playable years, earliest first — whatever has seed data, straight from the data. */
export const PLAYABLE_SEASONS: readonly number[] = authoredSeasons;

export function isPlayable(year: number): boolean {
  return hasSeason(year);
}

/**
 * The decade a year belongs to, named by its first year: 1980 for 1984.
 *
 * The picker is two steps — a rail of decades, then the years in one of them —
 * because seventy-seven near-identical numbers in one block is a wall rather
 * than a choice. Which decade is *open* is not state: it is `decadeOf` the year
 * currently selected, so there is no way to be in a decade without a year, and
 * the whole picker is controlled by that one value.
 */
export function decadeOf(year: number): number {
  return Math.floor(year / 10) * 10;
}

/** Every decade the range touches, earliest first. The rail. */
export const SEASON_DECADES: readonly number[] = [...new Set(SEASON_YEARS.map(decadeOf))];

/**
 * The years of one decade that the range actually covers.
 *
 * Filtered rather than counted to ten: the range starts and ends mid-decade
 * (1950 and 2026 today), so the first and last rows are short, and writing ten
 * would draw years the app does not claim to offer.
 */
export function yearsInDecade(decade: number): readonly number[] {
  return SEASON_YEARS.filter((year) => decadeOf(year) === decade);
}

/** The year the picker opens on. The earliest playable one, not a year written down. */
export const DEFAULT_SEASON_YEAR: number = PLAYABLE_SEASONS[0] ?? FIRST_SEASON;

export type { SeasonSeed };
/**
 * The seed data for a season, or a throw. Callers only ever reach this through
 * a year that came out of the picker, and the picker offers no year without it.
 */
export { seasonSeed };

/**
 * The playable years as a phrase, for the picker's subtitle.
 *
 * Contiguous runs collapse to a range, because the end state is forty-odd
 * consecutive years and "1980, 1981, 1982, 1983…" is not a sentence. Written
 * here rather than in the component so the copy cannot fall out of step with
 * which years are actually live — it said "Only 1980" for a while after 1981
 * landed, which is the failure this prevents. It carries its own "so far", so
 * the caller adds nothing.
 */
export function playableSummary(years: readonly number[] = PLAYABLE_SEASONS): string {
  if (years.length === 0) {
    return "No season is playable yet";
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
  return years.length === 1 ? `Only ${list} is playable so far` : `${list} are playable so far`;
}

/**
 * The year an era runs on to after this one, or null where it stops.
 *
 * The stop is "the next year has no seed data", not a year written down: an era
 * ends at 2026 today because that is the last season authored, and it will end
 * later without this changing. The basic era mode reads the real grid for every
 * year it runs, so a year nobody has authored is a year it cannot play.
 */
export function nextEraYear(year: number): number | null {
  return isPlayable(year + 1) ? year + 1 : null;
}
