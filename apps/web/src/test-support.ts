/**
 * Fixtures for the web tests, derived from the seed data rather than written
 * down.
 *
 * The rule these exist to serve is in `CLAUDE.md`: **no test may depend on an
 * authored number or on what a particular seed produced.** Ratings and season
 * entries are tuned continuously, so "Williams is quicker than Renault", "the
 * grid is 28 cars" and "seed 302280 ends in a tie" are all assertions that fail
 * one day for a reason that is not a bug.
 *
 * A fixed seed as a *fixture* is fine — a render has to be of something. What
 * this module adds is the way out of the other case: when a test needs a season
 * of a particular shape, `findWorld` searches for one instead of pinning the
 * seed that happened to work when the test was written.
 *
 * Not a `.test.ts` file, so Vitest does not collect it.
 */

import type { RatingMode } from "@alt-hist/data";
import { createWorld, type World } from "./store/season.js";

/** The year everything here is built from, and the only one authored so far. */
export const YEAR = 1980;

/** A season to render. Any seed would do; this one is simply a fixed choice. */
export function seededWorld(seed = 3, mode?: RatingMode): World {
  return mode === undefined ? createWorld(seed, YEAR) : createWorld(seed, YEAR, mode);
}

/**
 * The first season matching a condition, by seed.
 *
 * For tests that need a shape rather than a number: a title settled with rounds
 * to spare, a place that changed hands, a race with both a retirement and a
 * non-qualifier. A season is a few hundred microseconds, so a search of a
 * hundred is cheaper than it looks — and it keeps working when every rating in
 * the pool moves.
 */
export function findWorld(
  matches: (world: World) => boolean,
  { seeds = 200, mode }: { seeds?: number; mode?: RatingMode } = {},
): World {
  for (let seed = 1; seed <= seeds; seed += 1) {
    const world = seededWorld(seed, mode);
    if (matches(world)) {
      return world;
    }
  }
  throw new Error(`no season in the first ${seeds} seeds matched`);
}

/** How many teams are on a grid, counted off the grid itself. */
export function teamCount(world: World): number {
  return new Set(world.field.map((entrant) => entrant.teamId)).size;
}

/** How many cars actually took the start of a race — the rest were DNQs. */
export function starterCount(world: World, round = 0): number {
  const race = world.season.races[round];
  if (race === undefined) {
    throw new Error(`the season has no round ${round + 1}`);
  }
  return race.entries.filter((entry) => entry.started).length;
}
