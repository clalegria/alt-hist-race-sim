import type { RaceResult } from "@alt-hist/engine";
import { formatSeconds } from "../lib/format.js";
import { cn } from "../lib/utils.js";
import { DriverName } from "./DriverName.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table.js";

/**
 * A qualifying sheet.
 *
 * Everyone entered runs, so this lists the whole field — including the cars that
 * qualified outside the starting limit, which is the only place a DNQ is
 * explained rather than just absent from Sunday.
 */
export function QualifyingResults({ race }: { race: RaceResult }) {
  const order = [...race.entries].sort((a, b) => a.gridPosition - b.gridPosition);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12 text-right">Pos</TableHead>
          <TableHead>Driver</TableHead>
          <TableHead className="text-right">Gap</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {order.map((entry) => (
          <TableRow key={entry.driverId} className={cn(entry.started || "opacity-60")}>
            <TableCell
              className={cn(
                "text-right tabular-nums",
                entry.gridPosition === 1 ? "font-semibold" : "text-muted-foreground",
              )}
            >
              {entry.gridPosition}
            </TableCell>
            <TableCell>
              <DriverName
                driverId={entry.driverId}
                teamId={entry.teamId}
                emphasis={entry.gridPosition === 1}
              />
            </TableCell>
            <TableCell className="text-muted-foreground text-right tabular-nums">
              {entry.gridPosition === 1 ? "pole" : formatSeconds(entry.qualifyingGapToPole)}
            </TableCell>
            <TableCell className="text-primary/80 text-xs">
              {entry.started ? "" : "Did not qualify"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
