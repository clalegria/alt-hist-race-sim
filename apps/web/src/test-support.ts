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
  authoredSeasons,
  FIRST_AUTHORED_SEASON,
  type RatingMode,
  seasonSeed,
} from "@alt-hist/data";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SplitName } from "./components/FittedName.js";
import { RunSettingsForm } from "./components/RunSettingsDialog.js";
import { SPRITE_HEIGHT, SPRITE_WIDTH } from "./lib/car-sprites.js";
import { driverName } from "./lib/names.js";
import { STARTING_RANDOMNESS_LEVEL } from "./lib/preferences.js";
import { type RevealedWorld, revealYear } from "./lib/reveal.js";
import { HISTORICAL_SETTINGS, type RunSettings, type RunUnit } from "./lib/run-settings.js";
import type { View } from "./lib/timeline.js";
import { createWorld, type World } from "./store/season.js";

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

/** A season to render. Any seed would do; this one is simply a fixed choice. */
/**
 * The run settings form as a screen draws it — a season's, or an era's with
 * its era-only group — every setting historical unless `settings` says
 * otherwise. What the dialog holds; the dialog itself renders into a portal,
 * out of a static render's reach.
 */
export function settingsForm(
  unit: RunUnit,
  settings: RunSettings = HISTORICAL_SETTINGS,
  ratingMode: RatingMode = "aged",
): string {
  return renderToStaticMarkup(
    createElement(RunSettingsForm, {
      choice: { randomness: STARTING_RANDOMNESS_LEVEL, ratingMode, settings },
      year: YEAR,
      unit,
      eraSettings: unit === "era",
    }),
  );
}

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

/**
 * A rendered tree's text, tags stripped (entities left as rendered).
 *
 * A name in a table is split across spans (`SplitName`), so its plain text is
 * not in the markup. Search for a name here instead; a `not.toContain` on the
 * raw markup passes whether the name is on screen or not.
 */
export function textOf(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

/**
 * A driver's name as a row draws it (`SplitName`), escaped as React escapes
 * it. Only a row draws this markup, so a `not.toContain` on it means "in
 * nobody's row" even where the name is in a sentence on the same page.
 */
export function rowName(driverId: string): string {
  return renderToStaticMarkup(createElement(SplitName, { name: driverName(driverId) }));
}

/**
 * A small seeded generator (mulberry32), numbers in `[0, 1)`: a random source
 * for the home screen's decoration, which takes `Math.random` in the app.
 */
export function randomSource(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
