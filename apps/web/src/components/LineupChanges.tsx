import type { EngineChange, SeatChange } from "@alt-hist/data";
import { driverName, engineName, teamName } from "../lib/names.js";
import { cn } from "../lib/utils.js";

/**
 * What a reader did to the grid, said in one place.
 *
 * Two shapes of the same fact, because it is worth knowing at two different
 * distances: a line at the top of the season summary, so nobody reads a
 * championship as history when it is not, and the full list at the foot of the
 * grid, where the teams it happened to are on screen.
 *
 * Two *kinds* of change, listed together: who drives the car, and what is in the
 * back of it. Both are the reader rewriting the entry list, and splitting them
 * into two notices would make a season that changed one of each look like two
 * separate caveats.
 *
 * Arrivals pair with departures one for one — the lineup model only permits
 * swaps, so every seat taken is a seat lost — which is what lets this read as
 * "Nigel Mansell for Alan Jones" instead of two unrelated lists. An engine
 * change pairs the same way by construction: a car has exactly one engine, so
 * fitting one always means removing another.
 */

/** "3 changes", or "1 change" — seats and engines counted together. */
export function changeCount(
  changes: readonly SeatChange[],
  engineChanges: readonly EngineChange[] = [],
): string {
  const seats = changes.reduce((total, change) => total + change.in.length, 0);
  const total = seats + engineChanges.length;
  return `${total} change${total === 1 ? "" : "s"}`;
}

/** Every swap, one line per team, alphabetically as the grid lists them. */
export function GridChanges({
  changes,
  engineChanges = [],
}: {
  changes: readonly SeatChange[];
  engineChanges?: readonly EngineChange[];
}) {
  // One row per team even when both its drivers and its engine moved, so a
  // reader scanning the list finds each team once.
  const teamIds = [
    ...new Set([
      ...changes.map((change) => change.teamId),
      ...engineChanges.map((change) => change.teamId),
    ]),
  ].sort((a, b) => teamName(a).localeCompare(teamName(b)));

  return (
    <ul className="flex flex-col gap-1 text-xs">
      {teamIds.map((teamId) => {
        const seats = changes.find((change) => change.teamId === teamId);
        const engine = engineChanges.find((change) => change.teamId === teamId);
        const said = [
          ...(seats === undefined
            ? []
            : seats.in.map(
                (driverId, seat) =>
                  `${driverName(driverId)} for ${driverName(seats.out[seat] ?? "")}`,
              )),
          ...(engine === undefined
            ? []
            : [`${engineName(engine.to)} engine for ${engineName(engine.from)}`]),
        ];
        return (
          <li key={teamId} className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-medium">{teamName(teamId)}</span>
            <span className="text-muted-foreground">{said.join(", ")}</span>
          </li>
        );
      })}
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
  engineChanges = [],
  className,
}: {
  changes: readonly SeatChange[];
  engineChanges?: readonly EngineChange[];
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
          This season was run on an edited grid — {changeCount(changes, engineChanges)} from the
          season as it was entered.
        </span>
      </div>
      <GridChanges changes={changes} engineChanges={engineChanges} />
    </div>
  );
}
