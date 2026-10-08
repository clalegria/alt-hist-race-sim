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

import { identityYear } from "@alt-hist/data";
import { cursorPlace, type Run } from "../store/season.js";
import { driverName, teamName } from "./names.js";
import { revealed } from "./reveal.js";
import { lastYearOf, rosterOf } from "./roster.js";
import { driversLink, type RosterLink, type RosterLocation, teamsLink } from "./roster-places.js";
import { laterYears, linkTo, REVIEW_LINK, type RunLink } from "./run-places.js";
import { nextEraYear, seasonSeed } from "./seasons.js";
import { roundLink } from "./session-nav.js";
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

/** The way back to where the run is, from a page that is somewhere else. */
export interface ReturnLink {
  /** The cursor in words, as the run bar says it: "1985 · Grid". */
  readonly label: string;
  readonly link: RunLink;
}

/**
 * The way back to the cursor's page, while the page on screen is another one —
 * the "jump to live" a stream offers once you have scrolled back. Null on the
 * cursor's own page, where there is nowhere to go back to.
 *
 * Continue acts on the cursor whatever page is on screen, so from anywhere
 * else it would advance a run the reader is not looking at; this is what the
 * bar puts first instead.
 */
export function returnFor(run: Run, at: Place | RosterLocation): ReturnLink | null {
  const cursor = cursorPlace(run);
  // A people page is never the cursor's: the run is always somewhere else.
  return !("page" in at) && comparePlaces(at, cursor) === 0
    ? null
    : { label: runBarFor(run).cursor, link: linkTo(cursor) };
}

/** What a run is called on the Home page's Resume card. */
export function runTitle(run: Run): string {
  return run.kind === "era" ? `Era from ${run.run.startYear}` : `${run.world.year} season`;
}

/** Where a crumb or a menu entry can lead: a beat's page, or a people page. */
export type CrumbLink = RunLink | RosterLink;

/** One entry of a crumb's menu: a sibling page, null while it is still ahead. */
export interface CrumbItem {
  readonly label: string;
  readonly link: CrumbLink | null;
  /** The one the page on screen belongs to. */
  readonly current: boolean;
}

/** A crumb's siblings: the run's sections, the other years, or the other rounds of this one. */
export interface CrumbMenu {
  /** What the menu's button is called, for a screen reader. */
  readonly label: string;
  readonly items: readonly CrumbItem[];
}

/** One breadcrumb. `link` is absent for the page itself and for a place not reached. */
export interface Crumb {
  readonly label: string;
  readonly link?: CrumbLink;
  /** Its siblings, so the trail moves sideways as well as up. */
  readonly menu?: CrumbMenu;
}

/** The years the run has reached, earliest first. */
function yearsReached(run: Run): readonly number[] {
  return [
    ...(run.kind === "era" ? run.run.seasons.map((world) => world.year) : []),
    run.world.year,
  ];
}

/** How many rounds a year the run has reached has, off that year's own world. */
function roundsOf(run: Run, year: number): number {
  const world =
    year === run.world.year
      ? run.world
      : run.kind === "era"
        ? run.run.seasons.find((each) => each.year === year)
        : undefined;
  return world?.season.races.length ?? 0;
}

/** An era's sections, as its root crumb's menu lists them. */
export type RunSection = "overview" | "drivers" | "teams";

/**
 * The era's root crumb's menu: **its sections**, the way across to the lists
 * of everyone in it — the overview and the two lists. `current` is the section
 * the page is in, if any; a page of one year is in none of them.
 *
 * A one-year run has no sections: who drove and what they won across a run
 * means something only over several seasons, so its people pages are an era's
 * alone (`resolveRosterPage`).
 */
export function sectionsMenu(current: RunSection | null): CrumbMenu {
  return {
    label: "Run sections",
    items: [
      { label: "Overview", link: REVIEW_LINK, current: current === "overview" },
      { label: "Drivers", link: driversLink(), current: current === "drivers" },
      { label: "Teams", link: teamsLink(), current: current === "teams" },
    ],
  };
}

/** The last crumb is the page itself, so it links nowhere; its menu stays. */
function endingHere(crumbs: readonly Crumb[]): readonly Crumb[] {
  return crumbs.map((crumb, index) => {
    if (index !== crumbs.length - 1 || crumb.link === undefined) {
      return crumb;
    }
    const { link: _, ...rest } = crumb;
    return rest;
  });
}

/**
 * The trail to a people page: `Era › Drivers › Nelson Piquet`. A team is named
 * as of its last year on the run's grid — the name the reader has most
 * recently seen it under. A one-year run never draws one (its door sends every
 * people URL to the season), so its trail is the cursor's.
 */
function rosterCrumbs(run: Run, at: RosterLocation): readonly Crumb[] {
  if (run.kind !== "era") {
    return crumbsFor(run, cursorPlace(run));
  }
  const drivers = at.page === "drivers" || at.page === "driver";
  const crumbs: Crumb[] = [
    { label: "Era", link: REVIEW_LINK, menu: sectionsMenu(drivers ? "drivers" : "teams") },
    drivers ? { label: "Drivers", link: driversLink() } : { label: "Teams", link: teamsLink() },
  ];
  if (at.id !== undefined) {
    const lastYear = lastYearOf(rosterOf(revealed(run).years).teams.get(at.id)) ?? run.world.year;
    crumbs.push({
      label:
        at.page === "driver"
          ? driverName(at.id)
          : teamName(at.id, identityYear(at.id, lastYear, run.world.namesKeptFrom)),
    });
  }
  return endingHere(crumbs);
}

/**
 * The trail to a page, from the run's top: `Era › 1984 › Round 3 › Race`, or
 * `Era › Drivers › Nelson Piquet`. A one-year run has no era above its season,
 * so its trail starts at the year.
 *
 * The trail describes the *page*, where the run bar's cursor text describes
 * how far the run has got; the two differ whenever the reader has gone back to
 * look at something. A crumb links only to a page the reader has reached, and
 * the last crumb — this page — links nowhere.
 *
 * **An era's root crumb carries its sections** (`sectionsMenu`): the way to
 * the lists of everyone in the run. A one-year run's root, its year, carries
 * no menu and links to the season page. On a year the reader has reached, an
 * era's year and any round also carry a **menu of their siblings**: every year
 * reached, each to its season page, once there is more than one; and every
 * round of the year, each where `roundLink` sends it, a round still ahead
 * listed without a link.
 */
export function crumbsFor(run: Run, at: Place | RosterLocation): readonly Crumb[] {
  if ("page" in at) {
    return rosterCrumbs(run, at);
  }
  const place = at;
  const cursor = cursorPlace(run);
  const crumbs: Crumb[] = [];
  const beat = place.beat;
  // The era's overview is there from its first grid on.
  if (run.kind === "era") {
    crumbs.push({
      label: "Era",
      link: REVIEW_LINK,
      menu: sectionsMenu(beat.kind === "review" ? "overview" : null),
    });
  }
  // The year's page opens with its grid, so any page of a year reached has it.
  const yearReached = isReached(cursor, { year: place.year, beat: { kind: "grid" } });
  if (beat.kind !== "review") {
    const years = yearsReached(run);
    crumbs.push({
      label: String(place.year),
      ...(yearReached ? { link: linkTo({ year: place.year, beat: { kind: "summary" } }) } : {}),
      // An era's year carries the other years once there are two; a one-year
      // run's has no siblings, and no sections either.
      ...(run.kind === "era" && yearReached && years.length > 1
        ? {
            menu: {
              label: "Other years",
              items: years.map((year) => ({
                label: String(year),
                link: linkTo({ year, beat: { kind: "summary" } }),
                current: year === place.year,
              })),
            },
          }
        : {}),
    });
  }
  if (beat.kind === "grid") {
    crumbs.push({ label: "Grid" });
  } else if (beat.kind === "qualifying" || beat.kind === "race") {
    const calendar = seasonSeed(place.year).calendar;
    crumbs.push({
      label: `Round ${beat.round + 1}`,
      ...(yearReached
        ? {
            menu: {
              label: "Other rounds",
              items: Array.from({ length: roundsOf(run, place.year) }, (_, round) => ({
                label: `${round + 1} · ${calendar[round]?.name ?? `Round ${round + 1}`}`,
                link: roundLink(cursor, place.year, beat.kind, round),
                current: round === beat.round,
              })),
            },
          }
        : {}),
    });
    crumbs.push({ label: beat.kind === "qualifying" ? "Qualifying" : "Race" });
  }
  return endingHere(crumbs);
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
