/**
 * What the run bar offers, and what its breadcrumbs say, as data.
 *
 * Pure and exported because the bar *is* the run's navigation: an action
 * missing from the wrong beat strands the reader with no way on, and one
 * present on the wrong beat reaches a store action that refuses it. Kept apart
 * from `RunBar.tsx` so the whole set is tested without a DOM — the phone's
 * overflow menu renders into a portal, which a static render never draws.
 *
 * The actions come in three kinds: **forward** (Continue one beat, or jump to a
 * later one), **over again** (the season, or the whole era, on new dice), and
 * **out** (exit the run). Nothing goes back in time.
 */

import { crowned, cursorPlace, type Run } from "../store/season.js";
import { laterYears, linkTo, REVIEW_LINK, type RunLink } from "./run-places.js";
import { nextEraYear } from "./seasons.js";
import { comparePlaces, describeBeat, isReached, nextBeat, type Place } from "./timeline.js";

/** Where the cursor is, and which of the bar's actions it allows. */
export interface RunBarState {
  /** The cursor in words: "1984 · Round 3/16 · Race". */
  readonly cursor: string;
  /** What Continue reveals, in the same words; null where there is nothing next. */
  readonly next: string | null;
  /**
   * The shortcut to the end of this season — a jump with its commonest target —
   * worded for where the season is; null where there is no season left to skip.
   */
  readonly skip: string | null;
  /** Whether Jump to… is offered: an era with a later year to land in. */
  readonly jump: boolean;
  /** Whether Restart season is offered: off the grid, and not between years. */
  readonly restartSeason: boolean;
  /** Whether Restart era is offered: an era past its first grid. */
  readonly restartEra: boolean;
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
    // This year's end alone is what the skip already offers.
    jump: jumpYears(run).some((year) => year > world.year),
    restartSeason: cursor.kind !== "grid" && cursor.kind !== "review",
    restartEra: run.kind === "era" && (run.run.seasons.length > 0 || cursor.kind !== "grid"),
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

/** Where in a year a jump lands: its grid, or its end (the season summary). */
export type JumpPoint = "start" | "end";

/** The place a jump to `point` of `year` lands on. */
export function jumpPlace(year: number, point: JumpPoint): Place {
  return { year, beat: point === "start" ? { kind: "grid" } : { kind: "summary" } };
}

/**
 * The years a jump can land in, in order: this year while its end is still
 * ahead, then every year the run can reach after it (`laterYears`, the same
 * list a "Not reached yet" page is offered for), so a year with no seed data
 * ends the list rather than being offered and then refused. A one-year run has
 * only its own.
 */
export function jumpYears(run: Run): readonly number[] {
  const year = run.world.year;
  const thisYear = comparePlaces(jumpPlace(year, "end"), cursorPlace(run)) > 0 ? [year] : [];
  return [...thisYear, ...laterYears(run)];
}

/**
 * Where a jump the reader has set up actually lands.
 *
 * The dialog's choice can outlive what it describes — the run moves on under
 * it — so it is only honoured while it is still ahead of the cursor. A year
 * that is not, or no year chosen, falls back to the first year a jump can
 * reach after this one; the start of a year already begun falls back to its
 * end. Null when there is nowhere to jump at all.
 */
export function jumpTarget(
  run: Run,
  chosen: { readonly year: number | null; readonly point: JumpPoint },
): Place | null {
  const years = jumpYears(run);
  const later = years.find((year) => year > run.world.year);
  const year =
    chosen.year !== null && years.includes(chosen.year) ? chosen.year : (later ?? years[0]);
  if (year === undefined) {
    return null;
  }
  const wanted = jumpPlace(year, chosen.point);
  return comparePlaces(wanted, cursorPlace(run)) > 0 ? wanted : jumpPlace(year, "end");
}
