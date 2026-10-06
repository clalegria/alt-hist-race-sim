/**
 * The run's people pages — the two index lists and a page per driver and per
 * team — and what a URL among them is allowed to show.
 *
 * Kept beside `run-places.ts` rather than inside it: that file maps the beats
 * of the timeline, and a person is not a beat. The rule is the same one,
 * though. **The URL says who, the store says what is there**, the id is
 * untrusted input, and a page is handed the run only as `revealed()` cuts it —
 * so a driver page cannot show a result past the cursor, and a driver who is
 * only on a grid still ahead has no page at all (`lib/roster.ts`).
 *
 * **They are an era's.** A record across the run means something only over
 * several seasons, so in a one-year run every people URL goes to its season.
 */

import { linkOptions } from "@tanstack/react-router";
import { cursorPlace, type Run } from "../store/season.js";
import { type RevealedWorld, revealed } from "./reveal.js";
import { type IndexSort, type Roster, rosterOf } from "./roster.js";
import { linkTo, type RunLink } from "./run-places.js";
import type { Place } from "./timeline.js";

export type RosterPage = "drivers" | "teams" | "driver" | "team";

/** The drivers' index, in the default order unless a sort is named. */
export function driversLink(sort?: IndexSort) {
  return linkOptions({
    to: "/run/drivers",
    search: sort === undefined || sort === "titles" ? {} : { sort },
  });
}

/** The teams' index, in the default order unless a sort is named. */
export function teamsLink(sort?: IndexSort) {
  return linkOptions({
    to: "/run/teams",
    search: sort === undefined || sort === "titles" ? {} : { sort },
  });
}

export function driverLink(driverId: string) {
  return linkOptions({ to: "/run/driver/$driverId", params: { driverId } });
}

/** A team's page, by its lineage id — one address for every name it raced under. */
export function teamLink(teamId: string) {
  return linkOptions({ to: "/run/team/$teamId", params: { teamId } });
}

export type RosterLink =
  | ReturnType<typeof driversLink>
  | ReturnType<typeof teamsLink>
  | ReturnType<typeof driverLink>
  | ReturnType<typeof teamLink>;

/** Where a person's page is, for anything that links to one. */
export interface PageOf {
  readonly driver: (driverId: string) => RosterLink;
  readonly team: (teamId: string) => RosterLink;
}

export const PAGE_OF: PageOf = { driver: driverLink, team: teamLink };

/** Which people page, and whose. */
export interface RosterLocation {
  readonly page: RosterPage;
  /** The driver or team id, on a person's page; absent on an index. */
  readonly id?: string;
}

/** An id as the URL spells it: the seed data's own ids, and nothing else. */
export function parseId(raw: string | undefined): string | null {
  return raw !== undefined && /^[a-z0-9_]{1,64}$/.test(raw) ? raw : null;
}

/** What a people page shows, or where it goes instead. */
export type RosterResolution =
  | {
      readonly kind: "roster";
      readonly location: RosterLocation;
      /** Every year reached, each cut at the cursor — what the page reads. */
      readonly years: readonly RevealedWorld[];
      readonly roster: Roster;
      readonly cursor: Place;
    }
  | { readonly kind: "redirect"; readonly to: RosterLink | RunLink };

/**
 * What `page` with `id` may show of `run`. In a one-year run, nothing: every
 * page goes to the season's. In an era an index always shows, and a person's
 * page shows only someone on the roster; a malformed id, an unknown one, or
 * one who is only on a grid still ahead goes to that list's index.
 */
export function resolveRosterPage(run: Run, page: RosterPage, id?: string): RosterResolution {
  if (run.kind !== "era") {
    return { kind: "redirect", to: linkTo({ year: run.world.year, beat: { kind: "summary" } }) };
  }
  const shown = revealed(run);
  const roster = rosterOf(shown.years);
  const found: RosterResolution = {
    kind: "roster",
    location: { page },
    years: shown.years,
    roster,
    cursor: cursorPlace(run),
  };
  if (page === "drivers" || page === "teams") {
    return found;
  }
  const parsed = parseId(id);
  const known = page === "driver" ? roster.drivers : roster.teams;
  if (parsed === null || !known.has(parsed)) {
    return { kind: "redirect", to: page === "driver" ? driversLink() : teamsLink() };
  }
  return { ...found, location: { page, id: parsed } };
}

/** Which people page a route is, by the route it matched; null for any other. */
export function rosterPageOf(routeId: string): RosterPage | null {
  switch (routeId) {
    case "/run/drivers":
      return "drivers";
    case "/run/teams":
      return "teams";
    case "/run/driver/$driverId":
      return "driver";
    case "/run/team/$teamId":
      return "team";
    default:
      return null;
  }
}
