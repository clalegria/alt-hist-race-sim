import { pointsForPosition, type RaceEntryResult, type RaceResult } from "@alt-hist/engine";
import { formatGap } from "../lib/format.js";
import { PODIUM_ROW, PODIUM_TEXT, STANDOUT_ROW, STANDOUT_TEXT } from "../lib/highlight.js";
import { cn } from "../lib/utils.js";
import { DriverName } from "./DriverName.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table.js";

/**
 * Orders a race the way a classification sheet does: finishers by position,
 * then the retirements, then the cars that never started — the last two by
 * grid slot, since they have no finishing position to sort on.
 */
function classify(race: RaceResult): readonly RaceEntryResult[] {
  const byGrid = (a: RaceEntryResult, b: RaceEntryResult) => a.gridPosition - b.gridPosition;
  return [
    ...race.entries
      .filter((entry) => entry.finishPosition !== null)
      .sort((a, b) => (a.finishPosition ?? 0) - (b.finishPosition ?? 0)),
    ...race.entries.filter((entry) => entry.started && entry.retired).sort(byGrid),
    ...race.entries.filter((entry) => !entry.started).sort(byGrid),
  ];
}

function statusOf(entry: RaceEntryResult): string {
  if (!entry.started) {
    return "Did not qualify";
  }
  if (entry.dnfCause === "mechanical") {
    return "Retired — mechanical";
  }
  if (entry.dnfCause === "driver-error") {
    return "Retired — driver error";
  }
  return "Finished";
}

function gapOf(entry: RaceEntryResult): string {
  if (entry.finishPosition === 1) {
    return "winner";
  }
  return entry.raceGapToWinner === null ? "—" : formatGap(entry.raceGapToWinner);
}

export function RaceClassification({ race }: { race: RaceResult }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-12 text-right">Pos</TableHead>
          <TableHead>Driver</TableHead>
          <TableHead className="text-right">Grid</TableHead>
          <TableHead className="text-right">Gap</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Pts</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {classify(race).map((entry) => {
          const finished = entry.finishPosition !== null;
          const won = entry.finishPosition === 1;
          // The other two on the podium, marked a step below the winner.
          const podium = entry.finishPosition !== null && entry.finishPosition <= 3 && !won;
          // The default scale, since nothing yet runs a season on another one.
          const points =
            entry.finishPosition === null ? 0 : pointsForPosition(entry.finishPosition);
          return (
            <TableRow
              key={entry.driverId}
              className={cn("border-border/60", won && STANDOUT_ROW, podium && PODIUM_ROW)}
            >
              <TableCell
                className={cn(
                  "text-right tabular-nums",
                  won && cn(STANDOUT_TEXT, "font-semibold"),
                  podium && PODIUM_TEXT,
                  finished || "text-muted-foreground",
                )}
              >
                {entry.finishPosition ?? "—"}
              </TableCell>
              <TableCell className={cn(finished || "text-muted-foreground")}>
                <DriverName driverId={entry.driverId} teamId={entry.teamId} emphasis={won} />
              </TableCell>
              <TableCell className="text-muted-foreground text-right tabular-nums">
                {entry.gridPosition}
              </TableCell>
              <TableCell
                className={cn(
                  "text-right tabular-nums",
                  won && cn(STANDOUT_TEXT, "font-semibold"),
                  won || (finished ? "text-muted-foreground" : "text-muted-foreground/50"),
                )}
              >
                {gapOf(entry)}
              </TableCell>
              <TableCell
                className={cn("text-xs", finished ? "text-muted-foreground" : "text-primary/80")}
              >
                {statusOf(entry)}
              </TableCell>
              <TableCell
                className={cn(
                  "text-right font-semibold tabular-nums",
                  won && STANDOUT_TEXT,
                  podium && PODIUM_TEXT,
                )}
              >
                {/* Blank rather than a column of zeroes: only six cars score. */}
                {points === 0 ? "" : points}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
