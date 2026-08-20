import type { RaceEntryResult, RaceResult } from "@alt-hist/engine";
import { formatGap } from "../lib/format.js";
import { driverName, teamName } from "../lib/names.js";
import { cn } from "../lib/utils.js";
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
    <div className="bg-muted/40 border-border border-y px-3 py-3">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-12 text-right">Pos</TableHead>
            <TableHead>Driver</TableHead>
            <TableHead className="text-right">Grid</TableHead>
            <TableHead className="text-right">Gap</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {classify(race).map((entry) => {
            const finished = entry.finishPosition !== null;
            return (
              <TableRow key={entry.driverId} className="border-border/60">
                <TableCell
                  className={cn(
                    "text-right tabular-nums",
                    entry.finishPosition === 1 && "font-semibold",
                    finished || "text-muted-foreground",
                  )}
                >
                  {entry.finishPosition ?? "—"}
                </TableCell>
                <TableCell className={cn(finished || "text-muted-foreground")}>
                  <div className="flex flex-col leading-tight">
                    <span className={cn(entry.finishPosition === 1 && "font-semibold")}>
                      {driverName(entry.driverId)}
                    </span>
                    <span className="text-muted-foreground text-xs">{teamName(entry.teamId)}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-right tabular-nums">
                  {entry.gridPosition}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right tabular-nums",
                    finished ? "text-muted-foreground" : "text-muted-foreground/50",
                  )}
                >
                  {gapOf(entry)}
                </TableCell>
                <TableCell
                  className={cn("text-xs", finished ? "text-muted-foreground" : "text-primary/80")}
                >
                  {statusOf(entry)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
