import type { ConstructorStanding, DriverStanding } from "@alt-hist/engine";
import { driverName, teamName } from "../lib/names.js";
import { cn } from "../lib/utils.js";
import { Card, CardDescription, CardHeader, CardTitle } from "./ui/card.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table.js";

/** The numeric columns both tables share, in order. */
const COLUMNS = [
  { key: "points", label: "Pts", emphasis: true },
  { key: "wins", label: "Wins", emphasis: false },
  { key: "podiums", label: "Pods", emphasis: false },
  { key: "poles", label: "Poles", emphasis: false },
  { key: "retirements", label: "DNF", emphasis: false },
  { key: "nonQualifications", label: "DNQ", emphasis: false },
] as const;

type Standing = DriverStanding | ConstructorStanding;

function isDriver(standing: Standing): standing is DriverStanding {
  return "driverId" in standing;
}

/**
 * One championship table.
 *
 * Drivers and constructors are the same shape apart from what names the row, so
 * they share a component — the same reason the engine derives both from one
 * tally.
 */
export function StandingsTable({
  title,
  description,
  nameColumn,
  standings,
}: {
  title: string;
  description: string;
  nameColumn: string;
  standings: readonly Standing[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12 text-right">Pos</TableHead>
            <TableHead>{nameColumn}</TableHead>
            {COLUMNS.map((column) => (
              <TableHead key={column.key} className="text-right">
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {standings.map((standing, index) => {
            return (
              <TableRow key={isDriver(standing) ? standing.driverId : standing.teamId}>
                <TableCell
                  className={cn(
                    "text-right tabular-nums",
                    index === 0 ? "text-foreground font-semibold" : "text-muted-foreground",
                  )}
                >
                  {index + 1}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col leading-tight">
                    <span className={cn(index === 0 && "font-semibold")}>
                      {isDriver(standing)
                        ? driverName(standing.driverId)
                        : teamName(standing.teamId)}
                    </span>
                    {isDriver(standing) ? (
                      <span className="text-muted-foreground text-xs">
                        {teamName(standing.teamId)}
                      </span>
                    ) : null}
                  </div>
                </TableCell>
                {COLUMNS.map((column) => (
                  <TableCell
                    key={column.key}
                    className={cn(
                      "text-right tabular-nums",
                      column.emphasis ? "font-semibold" : "text-muted-foreground",
                      standing[column.key] === 0 && "text-muted-foreground/50 font-normal",
                    )}
                  >
                    {standing[column.key]}
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
