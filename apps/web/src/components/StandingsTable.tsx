import type { CalendarRace } from "@alt-hist/data";
import type { PointsScale, SeasonResult } from "@alt-hist/engine";
import { Fragment, useState } from "react";
import { driverName } from "../lib/names.js";
import { driverRounds, teamRounds } from "../lib/results.js";
import { isDriverStanding, type Standing, standingKey } from "../lib/standings.js";
import { cn } from "../lib/utils.js";
import { DisclosureButton } from "./DisclosureButton.js";
import { DriverName } from "./DriverName.js";
import { useEntryName } from "./EntryNames.js";
import { RaceByRace } from "./RaceByRace.js";
import { DriverHistory, TeamHistory } from "./SeasonHistory.js";
import { TeamCar } from "./TeamCar.js";
import { TeamName } from "./TeamName.js";
import { Card, CardDescription, CardHeader, CardTitle } from "./ui/card.js";
import {
  Table,
  TableBody,
  TableCell,
  TableExpansion,
  TableHead,
  TableHeader,
  TablePosition,
  TableRow,
} from "./ui/table.js";

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
/**
 * The cars' own column, between the names and the figures.
 *
 * A column rather than a car inside the name cell, because a table sizes a
 * column to its widest cell: every car then starts just past the longest name
 * *in this table*, whatever season it is. A fixed width in the name cell
 * cannot promise that, and a long team name pushed its car out of line.
 * `w-full` hands this column the table's spare width, so the cars stay close
 * to the names and the figures close up on the right. Hidden on a phone, where
 * the names need the room.
 */
const CAR_COLUMN = "hidden w-full sm:table-cell";

export function StandingsTable({
  title,
  description,
  nameColumn,
  standings,
  season,
  points,
  calendar,
  year,
  badge = false,
  car = false,
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
  /** Draw the team's car on every row, by the same rule and with the same default. */
  car?: boolean;
  /** The results both the table and its expansions are derived from. */
  season: SeasonResult;
  /** The season's points scale, so an expansion scores its rounds as the table did. */
  points: PointsScale;
  /** Names the rounds inside an expansion. From the world's year, not a fixed one. */
  calendar: readonly CalendarRace[];
  /** The season's year, so an expansion's rounds link to their races. */
  year?: number | undefined;
}) {
  // Which row is expanded, or null for none — keyed by driver or team id, so
  // the two tables on the summary open independently. Purely view state: it
  // says nothing about the simulation, so it stays here rather than the store.
  const [openKey, setOpenKey] = useState<string | null>(null);
  const nameOf = useEntryName();
  const columnCount = COLUMNS.length + (car ? 3 : 2);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {description} The arrow opens a {nameColumn.toLowerCase()}’s season race by race, the name
          their career.
        </CardDescription>
      </CardHeader>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10 px-0 text-center">Pos</TableHead>
            <TableHead>{nameColumn}</TableHead>
            {car ? <TableHead className={CAR_COLUMN} /> : null}
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
                  <TablePosition>{index + 1}</TablePosition>
                  <TableCell>
                    {/*
                      Two controls, as on a record card's lineage row: the
                      chevron opens the season race by race, the name opens the
                      career panel every name in a run opens. A name cannot be
                      both a button and the trigger of another one.
                    */}
                    <span className="flex items-center gap-1">
                      <DisclosureButton
                        open={isOpen}
                        onToggle={() => {
                          setOpenKey(isOpen ? null : key);
                        }}
                        label={`${
                          isDriver ? driverName(standing.driverId) : nameOf(standing.teamId)
                        } race by race`}
                      />
                      {isDriver ? (
                        <DriverHistory driverId={standing.driverId}>
                          <DriverName
                            driverId={standing.driverId}
                            teamId={standing.teamId}
                            emphasis={index === 0}
                            badge={badge}
                          />
                        </DriverHistory>
                      ) : (
                        <TeamHistory teamId={standing.teamId}>
                          <TeamName teamId={standing.teamId} emphasis={index === 0} badge={badge} />
                        </TeamHistory>
                      )}
                    </span>
                  </TableCell>
                  {car ? (
                    <TableCell className={CAR_COLUMN}>
                      <TeamCar teamId={standing.teamId} />
                    </TableCell>
                  ) : null}
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
                  <TableExpansion colSpan={columnCount}>
                    <RaceByRace
                      rounds={
                        isDriver
                          ? driverRounds(season, points, standing.driverId)
                          : teamRounds(season, points, standing.teamId)
                      }
                      calendar={calendar}
                      year={year}
                      showDriver={!isDriver}
                    />
                  </TableExpansion>
                ) : null}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
