import type {
  ArrangementKind,
  ChassisChange,
  EngineChange,
  GridArrangement,
  RatingMode,
  SeatChange,
} from "@alt-hist/data";
import type { KeptNotes } from "../lib/kept.js";
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
 * Three *kinds* of change, listed together: who drives the car, what is in the
 * back of it, and how good the chassis is. All are the reader rewriting the
 * entry list, and splitting them into separate notices would make a season that
 * changed one of each look like several separate caveats.
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
  const cast = arrangement.includeUnemployed
    ? `Drivers without a seat could be picked too, ${band}.`
    : "Only that season's drivers.";
  return arrangement.retain ? `${cast} Repeated every season.` : cast;
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

/** "A", "A and B", "A, B and C". */
function listed(names: readonly string[]): string {
  return names.length <= 1
    ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")} and ${names.at(-1) ?? ""}`;
}

/**
 * What *Keep the first season's teams* did to a year, as sentences: the ghosts and
 * their cars, how many seats were kept and signed, and who is short of
 * drivers. Pure, so a test reads the words without a DOM.
 */
export function keptSentences(
  notes: KeptNotes,
  seasonYear: number,
  nameOf: (teamId: string) => string,
): readonly string[] {
  const sentences: string[] = [];
  const ghosts = Object.entries(notes.ghosts);
  if (ghosts.length > 0) {
    const named = ghosts.map(([teamId, year]) => `${nameOf(teamId)} (${year})`);
    sentences.push(
      `Gone by ${seasonYear} in real life, still racing their last real car: ${listed(named)}.`,
    );
  }
  const counts = [
    notes.carried.size === 0 ? null : `${notes.carried.size} kept last year's driver`,
    notes.signed.size === 0
      ? null
      : notes.signed.size === 1
        ? "1 new signing"
        : `${notes.signed.size} new signings`,
  ].filter((part): part is string => part !== null);
  if (counts.length > 0) {
    sentences.push(`Seats that were empty in real life: ${counts.join(", ")}.`);
  }
  const short = notes.short.map(({ teamId, cars }) =>
    cars === 0
      ? `${nameOf(teamId)} sits the year out`
      : `${nameOf(teamId)} runs ${cars === 1 ? "one car" : `${cars} cars`}`,
  );
  if (short.length > 0) {
    sentences.push(`No free driver to sign, so ${listed(short)}.`);
  }
  return sentences;
}

/**
 * The kept grid's own notice: muted and dashed like the edited-grid one, but
 * separate from it, since a kept seat is the year's starting point rather than
 * something the reader changed. Nothing at all for a year Keep left as history
 * had it.
 */
export function KeptNote({
  notes,
  seasonYear,
  nameOf,
}: {
  notes: KeptNotes;
  seasonYear: number;
  nameOf: (teamId: string) => string;
}) {
  const sentences = keptSentences(notes, seasonYear, nameOf);
  if (sentences.length === 0) {
    return null;
  }
  return (
    <div className="border-border bg-muted/40 flex flex-col gap-1 rounded-lg border border-dashed px-3 py-2">
      <span className="text-xs font-semibold tracking-tight">Kept from {notes.from}</span>
      {sentences.map((sentence) => (
        <span key={sentence} className="text-muted-foreground text-xs">
          {sentence}
        </span>
      ))}
    </div>
  );
}

/** A signed change, "+2" or "−1" with a real minus sign; nothing for no change. */
export function signed(delta: number): string {
  if (delta === 0) {
    return "";
  }
  return delta > 0 ? `+${delta}` : `\u2212${Math.abs(delta)}`;
}

/** The chassis ratings in the order the grid lists them, each named by its key. */
const CHASSIS_KEYS = ["racing", "qualifying", "consistency", "reliability"] as const;

/**
 * How a chassis moved: one delta when all four ratings moved together — which
 * is what the card's buttons do — or each rating that moved, by name.
 *
 * The one reading behind both ways of saying it below, so the card and the
 * changes list cannot disagree.
 */
function chassisMoves(change: ChassisChange): number | readonly string[] {
  const moves = CHASSIS_KEYS.map((key) => ({
    label: key,
    delta: change.to[key] - change.from[key],
  }));
  const first = moves[0]?.delta ?? 0;
  if (moves.every((move) => move.delta === first)) {
    return first;
  }
  return moves
    .filter((move) => move.delta !== 0)
    .map((move) => `${move.label} ${signed(move.delta)}`);
}

/**
 * What moved, as the card's Chassis row says it: "+2 each", or "racing +3,
 * reliability −1".
 *
 * Words about the chassis ratings and never a number beside the overall: the
 * overall blends the chassis with its engine and weights racing heavily, so
 * four points of reliability move it by about 0.2, and a lone "+1" next to it
 * would be read as the overall's own change.
 */
export function chassisSummary(change: ChassisChange): string {
  const moves = chassisMoves(change);
  return typeof moves === "number" ? `${signed(moves)} each` : moves.join(", ");
}

/**
 * A re-rated chassis in the changes list: "Chassis +2" when all four ratings
 * moved together, and otherwise "Chassis: racing +3, reliability −1".
 */
export function chassisNote(change: ChassisChange): string {
  const moves = chassisMoves(change);
  return typeof moves === "number" ? `Chassis ${signed(moves)}` : `Chassis: ${moves.join(", ")}`;
}

/** "3 changes", or "1 change" — seats, engines and chassis counted together. */
export function changeCount(
  changes: readonly SeatChange[],
  engineChanges: readonly EngineChange[] = [],
  chassisChanges: readonly ChassisChange[] = [],
): string {
  // The longer of the two sides, so a departure nobody has replaced still
  // counts as the change it is.
  const seats = changes.reduce(
    (total, change) => total + Math.max(change.in.length, change.out.length),
    0,
  );
  // A re-rated chassis is one change, however many ratings moved and by how
  // much: it is one team's car, as an engine swap is.
  const total = seats + engineChanges.length + chassisChanges.length;
  return `${total} change${total === 1 ? "" : "s"}`;
}

/** Every swap, one line per team, alphabetically as the grid lists them. */
export function GridChanges({
  changes,
  engineChanges = [],
  chassisChanges = [],
}: {
  changes: readonly SeatChange[];
  engineChanges?: readonly EngineChange[];
  chassisChanges?: readonly ChassisChange[];
}) {
  const teamName = useTeamName();
  // One row per team even when its drivers, its engine and its chassis all
  // moved, so a reader scanning the list finds each team once.
  const teamIds = [
    ...new Set([
      ...changes.map((change) => change.teamId),
      ...engineChanges.map((change) => change.teamId),
      ...chassisChanges.map((change) => change.teamId),
    ]),
  ].sort((a, b) => teamName(a).localeCompare(teamName(b)));

  return (
    <ul className="flex flex-col gap-1 text-xs">
      {teamIds.map((teamId) => {
        const seats = changes.find((change) => change.teamId === teamId);
        const engine = engineChanges.find((change) => change.teamId === teamId);
        const chassis = chassisChanges.find((change) => change.teamId === teamId);
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
          ...(chassis === undefined ? [] : [chassisNote(chassis)]),
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
  chassisChanges = [],
  arrangement = null,
  ratingMode,
  className,
}: {
  changes: readonly SeatChange[];
  engineChanges?: readonly EngineChange[];
  chassisChanges?: readonly ChassisChange[];
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
          This season was raced on an edited grid:{" "}
          {changeCount(changes, engineChanges, chassisChanges)} from the real one.
        </span>
      </div>
      {arrangement === null ? null : (
        <ArrangementNote arrangement={arrangement} ratingMode={ratingMode} />
      )}
      <GridChanges
        changes={changes}
        engineChanges={engineChanges}
        chassisChanges={chassisChanges}
      />
    </div>
  );
}
