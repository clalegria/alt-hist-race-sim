import { useState } from "react";
import { isDriverStanding, type Standing } from "../lib/standings.js";
import { cn } from "../lib/utils.js";
import { DriverName } from "./DriverName.js";
import { TeamName } from "./TeamName.js";
import { Card, CardHeader, CardTitle } from "./ui/card.js";
import { Table, TableBody, TableCell, TableRow } from "./ui/table.js";

/**
 * How many rows show before the table is expanded.
 *
 * Eight covers the drivers who can realistically still win a 1980 championship
 * and every team that scores regularly, without the sidebar running longer than
 * the race result it sits beside.
 */
const COLLAPSED_ROWS = 8;

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
  // View state, and only this table's — nothing else cares whether it is open.
  const [expanded, setExpanded] = useState(false);
  const canExpand = standings.length > COLLAPSED_ROWS;
  const rows = expanded || !canExpand ? standings : standings.slice(0, COLLAPSED_ROWS);

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <Table>
        <TableBody>
          {rows.map((standing, index) => (
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
                  <DriverName
                    driverId={standing.driverId}
                    teamId={standing.teamId}
                    emphasis={index === 0}
                  />
                ) : (
                  <TeamName teamId={standing.teamId} emphasis={index === 0} />
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

      {canExpand ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => {
            setExpanded(!expanded);
          }}
          className="border-border text-muted-foreground hover:text-foreground hover:bg-muted/60 focus-visible:ring-ring w-full cursor-pointer border-t px-3 py-2 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          {expanded ? `Show top ${COLLAPSED_ROWS}` : `Show all ${standings.length}`}
        </button>
      ) : null}
    </Card>
  );
}
