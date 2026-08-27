import type { CalendarRace } from "@alt-hist/data";
import type { PointsScale, SeasonResult } from "@alt-hist/engine";
import { Fragment, useState } from "react";
import { driverRounds, teamRounds } from "../lib/results.js";
import { isDriverStanding, type Standing, standingKey } from "../lib/standings.js";
import { cn } from "../lib/utils.js";
import { DisclosureButton } from "./DisclosureButton.js";
import { DriverName } from "./DriverName.js";
import { RaceByRace } from "./RaceByRace.js";
import { TeamName } from "./TeamName.js";
import { Card, CardDescription, CardHeader, CardTitle } from "./ui/card.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table.js";

/**
 * The numeric columns both tables share, in order.
 *
 * Only what a driver or team *achieved*: retirements and non-qualifications are
 * still on the standings the engine derives, but a final classification reads
 * better as a record of results than of failures, so they are not shown. They
 * are one click away — the expansion below names every retirement and its
 * cause, which is where a reader who wants the failures should find them.
 */
const COLUMNS = [
  { key: "points", label: "Pts", emphasis: true },
  { key: "wins", label: "Wins", emphasis: false },
  { key: "podiums", label: "Pods", emphasis: false },
  { key: "poles", label: "Poles", emphasis: false },
] as const;

/**
 * One championship table, each row opening into its own season.
 *
 * Drivers and constructors are the same shape apart from what names the row, so
 * they share a component — the same reason the engine derives both from one
 * tally, and the reason one expansion serves both. A driver's expansion is a
 * row per round; a team's is a row per *car*, since a team may run one, two or
 * three of them.
 */
export function StandingsTable({
  title,
  description,
  nameColumn,
  standings,
  season,
  points,
  calendar,
  badge = false,
}: {
  title: string;
  description: string;
  nameColumn: string;
  standings: readonly Standing[];
  /**
   * Draw a livery badge on every row. On for the season summary, off where
   * these tables are themselves the expansion of a roll-of-honour row.
   */
  badge?: boolean;
  /** The results both the table and its expansions are derived from. */
  season: SeasonResult;
  /** The season's points scale, so an expansion scores its rounds as the table did. */
  points: PointsScale;
  /** Names the rounds inside an expansion. From the world's year, not a fixed one. */
  calendar: readonly CalendarRace[];
}) {
  // Which row is expanded, or null for none — keyed by driver or team id, so
  // the two tables on the summary open independently. Purely view state: it
  // says nothing about the simulation, so it stays here rather than the store.
  const [openKey, setOpenKey] = useState<string | null>(null);
  const columnCount = COLUMNS.length + 2;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {description} Select a {nameColumn.toLowerCase()} for their season race by race.
        </CardDescription>
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
            const key = standingKey(standing);
            const isDriver = isDriverStanding(standing);
            const isOpen = openKey === key;
            return (
              <Fragment key={key}>
                <TableRow className={cn(isOpen && "bg-muted/60")}>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums",
                      index === 0 ? "text-foreground font-semibold" : "text-muted-foreground",
                    )}
                  >
                    {index + 1}
                  </TableCell>
                  <TableCell>
                    <DisclosureButton
                      open={isOpen}
                      onToggle={() => {
                        setOpenKey(isOpen ? null : key);
                      }}
                    >
                      {isDriver ? (
                        <DriverName
                          driverId={standing.driverId}
                          teamId={standing.teamId}
                          emphasis={index === 0}
                          badge={badge}
                        />
                      ) : (
                        <TeamName teamId={standing.teamId} emphasis={index === 0} badge={badge} />
                      )}
                    </DisclosureButton>
                  </TableCell>
                  {COLUMNS.map((column) => (
                    <TableCell
                      key={column.key}
                      className={cn(
                        "text-right tabular-nums",
                        column.emphasis ? "font-semibold" : "text-muted-foreground",
                        standing[column.key] === 0 && "text-subtle font-normal",
                      )}
                    >
                      {standing[column.key]}
                    </TableCell>
                  ))}
                </TableRow>
                {isOpen ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={columnCount} className="p-0">
                      <div className="bg-muted/40 border-border border-y px-3 py-3">
                        <RaceByRace
                          rounds={
                            isDriver
                              ? driverRounds(season, points, standing.driverId)
                              : teamRounds(season, points, standing.teamId)
                          }
                          calendar={calendar}
                          showDriver={!isDriver}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
