import type { CalendarRace } from "@alt-hist/data";
import type { RoundEntry } from "../lib/results.js";
import { statusOf } from "../lib/results.js";
import { cn } from "../lib/utils.js";
import { DriverName } from "./DriverName.js";
import { Flag } from "./Flag.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table.js";

/**
 * One competitor's season, round by round — what opens under a row of the
 * championship table.
 *
 * The columns mirror the race classification the reader has already stepped
 * through (grid, position, status, points), minus the gap, which says nothing
 * once it is out of its own race. Deliberately **unaccented**: the winner's
 * accent and the podium tint belong to the race that was won, and repeating
 * them here would put four or five "winners" on a page whose accent is supposed
 * to mean the champion. A win is marked by weight instead.
 *
 * Drivers and teams share it. A team's expansion is one row *per car* — one,
 * two, or three of them in a round — so the round columns are written once and
 * left blank on the cars beneath, and the driver column is switched on. Those
 * cars arrive in a **fixed order**, the same one every round; `teamRounds` owns
 * that rule and says why.
 */
export function RaceByRace({
  rounds,
  calendar,
  showDriver = false,
}: {
  rounds: readonly RoundEntry[];
  /** Names the rounds. Comes from the world's own year, never a fixed season. */
  calendar: readonly CalendarRace[];
  /** True for a team, whose rows are cars rather than rounds. */
  showDriver?: boolean;
}) {
  if (rounds.length === 0) {
    return <p className="text-muted-foreground px-3 py-2 text-xs">Entered no rounds.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-12 text-right">Rnd</TableHead>
          <TableHead>Grand Prix</TableHead>
          {showDriver ? <TableHead>Driver</TableHead> : null}
          <TableHead className="text-right">Grid</TableHead>
          <TableHead className="text-right">Pos</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Pts</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rounds.map(({ round, entry, points }, index) => {
          const race = calendar[round];
          const finished = entry.finishPosition !== null;
          const won = entry.finishPosition === 1;
          // A second or third car in the same round: the round is already named
          // on the row above, and repeating it reads as two separate races.
          const sameRound = rounds[index - 1]?.round === round;
          return (
            <TableRow key={`${round}-${entry.driverId}`} className="border-border/60">
              <TableCell className="text-muted-foreground text-right tabular-nums">
                {sameRound ? "" : round + 1}
              </TableCell>
              <TableCell>
                {sameRound ? null : (
                  <span className="flex items-center gap-1.5">
                    {race === undefined ? null : (
                      <Flag country={race.country} title={race.country} />
                    )}
                    {race?.name ?? `Round ${round + 1}`}
                  </span>
                )}
              </TableCell>
              {showDriver ? (
                <TableCell className={cn(finished || "text-muted-foreground")}>
                  <DriverName driverId={entry.driverId} emphasis={won} />
                </TableCell>
              ) : null}
              <TableCell className="text-muted-foreground text-right tabular-nums">
                {entry.gridPosition}
              </TableCell>
              <TableCell
                className={cn(
                  "text-right tabular-nums",
                  won && "font-semibold",
                  finished || "text-muted-foreground",
                )}
              >
                {entry.finishPosition ?? "—"}
              </TableCell>
              {/*
                Only when something went wrong. A season is mostly finishes, and
                a column reading "Finished" fourteen times down the page is a
                column that says nothing — the position beside it already said
                the car finished. What a reader is scanning this panel for is
                the rounds that got away.
              */}
              <TableCell className="text-primary/80 text-xs">
                {finished ? "" : statusOf(entry)}
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {/* Blank rather than a column of zeroes, as in the classification. */}
                {points === 0 ? "" : points}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
