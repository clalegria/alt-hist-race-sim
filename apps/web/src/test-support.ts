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

import {
  authoredLineup,
  authoredSeasons,
  type EmptySeatRules,
  emptySeats,
  FIRST_AUTHORED_SEASON,
  filledLineup,
  keptYear,
  type LineupDraft,
  type RatingMode,
  reserveDrivers,
  type SeasonLineup,
  seasonSeed,
} from "@alt-hist/data";
import { SPRITE_HEIGHT, SPRITE_WIDTH } from "./lib/car-sprites.js";
import { type RevealedWorld, revealYear } from "./lib/reveal.js";
import { HISTORICAL_SETTINGS, OPENING_SEAT_RULES, type RunSettings } from "./lib/run-settings.js";
import type { View } from "./lib/timeline.js";
import {
  createWorld,
  ERA_RATING_MODE,
  type PendingRun,
  type Run,
  stepRun,
  type World,
} from "./store/season.js";

/**
 * The year most fixtures here are built from — the earliest authored one, not a
 * year written down. More than one season is playable now, so anything that
 * must hold *for every* season loops `seasons` instead of using this.
 */
export const YEAR = FIRST_AUTHORED_SEASON;

/** The seed data behind `YEAR`: calendar, entries and cars. */
export const SEED = seasonSeed(YEAR);

/**
 * The first authored year one of whose teams is gone the year after, and that
 * team: where an era that keeps its starting grid first races a ghost entry.
 * Searched for rather than named, so it follows the seed data.
 */
export const FOLDING_YEAR: { readonly year: number; readonly teamId: string } = (() => {
  for (const year of authoredSeasons) {
    const next = authoredSeasons.includes(year + 1) ? seasonSeed(year + 1) : null;
    const later = new Set(next?.entries.map((entry) => entry.teamId));
    const gone = seasonSeed(year).entries.find((entry) => !later.has(entry.teamId));
    if (next !== null && gone !== undefined) {
      return { year, teamId: gone.teamId };
    }
  }
  throw new Error("no team in the seed data ever folds");
})();

/** *Keep the starting grid* with the seats history leaves empty filled by the reader. */
export const READER_RULES: EmptySeatRules = { ...OPENING_SEAT_RULES, fill: "reader" };

/**
 * The first authored year an era under `READER_RULES` started from stops the
 * year after, waiting on the reader: `start`, and `year`, the pending one.
 * Searched for rather than named, through the same data functions the run
 * uses, off the first year's grid as history entered it.
 */
export const PENDING_YEAR: { readonly start: number; readonly year: number } = (() => {
  for (const start of authoredSeasons) {
    if (!authoredSeasons.includes(start + 1)) {
      continue;
    }
    const first = seasonSeed(start);
    const next = keptYear(first, seasonSeed(start + 1), authoredLineup(first), READER_RULES);
    if (emptySeats(next.seats).length > 0) {
      return { start, year: start + 1 };
    }
  }
  throw new Error("no kept year in the seed data ever leaves the reader a seat to fill");
})();

/** An era's settings under `READER_RULES`, everything else historical. */
export const READER_SETTINGS: RunSettings = { ...HISTORICAL_SETTINGS, teamsAndSeats: READER_RULES };

/**
 * An era under `READER_SETTINGS` from `PENDING_YEAR.start` on `seed`, stepped
 * off that year's review: the pending year, waiting on the reader.
 */
export function pendingRun(seed = 9): PendingRun {
  const first = createWorld(
    seed,
    PENDING_YEAR.start,
    ERA_RATING_MODE,
    null,
    null,
    undefined,
    null,
    null,
    READER_SETTINGS,
  );
  const next = stepRun({
    kind: "era",
    run: { startYear: first.year, seasons: [] },
    world: first,
    cursor: { kind: "review" },
  });
  if (next?.kind !== "pending") {
    throw new Error(`expected ${PENDING_YEAR.year} to wait on the reader`);
  }
  return next;
}

/** `seats` with every empty one filled from the drivers holding none, alphabetically. */
export function filledSeats(seats: LineupDraft): SeasonLineup {
  const free = reserveDrivers(seats).map((driver) => driver.id);
  let next = 0;
  const filled: Record<string, readonly (string | null)[]> = {};
  for (const [teamId, row] of Object.entries(seats)) {
    filled[teamId] = row.map((driverId) => driverId ?? free[next++] ?? null);
  }
  const lineup = filledLineup(filled);
  if (lineup === null) {
    throw new Error("not enough free drivers to fill the seats");
  }
  return lineup;
}

/** A run with a world on its cursor: any but one waiting on the reader. */
export type BuiltRun = Exclude<Run, PendingRun>;

/** The run, which a test expects to have a world on its cursor; throws on a pending one. */
export function built(run: Run): BuiltRun {
  if (run.kind === "pending") {
    throw new Error(
      `expected a world on the cursor, found ${run.pending.year} waiting on the reader`,
    );
  }
  return run;
}

/** A season to render. Any seed would do; this one is simply a fixed choice. */
export function seededWorld(seed = 3, mode?: RatingMode, year = YEAR): World {
  return mode === undefined ? createWorld(seed, year) : createWorld(seed, year, mode);
}

/**
 * A season page's props at `view`: the year cut there, exactly as the gate
 * hands it to a page — so a render never sees a result the reader would not.
 */
export function shownAt(world: World, view: View): { world: RevealedWorld; view: View } {
  return { world: revealYear(world, view), view };
}

/**
 * The earliest authored season that enters more cars than the grid holds.
 *
 * Not every year has non-qualifiers — the fifties fields are well inside the
 * starting limit — so a test about the DNQ cut has to be handed a season that
 * actually has one rather than assume the fixture year does.
 */
export const OVERSUBSCRIBED_YEAR: number =
  authoredSeasons.find((year) =>
    createWorld(1, year).season.races.some((race) => race.entries.some((entry) => !entry.started)),
  ) ?? YEAR;

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
  { seeds = 200, mode, year = YEAR }: { seeds?: number; mode?: RatingMode; year?: number } = {},
): World {
  for (let seed = 1; seed <= seeds; seed += 1) {
    const world = seededWorld(seed, mode, year);
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

/**
 * The `<svg>` elements in a rendered tree that are not team cars.
 *
 * Several tests count flags, rain clouds and home stars by counting `<svg>`,
 * and a car is an `<svg>` too. Cars are counted out by their canvas, so a
 * row gaining a car does not read as a row gaining a flag.
 */
export function svgsBesideCars(html: string): number {
  const svgs = html.split("<svg").length - 1;
  const cars = html.split(`viewBox="0 0 ${SPRITE_WIDTH} ${SPRITE_HEIGHT}"`).length - 1;
  return svgs - cars;
}
