import type { CalendarRace } from "@alt-hist/data";
import type { RoundEntry } from "../lib/results.js";
import { statusOf } from "../lib/results.js";
import { cn } from "../lib/utils.js";
import { DriverName } from "./DriverName.js";
import { Flag } from "./Flag.js";
import { PageLink } from "./PageLink.js";
import { DriverHistory, useRacePage } from "./SeasonHistory.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table.js";

/** Grid and Status, which a phone drops, at the width the classification drops them. */
const WIDE_ONLY = "hidden md:table-cell";

/** The numeric cells, a step tighter on a phone, as the standings' are. */
const FIGURE = "px-2 text-right tabular-nums md:px-3";

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
 *
 * Inside a run each round's name carries the page icon to its race. Every
 * round listed is one the gate revealed, so its race page is reached.
 *
 * **A phone keeps the round, its flag, the driver, the position and the
 * points**, as the classification it mirrors keeps its own short row and from
 * the same width: the round's name goes to screen readers only, Grid and Status
 * are dropped, and the position column says DNF or DNQ where Status would
 * have said why.
 */
export function RaceByRace({
  rounds,
  calendar,
  year,
  showDriver = false,
}: {
  rounds: readonly RoundEntry[];
  /** Names the rounds. Comes from the world's own year, never a fixed season. */
  calendar: readonly CalendarRace[];
  /** Whose rounds these are, for the links to their races; none without it. */
  year?: number | undefined;
  /** True for a team, whose rows are cars rather than rounds. */
  showDriver?: boolean;
}) {
  const racePage = useRacePage();
  if (rounds.length === 0) {
    return <p className="text-muted-foreground px-3 py-2 text-xs">Entered no rounds.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className={cn(FIGURE, "w-12")}>Rnd</TableHead>
          <TableHead>GP</TableHead>
          {showDriver ? <TableHead>Driver</TableHead> : null}
          <TableHead className={cn(FIGURE, WIDE_ONLY)}>Grid</TableHead>
          <TableHead className={FIGURE}>Pos</TableHead>
          <TableHead className={WIDE_ONLY}>Status</TableHead>
          <TableHead className={FIGURE}>Pts</TableHead>
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
              <TableCell className={cn(FIGURE, "text-muted-foreground")}>
                {sameRound ? "" : round + 1}
              </TableCell>
              <TableCell>
                {sameRound ? null : (
                  <span className="flex items-center gap-1.5">
                    {race === undefined ? null : <Flag country={race.country} />}
                    <span className="sr-only md:not-sr-only">
                      {race?.name ?? `Round ${round + 1}`}
                    </span>
                    {racePage === null || year === undefined ? null : (
                      <PageLink
                        link={racePage(year, round)}
                        label={`${year} ${race?.name ?? `round ${round + 1}`} page`}
                      />
                    )}
                  </span>
                )}
              </TableCell>
              {showDriver ? (
                // Wraps on a phone, where a long name would push Pts past the edge.
                <TableCell
                  className={cn(
                    "whitespace-normal md:whitespace-nowrap",
                    finished || "text-muted-foreground",
                  )}
                >
                  <DriverHistory driverId={entry.driverId}>
                    <DriverName driverId={entry.driverId} emphasis={won} />
                  </DriverHistory>
                </TableCell>
              ) : null}
              <TableCell className={cn(FIGURE, WIDE_ONLY, "text-muted-foreground")}>
                {entry.gridPosition}
              </TableCell>
              <TableCell
                className={cn(FIGURE, won && "font-semibold", finished || "text-muted-foreground")}
              >
                {finished ? (
                  entry.finishPosition
                ) : (
                  // Wide, the Status column says why and this one is a dash; on a
                  // phone, where Status is hidden, it carries the short word.
                  <>
                    <span className="text-loss md:hidden">{entry.started ? "DNF" : "DNQ"}</span>
                    <span className="hidden md:inline">—</span>
                  </>
                )}
              </TableCell>
              {/*
                Only when something went wrong. A season is mostly finishes, and
                a column reading "Finished" fourteen times down the page is a
                column that says nothing — the position beside it already said
                the car finished. What a reader is scanning this panel for is
                the rounds that got away.
              */}
              <TableCell className={cn(WIDE_ONLY, "text-loss text-xs")}>
                {finished ? "" : statusOf(entry)}
              </TableCell>
              <TableCell className={cn(FIGURE, "font-semibold")}>
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
