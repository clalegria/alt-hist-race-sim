import type {
  ArrangementKind,
  EngineChange,
  GridArrangement,
  RatingMode,
  SeatChange,
} from "@alt-hist/data";
import { driverName, engineName } from "../lib/names.js";
import { cn } from "../lib/utils.js";
import { useTeamName } from "./EntryNames.js";

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
 *
 * The one place the pairing runs out is a grid still being edited, where a
 * driver can have left a car nobody has been put in yet. That reads as "Alan
 * Jones out, seat empty" — a departure with nothing opposite it — and it cannot
 * survive into an applied season, because a grid with an open seat cannot be
 * applied.
 */

/**
 * What each bulk rule is called, in one place.
 *
 * The buttons that apply a rule and the notice that says one is in force read
 * the same map, so the grid cannot end up reporting a rule by a different name
 * from the one the reader pressed.
 */
export const ARRANGEMENT_LABELS: Readonly<Record<ArrangementKind, string>> = {
  "fastest-in-fastest": "Fastest drivers in fastest teams",
  "fastest-in-slowest": "Fastest drivers in slowest teams",
  random: "Randomize grid",
};

/**
 * What a rule did, in a sentence: the cast it drew on, and whether it repeats.
 *
 * The cast is worth spelling out because it is the reader's own — the pool
 * filters travel inside the arrangement, so a rule kept across an era is drawing
 * on a set that is no longer on screen anywhere. The age band is named with the
 * same word the filter panel uses, which is not the same word in both modes:
 * `ratedAge` reads the band against a driver's peak age under `peak`, and
 * "aged 18 to 42" beside a 1980 season would be read as 1980 ages.
 */
export function arrangementNote(arrangement: GridArrangement, mode: RatingMode): string {
  const { filters } = arrangement;
  const band = `${mode === "peak" ? "peak age" : "aged"} ${filters.minAge} to ${filters.maxAge}`;
  const era = filters.hideRetired && filters.hideFuture ? ", racing that season" : "";
  const cast = arrangement.includeUnemployed
    ? `Drivers without a drive were in the running — ${band}${era}.`
    : "Only the drivers the season entered.";
  return arrangement.retain ? `${cast} Kept for every season of the era.` : cast;
}

/**
 * The rule a grid was arranged by, said on the grid it arranged.
 *
 * Its own line rather than a row of `GridChanges`, because it is not a change to
 * a team: it is the answer to "why does this grid look like that", and the seat
 * swaps underneath it are the working. It also has to be able to stand alone —
 * a shuffle can land on the grid the season was entered with, and the reader who
 * pressed the button is still owed a word about what happened.
 */
export function ArrangementNote({
  arrangement,
  ratingMode,
}: {
  arrangement: GridArrangement;
  /** Which age the pool was filtered on — see `arrangementNote`. */
  ratingMode: RatingMode;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <span className="text-xs font-medium">{ARRANGEMENT_LABELS[arrangement.kind]}</span>
      <span className="text-muted-foreground text-xs">
        {arrangementNote(arrangement, ratingMode)}
      </span>
    </div>
  );
}

/** "3 changes", or "1 change" — seats and engines counted together. */
export function changeCount(
  changes: readonly SeatChange[],
  engineChanges: readonly EngineChange[] = [],
): string {
  // The longer of the two sides, so a departure nobody has replaced still
  // counts as the change it is.
  const seats = changes.reduce(
    (total, change) => total + Math.max(change.in.length, change.out.length),
    0,
  );
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
  const teamName = useTeamName();
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
            : Array.from({ length: Math.max(seats.in.length, seats.out.length) }, (_, seat) => {
                const arrived = seats.in[seat];
                const left = seats.out[seat];
                if (arrived === undefined) {
                  return `${driverName(left ?? "")} out, seat empty`;
                }
                return left === undefined
                  ? `${driverName(arrived)} in`
                  : `${driverName(arrived)} for ${driverName(left)}`;
              })),
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
  arrangement = null,
  ratingMode,
  className,
}: {
  changes: readonly SeatChange[];
  engineChanges?: readonly EngineChange[];
  /** The bulk rule the grid was arranged by, if it was one rather than swaps. */
  arrangement?: GridArrangement | null;
  /** Read only by the rule's note, and only to name the age band it filtered on. */
  ratingMode: RatingMode;
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
      {arrangement === null ? null : (
        <ArrangementNote arrangement={arrangement} ratingMode={ratingMode} />
      )}
      <GridChanges changes={changes} engineChanges={engineChanges} />
    </div>
  );
}
