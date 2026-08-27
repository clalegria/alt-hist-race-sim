import { useState } from "react";
import { STANDOUT_ROW, STANDOUT_TEXT } from "../lib/highlight.js";
import { isDriverStanding, type Standing, standingKey } from "../lib/standings.js";
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
 * Places gained or lost since the previous round.
 *
 * Renders an empty box of the same width when nothing moved, so the names stay
 * aligned down the column rather than jogging left and right. The direction is
 * carried by the glyph as well as the colour — an arrow that only differed by
 * hue would say nothing to a red-green colourblind reader.
 */
function Movement({ places }: { places: number | null }) {
  if (places === null || places === 0) {
    return <span aria-hidden="true" className="inline-block w-2.5" />;
  }
  const gained = places > 0;
  return (
    <span
      title={`${gained ? "Up" : "Down"} ${Math.abs(places)} ${Math.abs(places) === 1 ? "place" : "places"}`}
      className={cn(
        "inline-block w-2.5 text-[0.5rem] leading-none",
        gained ? "text-gain" : "text-loss",
      )}
    >
      {gained ? "▲" : "▼"}
    </span>
  );
}

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
  previousPositions,
  clinchedBy,
}: {
  title: string;
  standings: readonly Standing[];
  /**
   * Where everyone sat after the previous round, 1-based. Omitted for round one,
   * where there is nothing to have moved from.
   */
  previousPositions?: ReadonlyMap<string, number> | undefined;
  /**
   * Whoever has mathematically won, if anyone has yet. Their row keeps the
   * champion's accent for every remaining round, not only the one it happened on.
   */
  clinchedBy?: string | undefined;
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
          {rows.map((standing, index) => {
            const key = standingKey(standing);
            const was = previousPositions?.get(key);
            const moved = was === undefined ? null : was - (index + 1);
            const won = key === clinchedBy;
            return (
              <TableRow key={key} className={cn(won && STANDOUT_ROW)}>
                <TableCell className="w-12 py-1.5 pr-0 text-right">
                  <span className="inline-flex items-center gap-1">
                    <Movement places={moved} />
                    <span
                      className={cn(
                        "tabular-nums",
                        won && cn(STANDOUT_TEXT, "font-semibold"),
                        won ||
                          (index === 0 ? "text-foreground font-semibold" : "text-muted-foreground"),
                      )}
                    >
                      {index + 1}
                    </span>
                  </span>
                </TableCell>
                {/*
                 * `w-full max-w-0` is the only way a cell in an auto-layout
                 * table lets its contents truncate: the width claims the slack
                 * the other two columns leave, and the zero maximum stops the
                 * column being sized by the name inside it. Without the pair,
                 * "Lola-Coventry Climax" simply makes the table wider than the
                 * sidebar and the card grows a scrollbar.
                 */}
                <TableCell className="w-full max-w-0 py-1.5">
                  {isDriverStanding(standing) ? (
                    <DriverName
                      driverId={standing.driverId}
                      teamId={standing.teamId}
                      emphasis={index === 0}
                      tight
                    />
                  ) : (
                    <TeamName teamId={standing.teamId} emphasis={index === 0} tight />
                  )}
                </TableCell>
                <TableCell
                  className={cn(
                    "w-10 py-1.5 text-right font-semibold tabular-nums",
                    won && STANDOUT_TEXT,
                    !won && standing.points === 0 && "text-subtle font-normal",
                  )}
                >
                  {standing.points}
                </TableCell>
              </TableRow>
            );
          })}
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
