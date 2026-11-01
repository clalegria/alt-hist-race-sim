/**
 * What the run bar offers, and what its breadcrumbs say, as data.
 *
 * Pure and exported because the bar *is* the run's navigation: an action
 * missing from the wrong beat strands the reader with no way on, and one
 * present on the wrong beat reaches a store action that refuses it. Kept apart
 * from `RunBar.tsx` so the whole set, and where each goes, is tested without a
 * DOM — the ⋯ menu renders into a portal, which a static render never draws.
 *
 * The actions come in three kinds: **forward** (Continue one beat, or jump to a
 * later one), **over again** (the season, or the whole era, on new dice), and
 * **out** (exit the run). Nothing goes back in time.
 */

import { firstYearInRun } from "@alt-hist/data";
import { championshipStandings } from "@alt-hist/engine";
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
  /** The cursor in words: "1984 · Round 3 of 16 · Race". */
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
  /** How many rounds the cursor's season has. */
  readonly rounds: number;
  /** How many of them have had their race shown: none on the grid, all from the summary on. */
  readonly roundsRun: number;
}

export function runBarFor(run: Run): RunBarState {
  const { world, cursor } = run;
  const rounds = world.season.races.length;
  const nextYear = run.kind === "era" ? nextEraYear(world.year) : null;
  const hasNextYear = nextYear !== null;
  const next = nextBeat(cursor, rounds, run.kind === "era", hasNextYear);
  // Off a review the next beat is the *next year's* grid, so it carries that year.
  const nextLabel =
    next === null
      ? null
      : `${cursor.kind === "review" ? nextYear : world.year} · ${describeBeat(next, rounds, hasNextYear)}`;
  // Nothing is left to skip once the last race has been run: the summary is
  // what Continue does from there anyway.
  const lastRace = cursor.kind === "race" && cursor.round + 1 >= rounds;
  return {
    cursor: `${world.year} · ${describeBeat(cursor, rounds, hasNextYear)}`,
    next: nextLabel,
    skip:
      cursor.kind === "grid"
        ? "Simulate whole season"
        : (cursor.kind === "qualifying" || cursor.kind === "race") && !lastRace
          ? "Simulate rest of season"
          : null,
    // This year's end alone is what the skip already offers.
    jump: jumpYears(run).some((year) => year > world.year),
    restartSeason: cursor.kind !== "grid" && cursor.kind !== "review",
    restartEra: run.kind === "era" && (run.run.seasons.length > 0 || cursor.kind !== "grid"),
    rounds,
    // A round counts once its race is shown, so its qualifying leaves it to come.
    roundsRun:
      cursor.kind === "grid"
        ? 0
        : cursor.kind === "qualifying"
          ? cursor.round
          : cursor.kind === "race"
            ? cursor.round + 1
            : rounds,
  };
}

/** One of the run bar's actions that does something, rather than going somewhere. */
export type RunCommand = "continue" | "skip" | "jump" | "restartSeason" | "restartEra" | "exit";

/** Any of the run bar's actions: a command, or the way back to the cursor's page. */
export type RunActionKey = RunCommand | "back";

/** Continue in its slot: disabled, saying why, rather than removed. */
export interface ContinueSlot {
  readonly kind: "continue";
  /** Primary on the cursor's own page; outlined beside the way back. */
  readonly primary: boolean;
  /** Why it cannot be pressed, or null while it can. */
  readonly disabled: string | null;
}

/** The run's restart in Continue's slot, where the run has nowhere further to go. */
export interface RestartSlot {
  readonly kind: "restart";
  readonly key: "restartSeason" | "restartEra";
  /** Primary on the cursor's own page; outlined beside the way back. */
  readonly primary: boolean;
}

/** The bar's end from `md` up: Continue, or at the run's end, its restart. */
export type EndSlot = ContinueSlot | RestartSlot;

/** What the bar's right-hand end holds; on a phone away from the cursor, the way back. */
export type RunSlot = EndSlot | { readonly kind: "back" };

/**
 * The window width, as Tailwind's breakpoint, from which an action is a button
 * on the bar rather than an entry in ⋯: `md` (768px) for most, `lg` (1024px)
 * for one the bar only has room for once the page column is at its full width.
 */
export type BarWidth = "md" | "lg";

/** One button left of ⋯, and the width from which it is drawn. */
export interface BarButton {
  readonly key: RunActionKey;
  readonly from: BarWidth;
}

/** One entry of the ⋯ menu. */
export interface RunMenuEntry {
  readonly key: RunCommand;
  /** The width from which it is a button on the bar instead; null where ⋯ always lists it. */
  readonly onBarFrom: BarWidth | null;
  /** Throws work away (the restarts, Exit run): drawn in red. */
  readonly destructive: boolean;
}

/** Where each of the bar's actions goes, on a wide screen and on a phone. */
export interface RunActionsLayout {
  /** The right-hand end from `md` up: Continue, or at the run's end, its restart. */
  readonly wideSlot: EndSlot;
  /** The right-hand end on a phone. */
  readonly phoneSlot: RunSlot;
  /** The buttons left of ⋯, in order, each from its width up; a phone shows none. */
  readonly bar: readonly BarButton[];
  /** ⋯'s entries, in order; empty, and no ⋯ drawn, while the grid is being edited. */
  readonly menu: readonly RunMenuEntry[];
}

/** Why Continue cannot be pressed, as its tooltip says. */
export const CONTINUE_BLOCKED = {
  end: "Nothing after this",
  editing: "Apply or cancel your grid edit first",
} as const;

/**
 * Lays the bar's actions out. **The way on is always the right-hand end**,
 * with ⋯ just left of it, so neither moves from beat to beat: an action that
 * comes and goes is either to their left or inside ⋯. The way on is Continue;
 * where the run has nowhere further to go (a one-year run's summary, the era's
 * end) it is the run's restart instead, Restart season or Restart era, and
 * leaves ⋯. Otherwise the restarts and Exit run are in ⋯ at every width; the
 * other ways forward are buttons from `md` up and ⋯ entries on a phone, except
 * Jump to…, which waits for `lg`: between the two only it does not fit beside
 * the way back, the skip and Continue, so it is the one ⋯ keeps. On a round's
 * page (qualifying or race), whose trail is the longest, ⋯ keeps it at every
 * width, so the trail stays on one line.
 *
 * Away from the cursor's page the way back leads the bar and Continue drops
 * to outline, since it acts on the cursor, not on the page on screen. A
 * phone has room for one button beside ⋯, so there the way back takes the
 * slot and Continue moves into ⋯.
 *
 * Pure, so the whole layout is tested without a DOM: ⋯ renders into a portal
 * a static render never draws.
 */
export function runActionsFor(
  state: RunBarState,
  {
    away,
    editingGrid,
    roundPage,
  }: {
    readonly away: boolean;
    readonly editingGrid: boolean;
    /** The page on screen is a round's qualifying or race. */
    readonly roundPage: boolean;
  },
): RunActionsLayout {
  const blocked = editingGrid
    ? CONTINUE_BLOCKED.editing
    : state.next === null
      ? CONTINUE_BLOCKED.end
      : null;
  const restart =
    blocked !== CONTINUE_BLOCKED.end
      ? null
      : state.restartEra
        ? ("restartEra" as const)
        : state.restartSeason
          ? ("restartSeason" as const)
          : null;
  const wideSlot: EndSlot =
    restart === null
      ? { kind: "continue", primary: !away, disabled: blocked }
      : { kind: "restart", key: restart, primary: !away };
  if (editingGrid) {
    // No way forward, or out, while a grid is half-rearranged: the draft would
    // go with it.
    return { wideSlot, phoneSlot: wideSlot, bar: [], menu: [] };
  }
  const skip = state.skip === null ? [] : [{ key: "skip", from: "md" } as const];
  const jump = state.jump && !roundPage ? [{ key: "jump", from: "lg" } as const] : [];
  // On a phone, Continue joins ⋯ when the way back has its slot.
  const forward = [
    ...(away && blocked === null ? [{ key: "continue", from: "md" } as const] : []),
    ...skip,
    ...jump,
  ];
  const over = (
    [
      ...(state.restartSeason ? (["restartSeason"] as const) : []),
      ...(state.restartEra ? (["restartEra"] as const) : []),
      "exit",
    ] as const
  ).filter((key) => key !== restart);
  return {
    wideSlot,
    phoneSlot: away ? { kind: "back" } : wideSlot,
    // The skip, Continue's bigger brother, is the one beside ⋯.
    bar: [...(away ? [{ key: "back", from: "md" } as const] : []), ...jump, ...skip],
    menu: [
      ...forward.map(({ key, from }) => ({ key, onBarFrom: from, destructive: false })),
      ...(state.jump && roundPage
        ? [{ key: "jump" as const, onBarFrom: null, destructive: false }]
        : []),
      // On a phone away from the cursor the way back has the slot, so the
      // restart the slot holds from `md` up is in ⋯ there.
      ...(restart !== null && away
        ? [{ key: restart, onBarFrom: "md" as const, destructive: true }]
        : []),
      ...over.map((key) => ({ key, onBarFrom: null, destructive: true })),
    ],
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

/**
 * Whose car the Resume card shows: the championship leader's team, as far as
 * the reader has got, or null before the cursor's season has shown a race.
 * Read through `revealed`, so Home never shows a leader the run bar has not.
 */
export function runLeader(run: Run): { readonly teamId: string; readonly year: number } | null {
  const year = revealed(run).years.at(-1);
  if (year === undefined || year.season.races.length === 0) {
    return null;
  }
  const leader = championshipStandings(year.season, year.points)[0];
  return leader === undefined ? null : { teamId: leader.teamId, year: year.year };
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
  /** What a phone shows instead, so a round's trail stays one line; `label` is still read out. */
  readonly short?: string;
  readonly link?: CrumbLink;
  /** Its siblings, so the trail moves sideways as well as up. */
  readonly menu?: CrumbMenu;
}

/** The years the run has reached, earliest first. */
export function yearsReached(run: Run): readonly number[] {
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

/** The era's sections, in order: the key, the menu's wording, the tab's, and where each is. */
const ERA_SECTIONS: readonly {
  readonly key: RunSection;
  readonly menu: string;
  readonly tab: string;
  readonly link: CrumbLink;
}[] = [
  { key: "overview", menu: "Champions", tab: "Champions", link: REVIEW_LINK },
  { key: "drivers", menu: "All drivers", tab: "Drivers", link: driversLink() },
  { key: "teams", menu: "All teams", tab: "Teams", link: teamsLink() },
];

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
    items: ERA_SECTIONS.map((section) => ({
      label: section.menu,
      link: section.link,
      current: current === section.key,
    })),
  };
}

/**
 * The same three sections as the tab strip on each of their pages
 * (`EraTabs`): one list, so the breadcrumb menu and the strip cannot drift.
 */
export function eraSectionTabs(current: RunSection): readonly {
  readonly key: RunSection;
  readonly label: string;
  readonly current: boolean;
  readonly link: CrumbLink;
}[] {
  return ERA_SECTIONS.map((section) => ({
    key: section.key,
    label: section.tab,
    current: current === section.key,
    link: section.link,
  }));
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
          : teamName(at.id, firstYearInRun(at.id, lastYear, run.world.namesKeptFrom)),
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
      short: `R${beat.round + 1}`,
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
    crumbs.push(
      beat.kind === "qualifying" ? { label: "Qualifying", short: "Qualy" } : { label: "Race" },
    );
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
