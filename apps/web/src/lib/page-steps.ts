/**
 * The page either side of this one: the race before and after, the season,
 * the driver or the team. The run bar draws the pair as two arrows after the
 * trail and the foot of the page draws them again with their names, both from
 * one `stepsFor`.
 *
 * **They move between places and never reveal**, like every other link in a
 * run: a place still ahead comes back without a link, to be drawn disabled,
 * and the way there is Continue. Pure, so every rule is tested without a
 * router or a store.
 *
 * - A session steps to the same session of the round either side, through
 *   `roundPlace`, and across the edge of a year in an era: the first round's
 *   previous is last year's final round, the last round's next is next year's
 *   first.
 * - A season steps to the years either side.
 * - A driver or a team steps through everyone in the run so far, A to Z:
 *   drivers by surname, teams by the name the index shows them under.
 */

import { firstYearInRun } from "@alt-hist/data";
import { cursorPlace, type Run } from "../store/season.js";
import { compareBySurname, driverName, teamName } from "./names.js";
import { revealed } from "./reveal.js";
import { lastYearOf, rosterOf } from "./roster.js";
import { driverLink, type RosterLocation, teamLink } from "./roster-places.js";
import { type CrumbLink, yearsReached } from "./run-bar.js";
import { laterYears, linkTo } from "./run-places.js";
import { seasonSeed } from "./seasons.js";
import { roundPlace } from "./session-nav.js";
import type { Place } from "./timeline.js";

/** One way to a neighbouring page. */
export interface Step {
  /** The whole place, for the arrow's tooltip: "Previous race: 1984 Brazilian Grand Prix". */
  readonly title: string;
  /** The place as the foot of the page names it: "Brazilian Grand Prix", "1985 season". */
  readonly label: string;
  /** Null while the place is still ahead. */
  readonly link: CrumbLink | null;
}

/** The pages either side; null on a side with nowhere to go. */
export interface PageSteps {
  readonly previous: Step | null;
  readonly next: Step | null;
}

type Direction = "Previous" | "Next";

/** A step to a place, with " (not yet)" on the tooltip of one still ahead. */
function step(
  direction: Direction,
  noun: string,
  place: string,
  label: string,
  link: CrumbLink | null,
): Step {
  return {
    title: `${direction} ${noun}: ${place}${link === null ? " (not yet)" : ""}`,
    label,
    link,
  };
}

/** A round's Grand Prix, as the calendar names it. */
function grandPrix(year: number, round: number): string {
  return seasonSeed(year).calendar[round]?.name ?? `Round ${round + 1}`;
}

/**
 * How many rounds a year the run has reached has. The run's own worlds are
 * simulated whole, uncut by the cursor, so every race is in them.
 */
function roundsIn(run: Run, year: number): number {
  const world =
    year === run.world.year
      ? run.world
      : run.kind === "era"
        ? run.run.seasons.find((each) => each.year === year)
        : undefined;
  return world?.season.races.length ?? 0;
}

/**
 * The step to `round` of `year` from a `kind` session in `from`: the same
 * session where it is reached, its qualifying while only that is, else no link.
 * The noun says where the link actually goes.
 */
function sessionStep(
  run: Run,
  direction: Direction,
  kind: "qualifying" | "race",
  from: number,
  year: number,
  round: number,
): Step {
  const reached = roundPlace(cursorPlace(run), year, kind, round);
  const lands = reached?.beat.kind ?? kind;
  const name = grandPrix(year, round);
  return step(
    direction,
    lands,
    `${year} ${name}`,
    year === from ? name : `${year} ${name}`,
    reached === null ? null : linkTo(reached),
  );
}

/** The sessions either side of a `kind` session in `round` of `year`. */
function sessionSteps(
  run: Run,
  year: number,
  kind: "qualifying" | "race",
  round: number,
): PageSteps {
  const years = yearsReached(run);
  const at = years.indexOf(year);
  const before = years[at - 1];
  const after = years[at + 1] ?? laterYears(run).find((later) => later > year);

  let previous: Step | null = null;
  if (round > 0) {
    previous = sessionStep(run, "Previous", kind, year, year, round - 1);
  } else if (before !== undefined && roundsIn(run, before) > 0) {
    previous = sessionStep(run, "Previous", kind, year, before, roundsIn(run, before) - 1);
  }

  let next: Step | null = null;
  if (round + 1 < roundsIn(run, year)) {
    next = sessionStep(run, "Next", kind, year, year, round + 1);
  } else if (after !== undefined && seasonSeed(after).calendar.length > 0) {
    next = sessionStep(run, "Next", kind, year, after, 0);
  }
  return { previous, next };
}

/** The seasons either side of `year`; a next one the era can still reach has no link. */
function seasonSteps(run: Run, year: number): PageSteps {
  const years = yearsReached(run);
  const at = years.indexOf(year);
  const before = years[at - 1];
  const reachedAfter = years[at + 1];
  const after = reachedAfter ?? laterYears(run).find((later) => later > year);
  const seasonStep = (direction: Direction, other: number, reached: boolean) =>
    step(
      direction,
      "season",
      String(other),
      `${other} season`,
      reached ? linkTo({ year: other, beat: { kind: "summary" } }) : null,
    );
  return {
    previous: before === undefined ? null : seasonStep("Previous", before, true),
    next: after === undefined ? null : seasonStep("Next", after, reachedAfter !== undefined),
  };
}

/** The people either side of `id` in `ids` once sorted by `compare`. */
function neighbours(
  ids: readonly string[],
  id: string,
  compare: (a: string, b: string) => number,
): { before: string | undefined; after: string | undefined } {
  const sorted = [...ids].sort(compare);
  const at = sorted.indexOf(id);
  return at === -1
    ? { before: undefined, after: undefined }
    : { before: sorted[at - 1], after: sorted[at + 1] };
}

/** By id, the tie-break that makes every order total. */
function byId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** The drivers or teams either side of `id`, A to Z. */
function rosterSteps(run: Run, page: "driver" | "team", id: string): PageSteps {
  const roster = rosterOf(revealed(run).years);
  if (page === "driver") {
    const { before, after } = neighbours(
      [...roster.drivers.keys()],
      id,
      (a, b) => compareBySurname(driverName(a), driverName(b)) || byId(a, b),
    );
    const driverStep = (direction: Direction, other: string) => {
      const name = driverName(other);
      return step(direction, "driver", name, name, driverLink(other));
    };
    return {
      previous: before === undefined ? null : driverStep("Previous", before),
      next: after === undefined ? null : driverStep("Next", after),
    };
  }
  // Named as the index names a team: as of its last year in the run, under the
  // run's own naming.
  const nameOf = (teamId: string) =>
    teamName(
      teamId,
      firstYearInRun(
        teamId,
        lastYearOf(roster.teams.get(teamId)) ?? run.world.year,
        run.world.namesKeptFrom,
      ),
    );
  const { before, after } = neighbours(
    [...roster.teams.keys()],
    id,
    (a, b) => nameOf(a).localeCompare(nameOf(b)) || byId(a, b),
  );
  const teamStep = (direction: Direction, other: string) => {
    const name = nameOf(other);
    return step(direction, "team", name, name, teamLink(other));
  };
  return {
    previous: before === undefined ? null : teamStep("Previous", before),
    next: after === undefined ? null : teamStep("Next", after),
  };
}

/**
 * The steps from the page at `at`: a session's, a season's, a driver's or a
 * team's. Null on every other page — the grid, the era's overview, an index.
 *
 * `at` is a page the reader has reached, as the run bar's trail is given it.
 */
export function stepsFor(run: Run, at: Place | RosterLocation): PageSteps | null {
  if ("page" in at) {
    return (at.page === "driver" || at.page === "team") && at.id !== undefined
      ? rosterSteps(run, at.page, at.id)
      : null;
  }
  switch (at.beat.kind) {
    case "qualifying":
    case "race":
      return sessionSteps(run, at.year, at.beat.kind, at.beat.round);
    case "summary":
      return seasonSteps(run, at.year);
    default:
      return null;
  }
}
