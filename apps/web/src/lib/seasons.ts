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

import {
  applyChassis,
  applyEngineRatings,
  applyLineup,
  authoredEngineRatings,
  authoredSeasons,
  hasSeason,
  type SeasonChassis,
  type SeasonEngineRatings,
  type SeasonSeed,
  seasonSeed,
  seatedSeason,
  withFirstEngines,
  withTrends,
} from "@alt-hist/data";
import type { World } from "../store/season.js";

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
 * A season as a run entered it: the seed data, with the run's own chassis in
 * it when Chassis performance rolled some (`World.baselineChassis`).
 *
 * What every "was this edited?" compares against — the editor's Restore, the
 * change notices, `createWorld`'s normalising — so a rolled car is the year's
 * starting point and never reads as the reader's edit.
 */
export function seasonWithChassis(year: number, chassis: SeasonChassis | null): SeasonSeed {
  return withChassis(seasonSeed(year), chassis);
}

export function withChassis(season: SeasonSeed, chassis: SeasonChassis | null): SeasonSeed {
  return chassis === null ? season : applyChassis(season, chassis);
}

/** What the run's settings made of a year's cars, as a world records it. */
export type RunCars = Pick<
  World,
  "enginesKeptFrom" | "baselineChassis" | "baselineEngineRatings" | "baselineTrends"
>;

/**
 * A season with the run's own cars in it: each team's first engine under
 * *Engine supplier changes: No*, then the rolled chassis, the rolled engines and
 * the drawn trends — each only where the run has one. The one order both
 * `createWorld` and `enteredSeason` apply them in, so the two cannot disagree.
 */
export function withRunCars(season: SeasonSeed, cars: RunCars): SeasonSeed {
  const supplied = withFirstEngines(season, cars.enginesKeptFrom);
  const chassis = withChassis(supplied, cars.baselineChassis);
  const engines = withEngineRatings(chassis, cars.baselineEngineRatings);
  return cars.baselineTrends === null ? engines : withTrends(engines, cars.baselineTrends);
}

function withEngineRatings(season: SeasonSeed, ratings: SeasonEngineRatings | null): SeasonSeed {
  return ratings === null ? season : applyEngineRatings(season, ratings);
}

type HistoricalInputs = Pick<World, "year" | "kept" | "enginesKeptFrom" | "baselineEngineRatings">;

const historicalEngines = new WeakMap<HistoricalInputs, SeasonEngineRatings>();

/**
 * Each engine as history rated it for this year — under *Engine supplier
 * changes: No*, the kept engines' too — when the run rolled its own, or null.
 * What the team popover sets beside the run's engine, as the authored chassis
 * is beside a rolled one. Memoised per world, as `enteredSeason` is.
 */
export function historicalEngineRatings(world: HistoricalInputs): SeasonEngineRatings | null {
  if (world.baselineEngineRatings === null) {
    return null;
  }
  const known = historicalEngines.get(world);
  if (known !== undefined) {
    return known;
  }
  const entered = world.kept?.season ?? seasonSeed(world.year);
  const ratings = authoredEngineRatings(withFirstEngines(entered, world.enginesKeptFrom));
  historicalEngines.set(world, ratings);
  return ratings;
}

/** What `enteredSeason` reads: a `World`, or the revealed one a page holds. */
type EnteredInputs = Pick<World, "year" | "kept" | "keptSeats" | "reseated"> & RunCars;

const enteredSeasons = new WeakMap<EnteredInputs, SeasonSeed>();

/**
 * The season as the run entered this world's year, which every "was this
 * edited?" compares against: the editor's Restore, the change notices. The seed
 * file with the run's own cars (`withRunCars`); under Keep, the kept year with
 * them and its signings; under *Who drives where*, reseated. Memoised per
 * world, since worlds are never mutated, so a component reading it gets the
 * same object every render.
 */
export function enteredSeason(world: EnteredInputs): SeasonSeed {
  const known = enteredSeasons.get(world);
  if (known !== undefined) {
    return known;
  }
  const seated =
    world.kept === null || world.keptSeats === null
      ? withRunCars(seasonSeed(world.year), world)
      : seatedSeason(withRunCars(world.kept.season, world), world.keptSeats);
  const season = world.reseated === null ? seated : applyLineup(seated, world.reseated);
  enteredSeasons.set(world, season);
  return season;
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

/**
 * The playable season either side of one, or null where the range runs out.
 *
 * `step` is -1 for the year before and +1 for the year after. Not `year ± 1`:
 * what a reader wants next to 1980 is the previous *playable* season, and the
 * authored range is only contiguous by accident of it being fully written. This
 * walks the playable list instead, so a gap in the seed data skips rather than
 * offering a year that `seasonSeed` would throw on.
 *
 * A year that is not itself playable has no neighbours here — every caller
 * reaches this through a world, and a world's year is always playable.
 */
export function adjacentSeason(year: number, step: -1 | 1): number | null {
  const at = PLAYABLE_SEASONS.indexOf(year);
  return at === -1 ? null : (PLAYABLE_SEASONS[at + step] ?? null);
}
