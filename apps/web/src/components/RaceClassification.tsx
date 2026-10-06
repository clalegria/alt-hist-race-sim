import type { PointsScale, RaceEntryResult, RaceResult } from "@alt-hist/engine";
import { formatGap } from "../lib/format.js";
import { PODIUM_ROW, PODIUM_TEXT, STANDOUT_ROW, STANDOUT_TEXT } from "../lib/highlight.js";
import { byClassification, pointsFor, statusOf } from "../lib/results.js";
import { cn } from "../lib/utils.js";
import { DriverName } from "./DriverName.js";
import { HomeStar } from "./HomeAdvantage.js";
import { DriverHistory } from "./SeasonHistory.js";
import { TeamCar } from "./TeamCar.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table.js";

/**
 * Orders a race the way a classification sheet does.
 *
 * The comparator lives in `lib/results.ts` because a team's expansion in the
 * championship table orders its own two or three cars by exactly the same rule,
 * and two copies of "how a race sheet is ordered" would drift.
 */
function classify(race: RaceResult): readonly RaceEntryResult[] {
  return [...race.entries].sort(byClassification);
}

/**
 * Tighter than the default cell padding, on every cell of this table.
 *
 * The classification shares a row with the championship sidebar, so it gets
 * about two thirds of the page rather than all of it, and the default `px-3`
 * across six columns was enough to tip it into a horizontal scrollbar. Applied
 * per cell rather than as a `[&_td]:px-2` variant on the table: that version
 * worked, but only by out-specifying the cell's own padding, which is invisible
 * both in the markup and to anyone reading the component.
 */
const CELL = "px-2";

/**
 * The cars' own column, between the names and the grid.
 *
 * A column rather than a car inside the name cell, so the table sizes it past
 * the longest name on the sheet and every car lines up. `w-full` gives it the
 * spare width the name cell used to take, which keeps the cars beside the
 * names. Only from `md`: below that the sheet is already short of room, and a
 * car is not worth a sideways scrollbar.
 */
const CAR_COLUMN = "hidden w-full md:table-cell";

function gapOf(entry: RaceEntryResult): string {
  if (entry.finishPosition === 1) {
    return "winner";
  }
  return entry.raceGapToWinner === null ? "—" : formatGap(entry.raceGapToWinner);
}

export function RaceClassification({
  race,
  points,
  country,
  badge = false,
  car = false,
}: {
  race: RaceResult;
  /** The season's points scale. What a finish is worth depends on the year. */
  points: PointsScale;
  /**
   * Where the round was held, so an entry racing at home can be starred. Absent
   * for a sheet shown outside a round, which simply stars nobody.
   */
  country?: string | undefined;
  /**
   * Draw a livery badge on every row. On for the race screen, off where this
   * sheet is the *expansion* of a calendar row — nothing that only appears
   * after a click wears one, so opening a round stays a step down in weight
   * rather than repeating the screen the reader just left.
   */
  badge?: boolean;
  /** Draw the team's car on every row, by the same rule and with the same default. */
  car?: boolean;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className={cn(CELL, "w-12 text-right")}>Pos</TableHead>
          <TableHead className={CELL}>Driver</TableHead>
          {car ? <TableHead className={cn(CELL, CAR_COLUMN)} /> : null}
          <TableHead className={cn(CELL, "text-right")}>Grid</TableHead>
          <TableHead className={cn(CELL, "text-right")}>Gap</TableHead>
          <TableHead className={CELL}>Status</TableHead>
          <TableHead className={cn(CELL, "text-right")}>Pts</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {classify(race).map((entry) => {
          const finished = entry.finishPosition !== null;
          const won = entry.finishPosition === 1;
          // The other two on the podium, marked a step below the winner.
          const podium = entry.finishPosition !== null && entry.finishPosition <= 3 && !won;
          const scored = pointsFor(entry, points);
          return (
            <TableRow
              key={entry.driverId}
              className={cn("border-border/60", won && STANDOUT_ROW, podium && PODIUM_ROW)}
            >
              <TableCell
                className={cn(
                  CELL,
                  "text-right tabular-nums",
                  won && cn(STANDOUT_TEXT, "font-semibold"),
                  podium && PODIUM_TEXT,
                  finished || "text-muted-foreground",
                )}
              >
                {entry.finishPosition ?? "—"}
              </TableCell>
              <TableCell
                className={cn(
                  CELL,
                  // The spare width goes to the car column once it shows, and the
                  // names stop wrapping then: squeezed by that column, they
                  // folded onto two lines when there was room for one.
                  "w-full whitespace-normal",
                  car && "md:w-auto md:whitespace-nowrap",
                  finished || "text-muted-foreground",
                )}
              >
                {/*
                  The star trails the name block, aligned to its foot rather
                  than its middle: the name is two lines, and a mark hung off
                  the first of them would read as part of the driver's name
                  rather than as a note on the entry.
                */}
                <span className="flex items-end gap-1.5">
                  <DriverHistory driverId={entry.driverId}>
                    <DriverName
                      driverId={entry.driverId}
                      teamId={entry.teamId}
                      emphasis={won}
                      badge={badge}
                    />
                  </DriverHistory>
                  <HomeStar driverId={entry.driverId} country={country} className="pb-0.5" />
                </span>
              </TableCell>
              {car ? (
                <TableCell className={cn(CELL, CAR_COLUMN)}>
                  <TeamCar teamId={entry.teamId} />
                </TableCell>
              ) : null}
              <TableCell className={cn(CELL, "text-muted-foreground text-right tabular-nums")}>
                {entry.gridPosition}
              </TableCell>
              <TableCell
                className={cn(
                  CELL,
                  "text-right tabular-nums",
                  won && cn(STANDOUT_TEXT, "font-semibold"),
                  won || (finished ? "text-muted-foreground" : "text-subtle"),
                )}
              >
                {gapOf(entry)}
              </TableCell>
              <TableCell
                className={cn(
                  CELL,
                  "whitespace-normal text-xs",
                  finished ? "text-muted-foreground" : "text-primary",
                )}
              >
                {statusOf(entry)}
              </TableCell>
              <TableCell
                className={cn(
                  CELL,
                  "text-right font-semibold tabular-nums",
                  won && STANDOUT_TEXT,
                  podium && PODIUM_TEXT,
                )}
              >
                {/* Blank rather than a column of zeroes: only six cars score. */}
                {scored === 0 ? "" : scored}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
