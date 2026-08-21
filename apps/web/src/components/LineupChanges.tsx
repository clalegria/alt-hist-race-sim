import type { SeatChange } from "@alt-hist/data";
import { driverName, teamName } from "../lib/names.js";
import { cn } from "../lib/utils.js";

/**
 * What a reader did to the grid, said in one place.
 *
 * Two shapes of the same fact, because it is worth knowing at two different
 * distances: a line at the top of the season summary, so nobody reads a
 * championship as history when it is not, and the full list at the foot of the
 * grid, where the teams it happened to are on screen.
 *
 * Arrivals pair with departures one for one — the lineup model only permits
 * swaps, so every seat taken is a seat lost — which is what lets this read as
 * "Nigel Mansell for Alan Jones" instead of two unrelated lists.
 */

/** "3 changes", or "1 change". */
export function changeCount(changes: readonly SeatChange[]): string {
  const seats = changes.reduce((total, change) => total + change.in.length, 0);
  return `${seats} change${seats === 1 ? "" : "s"}`;
}

/** Every swap, one line per team, alphabetically as the grid lists them. */
export function LineupChanges({ changes }: { changes: readonly SeatChange[] }) {
  const ordered = [...changes].sort((a, b) => teamName(a.teamId).localeCompare(teamName(b.teamId)));

  return (
    <ul className="flex flex-col gap-1 text-xs">
      {ordered.map((change) => (
        <li key={change.teamId} className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-medium">{teamName(change.teamId)}</span>
          <span className="text-muted-foreground">
            {change.in
              .map(
                (driverId, seat) =>
                  `${driverName(driverId)} for ${driverName(change.out[seat] ?? "")}`,
              )
              .join(", ")}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The banner at the head of an edited season.
 *
 * Deliberately not the accent used for winners and champions: this is a caveat
 * on the result, not a celebration of one, and borrowing the accent would make
 * "the grid was changed" look like something that was won.
 */
export function EditedGridBanner({
  changes,
  className,
}: {
  changes: readonly SeatChange[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-border bg-muted/40 flex flex-col gap-2 rounded-xl border border-dashed px-4 py-3",
        className,
      )}
    >
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-sm font-semibold tracking-tight">Alternate grid</span>
        <span className="text-muted-foreground text-xs">
          This season was run on an edited grid — {changeCount(changes)} from the season as it was
          entered.
        </span>
      </div>
      <LineupChanges changes={changes} />
    </div>
  );
}
