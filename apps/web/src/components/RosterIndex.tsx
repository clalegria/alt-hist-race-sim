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
import { driverCountry, driverName } from "../lib/names.js";
import { careerRecords } from "../lib/records.js";
import type { RevealedWorld } from "../lib/reveal.js";
import { type IndexRow, type IndexSort, rosterIndex, rosterOf, sortIndex } from "../lib/roster.js";
import type { PageOf, RosterLink } from "../lib/roster-places.js";
import { cn } from "../lib/utils.js";
import { useTeamCountryIn, useTeamNameIn } from "./EntryNames.js";
import { Flag } from "./Flag.js";
import { Liveries } from "./Liveries.js";
import { TeamBadge } from "./TeamBadge.js";
import { Card, CardDescription, CardHeader, CardTitle } from "./ui/card.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table.js";

/** The figure columns, in the order drawn. */
const COLUMNS: readonly { readonly sort: Exclude<IndexSort, "name">; readonly label: string }[] = [
  { sort: "seasons", label: "Seasons" },
  { sort: "titles", label: "Titles" },
  { sort: "wins", label: "Wins" },
  { sort: "podiums", label: "Podiums" },
  { sort: "poles", label: "Poles" },
  { sort: "points", label: "Pts" },
];

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
          "hover:text-foreground transition-colors",
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
  const teamCountryIn = useTeamCountryIn();
  const index = useMemo(
    () => rosterIndex(rosterOf(years), careerRecords(years, teamNameIn)),
    [years, teamNameIn],
  );
  const nameOf = (row: IndexRow) =>
    kind === "drivers" ? driverName(row.id) : teamNameIn(row.id, row.lastYear);
  const rows = sortIndex(kind === "drivers" ? index.drivers : index.teams, sort, nameOf);
  const noun = kind === "drivers" ? "driver" : "team";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{kind === "drivers" ? "Drivers" : "Teams"}</CardTitle>
        <CardDescription>
          Every {noun} in this run so far: {rows.length} of them. Pick a heading to sort, or a name
          to open their page.
        </CardDescription>
      </CardHeader>
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
                className="text-right"
              />
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const country =
              kind === "drivers" ? driverCountry(row.id) : teamCountryIn(row.id, row.lastYear);
            return (
              <TableRow key={row.id}>
                <TableCell>
                  <span className="flex items-center gap-1.5">
                    {kind === "teams" ? (
                      <Liveries year={row.lastYear}>
                        <TeamBadge teamId={row.id} />
                      </Liveries>
                    ) : null}
                    {country === undefined ? null : <Flag country={country} title={country} />}
                    <Link
                      {...(kind === "drivers" ? pageOf.driver(row.id) : pageOf.team(row.id))}
                      className="font-medium hover:underline"
                    >
                      {nameOf(row)}
                    </Link>
                    {row.names > 1 ? (
                      <span className="text-muted-foreground text-xs">under {row.names} names</span>
                    ) : null}
                  </span>
                </TableCell>
                {COLUMNS.map((column) => (
                  <TableCell
                    key={column.sort}
                    className={cn(
                      "text-right tabular-nums",
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
  );
}
