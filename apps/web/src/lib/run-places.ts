/**
 * Where each beat of a run lives in the address bar, and what a URL inside
 * `/run` is allowed to show.
 *
 * **The URL says which place, the store says what is there.** A page reads its
 * year and round from the URL — untrusted input, a reader can type anything —
 * and asks `resolveRunPage` what it may show. A place the reader has reached
 * comes back cut at the cursor (`revealed`, in `reveal.ts`), so no page is ever
 * handed a result the reader has not seen. A place still ahead that the run
 * can get to is "not reached yet"; anything else — a typo, a round the season
 * does not have, a year the run will never reach — is sent to the cursor.
 *
 * Pure apart from the typed link objects, so every rule here is tested without
 * a router or a store.
 */

import { seasonSeed } from "@alt-hist/data";
import { linkOptions } from "@tanstack/react-router";
import { cursorPlace, type EraRun, type Run } from "../store/season.js";
import { type RevealedWorld, revealed } from "./reveal.js";
import { nextEraYear } from "./seasons.js";
import { comparePlaces, isReached, type Place, type View } from "./timeline.js";

/** The era's roll of honour, which has one page whatever year it was reached after. */
export const REVIEW_LINK = linkOptions({ to: "/run" });

/**
 * The link to a place: typed against the route tree, so a beat whose page is
 * renamed fails `pnpm typecheck` rather than the reader. Spread into a `Link`,
 * a `navigate` or a `redirect`.
 *
 * The URL's round is the one a reader would say — round 3 is `/round/3` — where
 * the beat's is an index into the season's races.
 */
export function linkTo(place: Place) {
  const year = String(place.year);
  switch (place.beat.kind) {
    case "grid":
      return linkOptions({ to: "/run/$year/grid", params: { year } });
    case "qualifying":
      return linkOptions({
        to: "/run/$year/round/$round/qualifying",
        params: { year, round: String(place.beat.round + 1) },
      });
    case "race":
      return linkOptions({
        to: "/run/$year/round/$round/race",
        params: { year, round: String(place.beat.round + 1) },
      });
    case "summary":
      return linkOptions({ to: "/run/$year", params: { year } });
    case "review":
      return REVIEW_LINK;
  }
}

export type RunLink = ReturnType<typeof linkTo>;

/** The pages inside `/run`, one per beat kind. */
export type RunPage = "review" | "summary" | "grid" | "qualifying" | "race";

/** The URL's own parameters, before anything has checked them. */
export interface RunParams {
  readonly year?: string;
  readonly round?: string;
}

/** A year as the URL spells it: four digits and nothing else. */
export function parseYear(raw: string | undefined): number | null {
  return raw !== undefined && /^\d{4}$/.test(raw) ? Number(raw) : null;
}

/**
 * A round as the URL spells it — counted from 1, no leading zero — as the
 * beat's zero-based index. Whether the season has that many rounds is
 * `resolveRunPage`'s question, since only the world knows.
 */
export function parseRound(raw: string | undefined): number | null {
  return raw !== undefined && /^[1-9]\d{0,2}$/.test(raw) ? Number(raw) - 1 : null;
}

/** The place a season page's URL names, or null for one that names none. */
export function placeFromParams(page: Exclude<RunPage, "review">, params: RunParams): Place | null {
  const year = parseYear(params.year);
  if (year === null) {
    return null;
  }
  if (page === "qualifying" || page === "race") {
    const round = parseRound(params.round);
    return round === null ? null : { year, beat: { kind: page, round } };
  }
  return { year, beat: { kind: page } };
}

/**
 * What a URL inside `/run` shows: a season's beat or the era's review, cut at
 * the cursor; a place the run has still to reach; or a redirect.
 */
export type RunResolution =
  | {
      readonly kind: "season";
      readonly place: Place;
      readonly world: RevealedWorld;
      readonly view: View;
      /** Only the grid the cursor is on can still be changed; any other is history. */
      readonly editable: boolean;
    }
  | { readonly kind: "review"; readonly place: Place; readonly run: EraRun }
  | { readonly kind: "unreached"; readonly place: Place }
  | { readonly kind: "redirect"; readonly to: RunLink };

/**
 * The years an era can still go on to, in order, after the cursor's: walked
 * with `nextEraYear`, the step the run itself takes, so a year with no seed
 * data ends the list. A one-year run has none.
 */
export function laterYears(run: Run): readonly number[] {
  const years: number[] = [];
  if (run.kind === "era") {
    for (let next = nextEraYear(run.world.year); next !== null; next = nextEraYear(next)) {
      years.push(next);
    }
  }
  return years;
}

/** How many rounds `year` has: the run's own world for its year, the seed data after it. */
function roundsIn(run: Run, year: number): number {
  return year === run.world.year ? run.world.season.races.length : seasonSeed(year).calendar.length;
}

/**
 * Whether the run can still get to `place`, which is ahead of the cursor: a
 * beat of the cursor's own year, or of a year an era goes on to, and a round
 * that year actually has.
 */
function canReach(run: Run, place: Place): boolean {
  if (place.year !== run.world.year && !laterYears(run).includes(place.year)) {
    return false;
  }
  const beat = place.beat;
  return (
    (beat.kind !== "qualifying" && beat.kind !== "race") || beat.round < roundsIn(run, place.year)
  );
}

/**
 * What the page at `page` with `params` may show of `run`.
 *
 * `/run` is the era's roll of honour, reached once a year has been crowned and
 * not reached yet before then. A one-year run has no review: its `/run` is its
 * season, which today means its summary, and until that is reached, the cursor.
 */
export function resolveRunPage(run: Run, page: RunPage, params: RunParams): RunResolution {
  const cursor = cursorPlace(run);
  const toCursor: RunResolution = { kind: "redirect", to: linkTo(cursor) };
  const shown = revealed(run);

  if (page === "review") {
    if (shown.crowned === null) {
      const summary: Place = { year: run.world.year, beat: { kind: "summary" } };
      return {
        kind: "redirect",
        to: isReached(cursor, summary) ? linkTo(summary) : linkTo(cursor),
      };
    }
    const last = shown.crowned.seasons.at(-1);
    return last === undefined
      ? { kind: "unreached", place: { year: run.world.year, beat: { kind: "review" } } }
      : {
          kind: "review",
          place: { year: last.year, beat: { kind: "review" } },
          run: shown.crowned,
        };
  }

  const place = placeFromParams(page, params);
  if (place === null || place.beat.kind === "review") {
    return toCursor;
  }
  if (!isReached(cursor, place)) {
    return canReach(run, place) ? { kind: "unreached", place } : toCursor;
  }
  const world = shown.years.find((each) => each.year === place.year);
  const beat = place.beat;
  if (
    world === undefined ||
    ((beat.kind === "qualifying" || beat.kind === "race") && beat.round >= world.season.rounds)
  ) {
    return toCursor;
  }
  return {
    kind: "season",
    place,
    world,
    view: beat,
    editable: beat.kind === "grid" && comparePlaces(place, cursor) === 0,
  };
}

/** Where a page inside `/run` is, by the route it matched. */
export function runPageOf(routeId: string): RunPage | null {
  switch (routeId) {
    case "/run/":
      return "review";
    case "/run/$year/":
      return "summary";
    case "/run/$year/grid":
      return "grid";
    case "/run/$year/round/$round/qualifying":
      return "qualifying";
    case "/run/$year/round/$round/race":
      return "race";
    default:
      return null;
  }
}

/** The setup pages a run is started from — so the page before its first one. */
const SETUP_PAGES: readonly string[] = ["/season/new", "/era/new"];

/**
 * Whether a navigation is the reader going **back past the run's first
 * page**: a browser Back from inside the run onto the setup page it was
 * started from. That is a way out of the run, and asks first.
 *
 * Every other navigation leaves the run waiting — Home, the top nav, a Back
 * that lands anywhere else — so it is not caught. Start always *pushes* the
 * run's first page, which is what makes the entry behind it the setup page.
 */
export function isBackPastStart(action: string, from: string, to: string): boolean {
  return action === "BACK" && /^\/run(\/|$)/.test(from) && SETUP_PAGES.includes(to);
}
