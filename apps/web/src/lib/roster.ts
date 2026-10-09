/**
 * Who has been in the run so far, and the index lists of them.
 *
 * **The roster is everyone in the field of a year the reader has reached** —
 * read off `revealed(run).years`, so the cursor's own year counts from its
 * grid on and a driver on the grid who has not yet raced has a page. Someone
 * who appears only in a year still ahead has none: a page of them would give
 * away a grid the reader has not reached.
 *
 * The field rather than the championship tables, because the tables name only
 * who has *raced*. The figures beside each name still come off the tables
 * (`careerRecords`), since results are the source of truth; the roster only
 * says who is listed and in how many seasons.
 */

import type { RaceEntrant } from "@alt-hist/engine";
import { driverOverall } from "./rating.js";
import type { CareerRecord, CareerRecords } from "./records.js";

/** One year a driver was on the grid, and for whom. */
export interface DriverAppearance {
  readonly year: number;
  readonly teamId: string;
}

/** One year a team was on the grid, and who it entered. */
export interface TeamAppearance {
  readonly year: number;
  readonly driverIds: readonly string[];
}

/** Everyone in the run so far, keyed by id, each list earliest first. */
export interface Roster {
  readonly drivers: ReadonlyMap<string, readonly DriverAppearance[]>;
  readonly teams: ReadonlyMap<string, readonly TeamAppearance[]>;
}

/** What the roster reads of a year: which year, and who lined up. */
export interface FieldYear {
  readonly year: number;
  readonly field: readonly RaceEntrant[];
}

/** Everyone in the field of `years`, in year order. */
export function rosterOf(years: readonly FieldYear[]): Roster {
  const drivers = new Map<string, DriverAppearance[]>();
  const teams = new Map<string, TeamAppearance[]>();
  for (const { year, field } of [...years].sort((a, b) => a.year - b.year)) {
    const entered = new Map<string, string[]>();
    for (const entrant of field) {
      const career = drivers.get(entrant.driverId) ?? [];
      // A driver holds one seat a year today; the first is the one they started in.
      if (career.at(-1)?.year !== year) {
        career.push({ year, teamId: entrant.teamId });
      }
      drivers.set(entrant.driverId, career);
      entered.set(entrant.teamId, [...(entered.get(entrant.teamId) ?? []), entrant.driverId]);
    }
    for (const [teamId, driverIds] of entered) {
      teams.set(teamId, [...(teams.get(teamId) ?? []), { year, driverIds }]);
    }
  }
  return { drivers, teams };
}

/** A driver's best overall in the run, and the first year they were rated it. */
export interface BestOverall {
  readonly overall: number;
  readonly year: number;
}

/**
 * The highest overall a driver carried in any year of `years` they were on the
 * grid, or null for someone never on it. A tie goes to the earlier year: the
 * peak is when they first got there.
 */
export function bestOverall(years: readonly FieldYear[], driverId: string): BestOverall | null {
  let best: BestOverall | null = null;
  for (const { year, field } of [...years].sort((a, b) => a.year - b.year)) {
    const entrant = field.find((each) => each.driverId === driverId);
    if (entrant === undefined) {
      continue;
    }
    const overall = driverOverall(entrant.driver);
    if (best === null || overall > best.overall) {
      best = { overall, year };
    }
  }
  return best;
}

/** The last year someone is on the run's grid, or null for someone never on it. */
export function lastYearOf(appearances: readonly { readonly year: number }[] | undefined) {
  return appearances?.at(-1)?.year ?? null;
}

/** One row of an index list. */
export interface IndexRow {
  readonly id: string;
  /** Years on the grid, raced or not. */
  readonly seasons: number;
  readonly titles: number;
  readonly wins: number;
  readonly podiums: number;
  readonly poles: number;
  readonly points: number;
  /** The last year on the grid, which a team's name and livery are drawn as of. */
  readonly lastYear: number;
  /** How many names a team raced under; always 1 for a driver. */
  readonly names: number;
}

/** What an index can be ordered by. The first is the default. */
export const INDEX_SORTS = [
  "titles",
  "wins",
  "podiums",
  "poles",
  "points",
  "seasons",
  "name",
] as const;

export type IndexSort = (typeof INDEX_SORTS)[number];

/** The sort a URL's `sort` names; the default for anything else. */
export function parseIndexSort(raw: unknown): IndexSort {
  return INDEX_SORTS.find((sort) => sort === raw) ?? "titles";
}

/**
 * An index page's search params, checked: the route's `validateSearch`. The
 * default sort is left out, so `/run/drivers` is the list's one address.
 */
export function indexSearch(search: Record<string, unknown>): { sort?: IndexSort } {
  const sort = parseIndexSort(search.sort);
  return sort === "titles" ? {} : { sort };
}

/**
 * One row per person on the roster, with the figures their results add up
 * to — zeros for someone on the grid who has not raced, since an index lists
 * everyone, unlike a record card.
 */
export function indexRows(
  appearances: ReadonlyMap<string, readonly { readonly year: number }[]>,
  records: readonly CareerRecord[],
): readonly IndexRow[] {
  const byId = new Map(records.map((record) => [record.id, record]));
  return [...appearances].map(([id, years]) => {
    const record = byId.get(id);
    return {
      id,
      seasons: years.length,
      titles: record?.titles ?? 0,
      wins: record?.wins ?? 0,
      podiums: record?.podiums ?? 0,
      poles: record?.poles ?? 0,
      points: record?.points ?? 0,
      lastYear: lastYearOf(years) ?? 0,
      names: Math.max(1, record?.spells.length ?? 1),
    };
  });
}

/** Both index lists of a run. */
export function rosterIndex(
  roster: Roster,
  records: CareerRecords,
): { drivers: readonly IndexRow[]; teams: readonly IndexRow[] } {
  return {
    drivers: indexRows(roster.drivers, records.drivers),
    teams: indexRows(roster.teams, records.teams),
  };
}

/** The figures a tie on the sorted one falls through, in the record cards' order. */
const CABINET = ["titles", "wins", "podiums", "poles", "points", "seasons"] as const;

/**
 * An index in `sort` order: biggest first for a figure, ties falling through
 * the rest of the cabinet, A to Z for the name. **Total** — every order ends
 * on the id — so a list never depends on the sort implementation or on the
 * order the roster was walked in.
 */
export function sortIndex(
  rows: readonly IndexRow[],
  sort: IndexSort,
  nameOf: (row: IndexRow) => string,
): readonly IndexRow[] {
  const byId = (a: IndexRow, b: IndexRow) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  if (sort === "name") {
    return [...rows].sort((a, b) => nameOf(a).localeCompare(nameOf(b)) || byId(a, b));
  }
  const keys = [sort, ...CABINET.filter((key) => key !== sort)];
  return [...rows].sort((a, b) => {
    for (const key of keys) {
      const difference = b[key] - a[key];
      if (difference !== 0) {
        return difference;
      }
    }
    return byId(a, b);
  });
}
