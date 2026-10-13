import { useState } from "react";
import { STANDOUT_POSITION, STANDOUT_TEXT } from "../lib/highlight.js";
import { isDriverStanding, type Standing, standingKey } from "../lib/standings.js";
import { cn } from "../lib/utils.js";
import { DriverName } from "./DriverName.js";
import { DriverHistory, HISTORY_FILL, TeamHistory } from "./SeasonHistory.js";
import { ShowAllButton } from "./ShowAllButton.js";
import { TeamName } from "./TeamName.js";
import { Card, CardHeader, CardTitle } from "./ui/card.js";
import { Table, TableBody, TableCell, TablePosition, TableRow } from "./ui/table.js";

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
    return <span aria-hidden="true" className="inline-block w-2.5 shrink-0" />;
  }
  const gained = places > 0;
  return (
    <span
      title={`${gained ? "Up" : "Down"} ${Math.abs(places)} ${Math.abs(places) === 1 ? "place" : "places"}`}
      className={cn(
        "inline-block w-2.5 shrink-0 text-[0.5rem] leading-none",
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
              <TableRow key={key}>
                <TablePosition className={cn("w-8 min-w-8 py-1.5", won && STANDOUT_POSITION)}>
                  {index + 1}
                </TablePosition>
                {/*
                 * `w-full max-w-0` is the only way a cell in an auto-layout
                 * table lets its contents truncate: the width claims the slack
                 * the other two columns leave, and the zero maximum stops the
                 * column being sized by the name inside it. Without the pair,
                 * "Lola-Coventry Climax" simply makes the table wider than the
                 * sidebar and the card grows a scrollbar.
                 *
                 * The movement arrow leads the name rather than sitting in the
                 * block, where green or red on the champion's accent fill would
                 * not read.
                 */}
                <TableCell className="w-full max-w-0 py-1.5 pl-2">
                  <span className="flex items-center gap-1.5">
                    <Movement places={moved} />
                    <span className="min-w-0 flex-1">
                      {isDriverStanding(standing) ? (
                        <DriverHistory driverId={standing.driverId} className={HISTORY_FILL}>
                          <DriverName
                            driverId={standing.driverId}
                            teamId={standing.teamId}
                            emphasis={index === 0}
                            tight
                          />
                        </DriverHistory>
                      ) : (
                        <TeamHistory teamId={standing.teamId} className={HISTORY_FILL}>
                          <TeamName
                            teamId={standing.teamId}
                            emphasis={index === 0}
                            tight
                            capitals
                          />
                        </TeamHistory>
                      )}
                    </span>
                  </span>
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
        <ShowAllButton
          expanded={expanded}
          onToggle={() => {
            setExpanded(!expanded);
          }}
          total={standings.length}
          collapsed={COLLAPSED_ROWS}
        />
      ) : null}
    </Card>
  );
}
