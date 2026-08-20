import { teamName } from "../lib/names.js";
import { isDriverStanding, type Standing } from "../lib/standings.js";
import { cn } from "../lib/utils.js";
import { DriverName } from "./DriverName.js";
import { Card, CardHeader, CardTitle } from "./ui/card.js";
import { Table, TableBody, TableCell, TableRow } from "./ui/table.js";

/**
 * A championship table cut down to position, name and points.
 *
 * Sits beside a race result rather than under it, where the full table's wins,
 * podiums, poles and retirement counts are noise: after a single round what a
 * reader wants is who leads and by how much.
 */
export function CompactStandings({
  title,
  standings,
}: {
  title: string;
  standings: readonly Standing[];
}) {
  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <Table>
        <TableBody>
          {standings.map((standing, index) => (
            <TableRow key={isDriverStanding(standing) ? standing.driverId : standing.teamId}>
              <TableCell
                className={cn(
                  "w-8 py-1.5 text-right tabular-nums",
                  index === 0 ? "text-foreground font-semibold" : "text-muted-foreground",
                )}
              >
                {index + 1}
              </TableCell>
              <TableCell className="py-1.5">
                {isDriverStanding(standing) ? (
                  <DriverName driverId={standing.driverId} emphasis={index === 0} />
                ) : (
                  <span className={cn(index === 0 && "font-semibold")}>
                    {teamName(standing.teamId)}
                  </span>
                )}
              </TableCell>
              <TableCell
                className={cn(
                  "w-10 py-1.5 text-right font-semibold tabular-nums",
                  standing.points === 0 && "text-muted-foreground/50 font-normal",
                )}
              >
                {standing.points}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
