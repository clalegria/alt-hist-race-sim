/**
 * What the run bar offers, and what its breadcrumbs say, as data.
 *
 * Pure and exported because the bar *is* the run's navigation: an action
 * missing from the wrong beat strands the reader with no way on, and one
 * present on the wrong beat reaches a store action that refuses it. Kept apart
 * from `RunBar.tsx` so the whole set is tested without a DOM — the overflow
 * menu's items render into a portal, which a static render never draws.
 */

import { crowned, cursorPlace, type Run } from "../store/season.js";
import { linkTo, REVIEW_LINK, type RunLink } from "./run-places.js";
import { isPlayable, nextEraYear, PLAYABLE_SEASONS } from "./seasons.js";
import { describeBeat, isReached, nextBeat, type Place } from "./timeline.js";

/** Where the cursor is, and which of the bar's actions it allows. */
export interface RunBarState {
  /** The cursor in words: "1984 · Round 3/16 · Race". */
  readonly cursor: string;
  /** What Continue reveals, in the same words; null where there is nothing next. */
  readonly next: string | null;
  /** The overflow's skip, worded for where the season is; null where there is none. */
  readonly skip: string | null;
  /** Whether the overflow offers a jump forward through the era. */
  readonly jump: boolean;
  /** Whether the overflow offers Start again: off the grid, and not between years. */
  readonly restart: boolean;
}

export function runBarFor(run: Run): RunBarState {
  const { world, cursor } = run;
  const rounds = world.season.races.length;
  const nextYear = run.kind === "era" ? nextEraYear(world.year) : null;
  const next = nextBeat(cursor, rounds, run.kind === "era", nextYear !== null);
  // Off a review the next beat is the *next year's* grid, so it carries that year.
  const nextLabel =
    next === null
      ? null
      : `${cursor.kind === "review" ? nextYear : world.year} · ${describeBeat(next, rounds)}`;
  // Nothing is left to skip once the last race has been run: the summary is
  // what Continue does from there anyway.
  const lastRace = cursor.kind === "race" && cursor.round + 1 >= rounds;
  return {
    cursor: `${world.year} · ${describeBeat(cursor, rounds)}`,
    next: nextLabel,
    skip:
      cursor.kind === "grid"
        ? "Simulate full season"
        : (cursor.kind === "qualifying" || cursor.kind === "race") && !lastRace
          ? "Simulate rest of the season"
          : null,
    jump: cursor.kind === "review" && eraActionsFor(world.year).rest !== null,
    restart: cursor.kind !== "grid" && cursor.kind !== "review",
  };
}

/** What a run is called on the Home page's Resume card. */
export function runTitle(run: Run): string {
  return run.kind === "era" ? `Era from ${run.run.startYear}` : `${run.world.year} season`;
}

/** One breadcrumb. `link` is absent for the page itself and for a place not reached. */
export interface Crumb {
  readonly label: string;
  readonly link?: RunLink;
}

/**
 * The trail to `place`, from the run's top: `Era › 1984 › Round 3 › Race`.
 * A one-year run has no era above its season, so its trail starts at the year.
 *
 * The trail describes the *page*, where the run bar's cursor text describes
 * how far the run has got; the two differ whenever the reader has gone back to
 * look at something. A crumb links only to a page the reader has reached, and
 * the last crumb — this page — links nowhere.
 */
export function crumbsFor(run: Run, place: Place): readonly Crumb[] {
  const cursor = cursorPlace(run);
  const crumbs: { label: string; link?: RunLink | undefined }[] = [];
  if (run.kind === "era") {
    crumbs.push({
      label: "Era",
      link: crowned(run).seasons.length > 0 ? REVIEW_LINK : undefined,
    });
  }
  const beat = place.beat;
  if (beat.kind !== "review") {
    const summary: Place = { year: place.year, beat: { kind: "summary" } };
    crumbs.push({
      label: String(place.year),
      link: isReached(cursor, summary) ? linkTo(summary) : undefined,
    });
  }
  if (beat.kind === "grid") {
    crumbs.push({ label: "Grid" });
  } else if (beat.kind === "qualifying" || beat.kind === "race") {
    crumbs.push({ label: `Round ${beat.round + 1}` });
    crumbs.push({ label: beat.kind === "qualifying" ? "Qualifying" : "Race" });
  }
  return crumbs.map((crumb, index) =>
    crumb.link === undefined || index === crumbs.length - 1
      ? { label: crumb.label }
      : { label: crumb.label, link: crumb.link },
  );
}

/**
 * The two ways on from the roll of honour: the next year, and the far end.
 *
 * `next` is the year that follows the last one crowned, and `rest` the year the
 * era can run to in one go — null for each where it is not offered. `rest` is
 * null at the end of the range, and also when the next year *is* the end: a
 * jump that does what Continue does is a worse offer than none.
 */
export function eraActionsFor(lastCrowned: number | undefined): {
  next: number | null;
  rest: number | null;
} {
  const next = lastCrowned === undefined ? null : nextEraYear(lastCrowned);
  const end = PLAYABLE_SEASONS.at(-1);
  return { next, rest: next === null || end === undefined || next === end ? null : end };
}

/**
 * Which year a jump forward will actually run to.
 *
 * The reader picks a year in a picker that can outlive the jump it describes,
 * so a chosen year is only honoured while it is still ahead of the run and
 * still has a season behind it. Anything else falls back to `rest`, the far
 * end, which is also what an untouched picker means — a stale year here would
 * either do nothing or quietly run the era to 2026.
 */
export function eraJumpTarget(
  lastCrowned: number | undefined,
  chosen: number | null,
): number | null {
  const { next, rest } = eraActionsFor(lastCrowned);
  // Where there is no jump to make there is no target, whatever was picked.
  if (rest === null || next === null) {
    return null;
  }
  return chosen !== null && chosen >= next && isPlayable(chosen) ? chosen : rest;
}
