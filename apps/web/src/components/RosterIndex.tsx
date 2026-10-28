/**
 * Everyone in the run so far — the drivers' list and the teams' list.
 *
 * **An index is a directory, so a name here is a plain link to its page**:
 * the one place a name navigates rather than opening its panel, because
 * getting to a page is the whole of what this list is for.
 *
 * The order is a search param (`?sort=wins`) — how the list is viewed, not
 * which list — so Back moves between orders and a link can name one. Each
 * column heading is that link, and the sorted one says so with `aria-sort`.
 */

import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { count } from "../lib/format.js";
import { driverName } from "../lib/names.js";
import { careerRecords } from "../lib/records.js";
import type { RevealedWorld } from "../lib/reveal.js";
import { type IndexRow, type IndexSort, rosterIndex, rosterOf, sortIndex } from "../lib/roster.js";
import type { PageOf, RosterLink } from "../lib/roster-places.js";
import { cn, HIT_AREA } from "../lib/utils.js";
import { DriverName } from "./DriverName.js";
import { useTeamNameIn } from "./EntryNames.js";
import { EraTabs } from "./EraTabs.js";
import { Liveries } from "./Liveries.js";
import { PageHeading } from "./PageHeading.js";
import { TeamName } from "./TeamName.js";
import { Card } from "./ui/card.js";
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

/** A column heading that sorts the list by itself. */
function SortHeading({
  label,
  sort,
  current,
  linkFor,
  className,
}: {
  label: string;
  sort: IndexSort;
  current: IndexSort;
  linkFor: (sort: IndexSort) => RosterLink;
  className?: string;
}) {
  const active = sort === current;
  return (
    <TableHead
      className={className}
      aria-sort={active ? (sort === "name" ? "ascending" : "descending") : "none"}
    >
      <Link
        {...linkFor(sort)}
        className={cn(
          "hover:text-foreground focus-visible:ring-ring transition-colors focus-visible:ring-2 focus-visible:outline-none",
          // The header row's height, for a heading set a third of it.
          HIT_AREA,
          "after:-inset-x-1 after:-inset-y-3",
          active && "text-foreground font-semibold",
        )}
      >
        {label}
        {active ? <span aria-hidden="true"> {sort === "name" ? "↑" : "↓"}</span> : null}
      </Link>
    </TableHead>
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
  linkFor,
  pageOf,
}: {
  kind: "drivers" | "teams";
  years: readonly RevealedWorld[];
  sort: IndexSort;
  /** The list in another order. */
  linkFor: (sort: IndexSort) => RosterLink;
  pageOf: PageOf;
}) {
  const teamNameIn = useTeamNameIn();
  const index = useMemo(
    () => rosterIndex(rosterOf(years), careerRecords(years, teamNameIn)),
    [years, teamNameIn],
  );
  const nameOf = (row: IndexRow) =>
    kind === "drivers" ? driverName(row.id) : teamNameIn(row.id, row.lastYear);
  const rows = sortIndex(kind === "drivers" ? index.drivers : index.teams, sort, nameOf);
  const noun = kind === "drivers" ? "driver" : "team";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <PageHeading
          title={kind === "drivers" ? "Drivers" : "Teams"}
          sub={`${count(rows.length, noun)} in the run so far`}
        />
        <EraTabs current={kind} />
      </header>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <SortHeading
                label={kind === "drivers" ? "Driver" : "Team"}
                sort="name"
                current={sort}
                linkFor={linkFor}
              />
              {COLUMNS.map((column) => (
                <SortHeading
                  key={column.sort}
                  label={column.label}
                  sort={column.sort}
                  current={sort}
                  linkFor={linkFor}
                  className={figureClass(column, sort)}
                />
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
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
