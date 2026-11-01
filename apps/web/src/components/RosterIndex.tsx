/**
 * Everyone in the run so far — the drivers' list and the teams' list.
 *
 * **An index is a directory, so a name here is a plain link to its page**:
 * the one place a name navigates rather than opening its panel, because
 * getting to a page is the whole of what this list is for.
 *
 * The order is a search param (`?sort=wins&dir=asc`) — how the list is viewed,
 * not which list — so Back moves between orders and a link can name one. Each
 * column heading is that link, the sorted one turning the list round, and it
 * says so with `aria-sort`. Names sort as the steps between pages walk them:
 * drivers by surname (`compareRosterNames`).
 *
 * The search box filters the rows as the reader types, by any word of the
 * name — and for a team, of any name it raced under.
 */

import { Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { count } from "../lib/format.js";
import { driverName } from "../lib/names.js";
import { careerRecords } from "../lib/records.js";
import type { RevealedWorld } from "../lib/reveal.js";
import {
  compareRosterNames,
  type IndexDirection,
  type IndexRow,
  type IndexSort,
  nameMatches,
  naturalDirection,
  rosterIndex,
  rosterOf,
  sortIndex,
} from "../lib/roster.js";
import type { PageOf, RosterLink } from "../lib/roster-places.js";
import { cn, HIT_AREA } from "../lib/utils.js";
import { DriverName } from "./DriverName.js";
import { useTeamNameIn } from "./EntryNames.js";
import { EraTabs } from "./EraTabs.js";
import { Liveries } from "./Liveries.js";
import { PageHeading } from "./PageHeading.js";
import { TeamName } from "./TeamName.js";
import { Card } from "./ui/card.js";
import { Input } from "./ui/input.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table.js";

/**
 * The figure columns, in the order drawn. A phone keeps the `phone` ones and
 * the column the list is sorted by, so the table never scrolls sideways.
 */
const COLUMNS: readonly {
  readonly sort: Exclude<IndexSort, "name">;
  readonly label: string;
  readonly phone: boolean;
}[] = [
  { sort: "seasons", label: "Seasons", phone: false },
  { sort: "titles", label: "Titles", phone: false },
  { sort: "wins", label: "Wins", phone: true },
  { sort: "podiums", label: "Podiums", phone: false },
  { sort: "poles", label: "Poles", phone: false },
  { sort: "points", label: "Pts", phone: true },
];

/** A figure column's cells: a step tighter on a phone, and hidden there unless kept. */
function figureClass(column: (typeof COLUMNS)[number], sort: IndexSort): string {
  return cn(
    "px-2 text-right sm:px-3",
    !column.phone && column.sort !== sort && "hidden sm:table-cell",
  );
}

/**
 * A column heading that sorts the list by itself, its natural way first (A to
 * Z, biggest first); on the sorted column it turns the list round.
 */
function SortHeading({
  label,
  sort,
  current,
  dir,
  linkFor,
  className,
}: {
  label: string;
  sort: IndexSort;
  current: IndexSort;
  dir: IndexDirection;
  linkFor: (sort: IndexSort, dir?: IndexDirection) => RosterLink;
  className?: string;
}) {
  const active = sort === current;
  return (
    <TableHead
      className={className}
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <Link
        {...linkFor(sort, active ? (dir === "asc" ? "desc" : "asc") : naturalDirection(sort))}
        className={cn(
          "hover:text-foreground focus-visible:ring-ring transition-colors focus-visible:ring-2 focus-visible:outline-none",
          // The header row's height, for a heading set a third of it.
          HIT_AREA,
          "after:-inset-x-1 after:-inset-y-3",
          active && "text-foreground font-semibold",
        )}
      >
        {label}
        {active ? <span aria-hidden="true"> {dir === "asc" ? "↑" : "↓"}</span> : null}
      </Link>
    </TableHead>
  );
}

/**
 * The box that filters an index, with a magnifier at its right end.
 *
 * The magnifier is decoration (`aria-hidden`, clicks pass through to the box);
 * the box is named by its `aria-label`, since a placeholder vanishes once typed
 * over. While it holds text the magnifier gives way to a Clear button, which
 * hands the focus back so typing carries on — and the browser's own clear mark
 * is hidden, so the two never sit on top of each other. Escape still clears.
 */
function SearchBox({
  label,
  query,
  onChange,
}: {
  label: string;
  query: string;
  onChange: (query: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="relative w-full sm:w-56">
      <Input
        ref={input}
        type="search"
        aria-label={label}
        placeholder={label}
        value={query}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className="w-full pr-9 [&::-webkit-search-cancel-button]:appearance-none"
      />
      {query === "" ? (
        <span
          aria-hidden="true"
          className="text-muted-foreground pointer-events-none absolute inset-y-0 right-3 flex items-center"
        >
          <span className="search-icon" />
        </span>
      ) : (
        <button
          type="button"
          aria-label="Clear search"
          title="Clear search"
          onClick={() => {
            onChange("");
            input.current?.focus();
          }}
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute inset-y-0 right-0 flex w-9 items-center justify-center transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <span aria-hidden="true">✕</span>
        </button>
      )}
    </div>
  );
}

/**
 * The drivers' or the teams' index of a run.
 *
 * A driver is named alone, flag and name, for the reason a record card names
 * one alone: their run may cross several teams. A team is named, badged and
 * flagged as of its last year on the grid, and says how many names it raced
 * under when it was more than one.
 */
export function RosterIndex({
  kind,
  years,
  sort,
  dir = naturalDirection(sort),
  linkFor,
  pageOf,
  initialQuery = "",
}: {
  kind: "drivers" | "teams";
  years: readonly RevealedWorld[];
  sort: IndexSort;
  /** Absent for the column's natural direction. */
  dir?: IndexDirection | undefined;
  /** The list in another order. */
  linkFor: (sort: IndexSort, dir?: IndexDirection) => RosterLink;
  pageOf: PageOf;
  /** What the search box opens holding. Tests only: a static render types nothing. */
  initialQuery?: string;
}) {
  // What the reader has typed: a passing filter, so it is the component's own
  // state rather than a search param — a URL per keystroke would fill Back.
  const [query, setQuery] = useState(initialQuery);
  const teamNameIn = useTeamNameIn();
  const { index, spellNames } = useMemo(() => {
    const records = careerRecords(years, teamNameIn);
    return {
      index: rosterIndex(rosterOf(years), records),
      // Every name a team raced under, so "Toleman" finds the team it became.
      spellNames: new Map(
        records.teams.map((record) => [record.id, record.spells.map((spell) => spell.name)]),
      ),
    };
  }, [years, teamNameIn]);
  const nameOf = (row: IndexRow) =>
    kind === "drivers" ? driverName(row.id) : teamNameIn(row.id, row.lastYear);
  const all = kind === "drivers" ? index.drivers : index.teams;
  const rows = sortIndex(all, sort, nameOf, {
    dir,
    compareNames: (a, b) => compareRosterNames(kind, a, b),
  }).filter((row) =>
    nameMatches(
      query,
      kind === "drivers" ? [nameOf(row)] : [nameOf(row), ...(spellNames.get(row.id) ?? [])],
    ),
  );
  const noun = kind === "drivers" ? "driver" : "team";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <PageHeading
          title={kind === "drivers" ? "Drivers" : "Teams"}
          sub={`${count(all.length, noun)} in the run so far`}
        />
        {/* The search box shares the tabs' line, at its far end; on a phone it wraps under them. */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <EraTabs current={kind} />
          <SearchBox label={`Search ${kind}`} query={query} onChange={setQuery} />
        </div>
      </header>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <SortHeading
                label={kind === "drivers" ? "Driver" : "Team"}
                sort="name"
                current={sort}
                dir={dir}
                linkFor={linkFor}
              />
              {COLUMNS.map((column) => (
                <SortHeading
                  key={column.sort}
                  label={column.label}
                  sort={column.sort}
                  current={sort}
                  dir={dir}
                  linkFor={linkFor}
                  className={figureClass(column, sort)}
                />
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLUMNS.length + 1} className="text-muted-foreground">
                  No {noun} matches “{query.trim()}”
                </TableCell>
              </TableRow>
            ) : null}
            {rows.map((row) => {
              return (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-normal sm:whitespace-nowrap">
                    {/* The marks stay beside the name; on a phone the words wrap after them. */}
                    <span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
                      <Link
                        {...(kind === "drivers" ? pageOf.driver(row.id) : pageOf.team(row.id))}
                        className="font-medium hover:underline"
                      >
                        {kind === "drivers" ? (
                          <DriverName driverId={row.id} />
                        ) : (
                          // The team as of its last year on the grid, in no engine's name:
                          // this list spans seasons, so there is no `EntryNames` above it.
                          <Liveries year={row.lastYear}>
                            <TeamName teamId={row.id} badge />
                          </Liveries>
                        )}
                      </Link>
                      {row.names > 1 ? (
                        <span className="text-muted-foreground text-xs">
                          under {row.names} names
                        </span>
                      ) : null}
                    </span>
                  </TableCell>
                  {COLUMNS.map((column) => (
                    <TableCell
                      key={column.sort}
                      className={cn(
                        figureClass(column, sort),
                        "tabular-nums",
                        column.sort === sort ? "font-semibold" : "text-muted-foreground",
                        row[column.sort] === 0 && "text-subtle font-normal",
                      )}
                    >
                      {row[column.sort]}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
