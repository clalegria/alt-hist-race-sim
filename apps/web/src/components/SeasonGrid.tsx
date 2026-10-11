import type {
  ChassisChange,
  ChassisSpec,
  EngineChange,
  GridArrangement,
  GridPick,
  RatingMode,
  SeatChange,
} from "@alt-hist/data";
import {
  canStepChassis,
  driversById,
  type SeasonChassis,
  type SeasonEngineRatings,
} from "@alt-hist/data";
import { DEVELOPMENT_TREND_LIMIT, type EngineSpec, type RaceEntrant } from "@alt-hist/engine";
import type { KeptNotes } from "../lib/kept.js";
import { liveryFor } from "../lib/livery.js";
import { driverName, engineName, entryName, teamCountry, teamName } from "../lib/names.js";
import { ratedAge } from "../lib/people.js";
import { carOverall, carRacing, driverOverall } from "../lib/rating.js";
import { DEFAULT_SORT_ORDER, type SortOrder, sortBy } from "../lib/sort.js";
import { cn } from "../lib/utils.js";
import { useNameYear } from "./EntryNames.js";
import { FittedDriverName } from "./FittedName.js";
import { Flag } from "./Flag.js";
import { ArrangementNote, chassisSummary, GridChanges, KeptNote, signed } from "./LineupChanges.js";
import { useLiveryYear } from "./Liveries.js";
import { PageLink } from "./PageLink.js";
import { usePageOf } from "./SeasonHistory.js";
import { SortToggle } from "./SortToggle.js";
import { LiveryBadge, LiveryCorner } from "./TeamBadge.js";
import { LiveryCar } from "./TeamCar.js";
import { Button } from "./ui/button.js";
import { Card, CardDescription, CardHeader, CardTitle } from "./ui/card.js";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover.js";

const drivers = driversById();

const DRIVER_RATINGS = [
  { key: "racing", label: "Racing" },
  { key: "qualifying", label: "Qualifying" },
  { key: "consistency", label: "Consistency" },
  { key: "composure", label: "Composure" },
  { key: "wetWeather", label: "Wet weather" },
  { key: "adaptability", label: "Adaptability" },
] as const;

const CHASSIS_RATINGS = [
  { key: "racing", label: "Racing" },
  { key: "qualifying", label: "Qualifying" },
  { key: "consistency", label: "Consistency" },
  { key: "reliability", label: "Reliability" },
] as const;

/**
 * An engine has three, not four: consistency belongs to the chassis, so the
 * chassis panel lists one rating the engine panel underneath it does not.
 */
const ENGINE_RATINGS = [
  { key: "racing", label: "Racing" },
  { key: "qualifying", label: "Qualifying" },
  { key: "reliability", label: "Reliability" },
] as const;

/**
 * Editing mode: which driver has been picked up, what happens when one is
 * chosen, which engines a team may be given, and how its chassis is re-rated.
 *
 * Controlled, with the draft living in `GridStage` above — so this component
 * stays a pure function of what it is handed, and every state the editor can be
 * in renders on its own without a DOM.
 */
export interface GridEditing {
  /** What the reader has hold of: a driver, an open seat, or nothing. */
  readonly selected: GridPick | null;
  readonly onSelect: (pick: GridPick) => void;
  /** Every engine the season rates, in the order it offers them. */
  readonly engineIds: readonly string[];
  readonly onEngineChange: (teamId: string, engineId: string) => void;
  /** One team's chassis a point better or worse: one rating, or all four when none is named. */
  readonly onChassisStep: (teamId: string, step: 1 | -1, key?: keyof ChassisSpec) => void;
}

/**
 * The driver id of a car nobody has been put in.
 *
 * A seat with no driver still has a team, a chassis and an engine, so the grid
 * draws it as an entrant like any other rather than as a special case
 * threaded through every layout above it — `previewField` in `GridStage` is
 * what mints them. Not a driver id anything could collide with, and nothing
 * simulated ever sees one: a draft holding an open seat cannot be applied.
 */
export const EMPTY_SEAT = "\0 empty seat";

/** Whether a pick is this exact seat. */
function picksSeat(pick: GridPick | null, teamId: string, seat: number): boolean {
  return pick !== null && pick.kind === "seat" && pick.teamId === teamId && pick.seat === seat;
}

/** Whether a pick is this driver. */
function picksDriver(pick: GridPick | null, driverId: string): boolean {
  return pick !== null && pick.kind === "driver" && pick.driverId === driverId;
}

/** The soft fill marking a driver — or an engine — that is not where history put it. */
export const SWAPPED_IN = "bg-muted/70";

/** One rating as a labelled bar, so a 92 and a 44 differ at a glance. */
function Rating({
  label,
  value,
  muted,
  was,
  control,
}: {
  label: string;
  value: number;
  muted?: boolean;
  /**
   * The rating history gave, drawn muted before this run's — a chassis under
   * *Chassis performance*. The bar is this run's.
   */
  was?: number;
  /** Drawn after the number — the chassis stepper, in the editor only. */
  control?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn("w-24 shrink-0 text-xs", muted ? "text-subtle" : "text-muted-foreground")}
      >
        {label}
      </span>
      <span className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
        <span
          className={cn("block h-full rounded-full", muted ? "bg-subtle" : "bg-primary")}
          style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
        />
      </span>
      {was === undefined ? null : (
        <span className="text-subtle w-10 shrink-0 text-right text-xs tabular-nums">{was} →</span>
      )}
      <span className="w-7 shrink-0 text-right text-xs font-medium tabular-nums">{value}</span>
      {control}
    </div>
  );
}

/**
 * A minus and a plus — the card's control for all four chassis ratings, and the
 * popover's for one.
 *
 * Only ever drawn in the editor. Each button is disabled once nothing it would
 * move can move any further, so a press never silently does nothing.
 *
 * The popover passes a `delta` and gets it as a tag between the buttons: there
 * it sits beside one rating and is that rating's own change. The card passes
 * none and says what moved in words after the buttons instead
 * (`chassisSummary`), because a bare number on the card would be read as a
 * change to the overall, which blends the chassis with its engine.
 */
export function ChassisStepper({
  teamName,
  chassis,
  delta,
  rating,
  onStep,
}: {
  /** The team, for the buttons' accessible names. */
  teamName: string;
  /** The chassis as it now stands, to know whether a step can move it. */
  chassis: ChassisSpec;
  /** How far the one rating has moved, for a tag between the buttons; none when absent. */
  delta?: number;
  /** The one rating these buttons move, or all four when absent. */
  rating?: { key: keyof ChassisSpec; label: string };
  onStep: (step: 1 | -1) => void;
}) {
  const what =
    rating === undefined
      ? `${teamName} chassis`
      : `${teamName} chassis ${rating.label.toLowerCase()}`;
  const button = "size-5 shrink-0 rounded px-0 text-xs leading-none";
  return (
    <span className="flex shrink-0 items-center gap-1">
      <Button
        variant="outline"
        className={button}
        aria-label={`Weaken ${what}`}
        disabled={!canStepChassis(chassis, -1, rating?.key)}
        onClick={() => {
          onStep(-1);
        }}
      >
        &minus;
      </Button>
      {delta === undefined ? null : (
        <span className="text-muted-foreground w-9 text-center text-xs tabular-nums">
          {signed(delta)}
        </span>
      )}
      <Button
        variant="outline"
        className={button}
        aria-label={`Strengthen ${what}`}
        disabled={!canStepChassis(chassis, 1, rating?.key)}
        onClick={() => {
          onStep(1);
        }}
      >
        +
      </Button>
    </span>
  );
}

/** The headline number, tinted by how good it is. */
export function Overall({ value }: { value: number }) {
  return (
    <span
      className={cn(
        "w-8 shrink-0 rounded px-1.5 py-0.5 text-center text-xs font-semibold tabular-nums",
        value >= 85 && "bg-primary/15 text-primary",
        value >= 70 && value < 85 && "bg-muted text-foreground",
        value < 70 && "bg-muted/60 text-muted-foreground",
      )}
    >
      {value}
    </span>
  );
}

/**
 * A car's in-season development trend, which is not a rating and so is not drawn
 * as one.
 *
 * The bars above run 0-100 and fill from the left; this runs -10 to +10 and
 * fills from the *middle*, because zero is a real value here rather than the
 * bottom of a scale — a car with no trend is an ordinary car, not a hopeless
 * one. The line down the centre is what makes the two directions read as
 * opposites at a glance.
 *
 * Deliberately absent from `carOverall`. The headline number says how good a car
 * is, and a trend says nothing about that: it rotates the car's pace about
 * mid-season, so what the overall already describes is exactly the average of
 * the year. Folding it in would double-count a car's own rating in one
 * direction and quietly libel it in the other.
 */
function Development({ trend }: { trend: number }) {
  const magnitude = Math.min(Math.abs(trend), DEVELOPMENT_TREND_LIMIT) / DEVELOPMENT_TREND_LIMIT;
  // Half the track, because each direction owns one side of the centre line.
  const width = `${(magnitude * 50).toFixed(1)}%`;
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground w-24 shrink-0 text-xs">Development</span>
      <span className="bg-muted relative h-1.5 flex-1 overflow-hidden rounded-full">
        <span className="bg-border absolute inset-y-0 left-1/2 w-px" />
        <span
          className="bg-primary absolute inset-y-0 rounded-full"
          style={trend >= 0 ? { left: "50%", width } : { right: "50%", width }}
        />
      </span>
      <span className="w-7 shrink-0 text-right text-xs font-medium tabular-nums">
        {trend > 0 ? `+${trend}` : trend}
      </span>
    </div>
  );
}

/** What a trend means, in a sentence, so the bar above never has to be guessed at. */
function developmentNote(trend: number): string {
  const size = Math.abs(trend);
  const points = `${size} ${size === 1 ? "point" : "points"}`;
  return trend > 0
    ? `Gets faster through the year: ${points} slower than this at the first race, ${size} quicker by the last.`
    : `Gets slower through the year: ${points} quicker than this at the first race, ${size} slower by the last.`;
}

/**
 * How a clickable name says so: nothing at rest, a soft fill under the cursor or
 * the keyboard focus, and that same fill held open while its panel is.
 *
 * It used to be a dotted underline, which is the right mark for one link in a
 * paragraph and the wrong one here — this page carries forty-odd names and the
 * grid read as ruled paper, worst of all in dark where a broken line under warm
 * grey text is the highest-frequency thing on the screen. Nothing about a driver
 * name *needs* a permanent mark: the section header already says "Select any
 * name for its full ratings", so the standing instruction is written once
 * instead of restated under every row.
 *
 * The trade is touch, which has no hover and so sees no affordance until it taps
 * — accepted, because the header sentence covers it and the alternative was an
 * information glyph beside all forty-three names.
 *
 * `bg-accent` rather than `bg-muted` because a swapped-in driver's row is
 * already `SWAPPED_IN`, and the hover has to be visible *on top of* that fill.
 * Shared with the edit-mode buttons in `DriverEntry` and `ReserveList`, which
 * are the same name in the same slot doing a different job.
 */
export const NAME_TARGET =
  "hover:bg-accent focus-visible:ring-ring data-[state=open]:bg-accent -mx-1 cursor-pointer rounded px-1 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none";

/** The name button that opens an attribute panel. Same affordance for both. */
function NameTrigger({ className, children }: { className?: string; children: React.ReactNode }) {
  return <PopoverTrigger className={cn(NAME_TARGET, className)}>{children}</PopoverTrigger>;
}

/**
 * Flag, name and age, laid out identically whether the row opens a popover or
 * picks the driver up — so the grid does not reflow on entering edit mode.
 *
 * The age is the one the ratings beside it describe, which in `peak` mode is the
 * age the driver was at their best rather than their age in the loaded year —
 * see `ratedAge`.
 */
export function DriverLabel({
  driverId,
  seasonYear,
  ratingMode,
}: {
  driverId: string;
  seasonYear: number;
  ratingMode: RatingMode;
}) {
  const driver = drivers.get(driverId);
  const age = driver === undefined ? null : ratedAge(driver, seasonYear, ratingMode);

  return (
    <>
      {driver === undefined ? null : (
        <Flag country={driver.nationality} title={driver.nationality} />
      )}
      <FittedDriverName driverId={driverId} className="min-w-0 flex-1" />
      {age === null ? null : (
        <span className="text-muted-foreground shrink-0 text-xs">({age}y)</span>
      )}
    </>
  );
}

/**
 * A car with nobody in it, and the way to fill it.
 *
 * Only ever drawn inside the editor — the world cannot hold one — and it is a
 * button for the same reason a driver's name is: selecting it and then a name
 * puts that driver in this car. It says so out loud, because an empty row is
 * otherwise indistinguishable from a rendering fault, and because this is the
 * one thing standing between the reader and Apply.
 */
function EmptySeat({ teamId, seat, edit }: { teamId: string; seat: number; edit: GridEditing }) {
  const selected = picksSeat(edit.selected, teamId, seat);
  return (
    <li
      className={cn(
        "border-border/70 flex items-center gap-2 rounded border border-dashed px-1 py-0.5 text-sm",
        selected && "ring-primary ring-2",
      )}
    >
      <button
        type="button"
        aria-pressed={selected}
        onClick={() => {
          edit.onSelect({ kind: "seat", teamId, seat });
        }}
        className={cn(NAME_TARGET, "text-muted-foreground min-w-0 flex-1 italic")}
      >
        Empty seat
      </button>
    </li>
  );
}

function DriverEntry({
  entrant,
  seasonYear,
  ratingMode,
  edit,
  swappedIn,
  keptMark = null,
}: {
  entrant: RaceEntrant;
  seasonYear: number;
  ratingMode: RatingMode;
  edit?: GridEditing;
  swappedIn: boolean;
  /**
   * Under *Keep the first season's teams*, how a driver who is not history's came to
   * be in the seat: kept from last year, or signed for an empty one. A word,
   * not `SWAPPED_IN`, which says the reader moved them.
   */
  keptMark?: "kept" | "signed" | null;
}) {
  const driver = drivers.get(entrant.driverId);
  const age = driver === undefined ? null : ratedAge(driver, seasonYear, ratingMode);
  const selected = picksDriver(edit?.selected ?? null, entrant.driverId);
  const pageOf = usePageOf();

  return (
    <li
      className={cn(
        "flex items-center gap-2 rounded px-1 py-0.5 text-sm",
        swappedIn && SWAPPED_IN,
        selected && "ring-primary ring-2",
      )}
    >
      {edit === undefined ? (
        <Popover>
          <NameTrigger className="flex min-w-0 flex-1 items-center gap-1.5">
            <DriverLabel
              driverId={entrant.driverId}
              seasonYear={seasonYear}
              ratingMode={ratingMode}
            />
          </NameTrigger>
          <PopoverContent>
            <div className="mb-3 flex items-baseline justify-between gap-2">
              {/*
                Flag then name, as the row that opened this reads and as a
                driver is named everywhere else. It is the one thing the badge
                rule below does not cover: a badge in here would repeat the
                team the reader can already see on the card, while a flag is
                part of how a driver's name is written throughout the app, and
                a name that loses it on opening reads as a different component.
              */}
              <span className="flex min-w-0 items-center gap-1.5 font-semibold">
                {driver === undefined ? null : (
                  <Flag country={driver.nationality} title={driver.nationality} />
                )}
                <span className="truncate">{driverName(entrant.driverId)}</span>
                {pageOf === null ? null : (
                  <PageLink
                    link={pageOf.driver(entrant.driverId)}
                    label={`${driverName(entrant.driverId)}'s page`}
                  />
                )}
              </span>
              <span className="text-muted-foreground shrink-0 text-xs">
                {age === null ? "" : `${age} years old`}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {DRIVER_RATINGS.map((rating) => (
                <Rating
                  key={rating.key}
                  label={rating.label}
                  value={entrant.driver[rating.key]}
                  muted={rating.key === "adaptability"}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>
      ) : (
        <button
          type="button"
          aria-pressed={selected}
          onClick={() => {
            edit.onSelect({ kind: "driver", driverId: entrant.driverId });
          }}
          className={cn(NAME_TARGET, "flex min-w-0 flex-1 items-center gap-1.5")}
        >
          <DriverLabel
            driverId={entrant.driverId}
            seasonYear={seasonYear}
            ratingMode={ratingMode}
          />
        </button>
      )}
      {keptMark === null ? null : <span className="text-subtle shrink-0 text-xs">{keptMark}</span>}
      <Overall value={driverOverall(entrant.driver)} />
    </li>
  );
}

/**
 * The label of each control row under a card's header — Engine, Chassis — at
 * one width, so the controls beside them start in one line.
 */
const ROW_LABEL = "text-muted-foreground w-12 shrink-0";

/**
 * The supplier picker, on every team card while the editor is open.
 *
 * A native `select` rather than a styled listbox: the choice is a plain one-of-N
 * from a short list, the platform control is keyboard- and screen-reader-correct
 * for free, and it is the only control in the editor whose rendered state —
 * which option carries `selected` — a DOM-less test can read back.
 */
function EnginePicker({
  teamId,
  engineId,
  edit,
}: {
  teamId: string;
  engineId: string | undefined;
  edit: GridEditing;
}) {
  return (
    <label className="mt-2 flex items-center gap-2 text-xs">
      <span className={ROW_LABEL}>Engine</span>
      <select
        value={engineId ?? ""}
        onChange={(event) => {
          edit.onEngineChange(teamId, event.target.value);
        }}
        className="border-border bg-background focus-visible:ring-ring min-w-0 flex-1 cursor-pointer rounded border px-1.5 py-1 text-xs focus-visible:ring-2 focus-visible:outline-none"
      >
        {edit.engineIds.map((id) => (
          <option key={id} value={id}>
            {engineName(id)}
          </option>
        ))}
      </select>
    </label>
  );
}

interface TeamEntry {
  readonly teamId: string;
  readonly chassis: RaceEntrant["chassis"];
  /** The unit in the back of it, as the field was built. */
  readonly engine: EngineSpec | undefined;
  readonly engineId: string | undefined;
  /** Which way the team's year ran, for the teams that were authored one. */
  readonly developmentTrend: number | undefined;
  readonly drivers: readonly RaceEntrant[];
}

/**
 * Regroups the flat field into teams, in the order the reader asked for.
 *
 * Alphabetical by default, and on purpose: ordering by car pace gives away the
 * pecking order before a wheel has turned, which is not something the opening
 * page should do unasked. Sorted on the *team* name rather than the entry name,
 * so a team does not move down the page because it changed engine supplier.
 *
 * By rating it is the same overall the card shows — `carOverall`, engine
 * included — so the list agrees with the numbers down its right-hand edge.
 *
 * The chassis and the engine come off the first entrant of each team, which is
 * where this whole page gets them: it reads the field it is handed and never the
 * seed files, so it can be shown a draft grid the world has never run.
 */
export function byTeam(
  field: readonly RaceEntrant[],
  order: SortOrder = DEFAULT_SORT_ORDER,
  // Alphabetical order is over the names the cards show *that season* — the
  // lineage sorted under T as Toleman and sorts under A as Alpine, unless the
  // run keeps each team's first name.
  nameOf: (teamId: string) => string = teamName,
): readonly TeamEntry[] {
  const grouped = new Map<string, TeamEntry & { drivers: RaceEntrant[] }>();
  for (const entrant of field) {
    const existing = grouped.get(entrant.teamId);
    if (existing === undefined) {
      grouped.set(entrant.teamId, {
        teamId: entrant.teamId,
        chassis: entrant.chassis,
        engine: entrant.engine,
        engineId: entrant.engineId,
        developmentTrend: entrant.developmentTrend,
        drivers: [entrant],
      });
    } else {
      existing.drivers.push(entrant);
    }
  }
  return sortBy(
    [...grouped.values()],
    order,
    (entry) => nameOf(entry.teamId),
    (entry) => carOverall(entry.chassis, entry.engine),
    (entry) => carRacing(entry.chassis, entry.engine),
  );
}

/**
 * A team's cars in the order the card lists them: best driver first, then
 * alphabetically.
 *
 * The pairing is the point — a card that lists its drivers in seed order asks
 * the reader to compare two numbers to work out which of them is the team's
 * first driver, and that is the one comparison a grid card exists to make. It
 * is `sortBy`'s "overall" order, so it reads the same way as the team list
 * around it, ties included: two drivers on the same overall are separated by
 * racing, and the name is the stable last word, so nobody trades places between
 * renders.
 *
 * **The seat index travels with the entrant**, which is the whole reason this
 * returns pairs rather than a reordered list. A seat's index is its identity to
 * the editor — `SeatRef` is a team plus a seat number, and it is what an empty
 * seat is selected and filled by — so it has to keep meaning the seat the
 * season entered, not the row this ordering happened to put it in. Sorting the
 * drivers in place would silently repoint every swap.
 *
 * An empty seat carries all-zero ratings, so it falls to the bottom without a
 * case of its own — which is also where a car nobody is in belongs.
 */
function seatsInOrder(
  drivers: readonly RaceEntrant[],
): readonly { entrant: RaceEntrant; seat: number }[] {
  return sortBy(
    drivers.map((entrant, seat) => ({ entrant, seat })),
    "overall",
    ({ entrant }) => driverName(entrant.driverId),
    ({ entrant }) => driverOverall(entrant.driver),
    ({ entrant }) => entrant.driver.racing,
  );
}

export function SeasonGrid({
  field,
  seasonYear,
  ratingMode,
  changes,
  engineChanges,
  chassisChanges,
  historicalChassis = null,
  historicalEngines = null,
  arrangement = null,
  kept = null,
  openSeats = 0,
  action,
  edit,
  onClearEdits,
  sort = DEFAULT_SORT_ORDER,
  onSortChange,
}: {
  field: readonly RaceEntrant[];
  seasonYear: number;
  /**
   * Which ratings the field was built from. Only the ages read it: the numbers
   * arrive already resolved on the entrants, but a driver's age does not, and
   * the age has to describe the same season the ratings do.
   */
  ratingMode: RatingMode;
  /** Differences from the authored grid, if any. Drives the note and the marks. */
  changes?: readonly SeatChange[];
  /** Teams running an engine the season did not give them. */
  engineChanges?: readonly EngineChange[];
  /** Teams whose chassis the reader re-rated. */
  chassisChanges?: readonly ChassisChange[];
  /**
   * Each team's chassis as history had it, when the run's own differ — *Car
   * performance* rolled them — or null. The team popover then reads history →
   * this run, rating by rating.
   */
  historicalChassis?: SeasonChassis | null;
  /**
   * Each engine as history rated it, when *Engine performance* rolled the
   * run's own (`historicalEngineRatings`), or null. The engine panel then reads
   * history → this run, as the chassis does.
   */
  historicalEngines?: SeasonEngineRatings | null;
  /**
   * The bulk rule the grid was arranged by, or null for one nobody rearranged.
   *
   * Drawn in the same dashed notice the swaps are, above them, because it is the
   * reason the swaps look like that. It renders on its own too: a rule can land
   * on the grid the season was entered with — a shuffle that happens to — and
   * the reader is still owed the word that it was pressed.
   */
  arrangement?: GridArrangement | null;
  /**
   * What *Keep the first season's teams* did to this year (`keptNotes`), or null. Its
   * own muted notice, not the edited-grid one: a kept seat is the year's
   * starting point, not a change the reader made.
   */
  kept?: KeptNotes | null;
  /**
   * How many cars nobody is in. Only ever above zero mid-edit — an applied grid
   * has none — and it is what the notice at the top of the grid counts.
   */
  openSeats?: number;
  /** Buttons for the section header — Edit grid, or Apply and Cancel. */
  action?: React.ReactNode;
  /** Present while the reader is rearranging the grid. */
  edit?: GridEditing;
  /**
   * Puts the grid back as the season entered it, from a link in the edited
   * grid's notice. Only while the editor is shut, and only where the grid can
   * still change: absent on a raced grid and on the summary's copy.
   */
  onClearEdits?: () => void;
  /**
   * How the team cards are ordered. Controlled, and held by whoever renders
   * this — so every order the grid can be in renders without a click.
   */
  sort?: SortOrder;
  /** Absent in tests, where nothing is clicked. The switch still renders. */
  onSortChange?: (order: SortOrder) => void;
}) {
  // The year each team's name and flag, and its colours, are read at; the
  // car's shape stays on the season itself.
  const nameYear = useNameYear();
  const liveryYear = useLiveryYear();
  const entries = byTeam(field, sort, (teamId) => teamName(teamId, nameYear(teamId, seasonYear)));
  const pageOf = usePageOf();
  const edited = changes ?? [];
  const resupplied = engineChanges ?? [];
  const rerated = new Map((chassisChanges ?? []).map((change) => [change.teamId, change]));
  // Everyone who is not where the season put them, so the grid shows its own
  // changes rather than making the reader match names against a list.
  const swappedIn = new Set(edited.flatMap((change) => change.in));
  const movedEngine = new Set(resupplied.map((change) => change.teamId));

  return (
    // A `Card`, like every results panel, rather than the bare section this was:
    // the grid is the same kind of thing as a classification — one titled block
    // of the season — and the background texture made the difference obvious,
    // since a transparent panel let the checkerboard run straight through it.
    // The team tiles inside stay `bg-card` on a `bg-card` panel, drawn by their
    // borders and liveries; the qualifying grid already nests exactly that way.
    <Card>
      {/* `flex-row` beats `CardHeader`'s own `flex-col` through `cn`, so the
          sort switch and the Edit/Apply buttons keep their place opposite the
          title instead of stacking under the description. */}
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle>Grid</CardTitle>
          <CardDescription>
            {edit === undefined
              ? `${field.length} cars, ${entries.length} teams. Select any name for its full ratings.`
              : "Pick a driver, then who takes their seat. Pick a team's name to change its engine or make its car faster or slower."}
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SortToggle
            label="Sort teams"
            name="team-sort"
            order={sort}
            {...(onSortChange === undefined ? {} : { onChange: onSortChange })}
          />
          {action === undefined ? null : <div className="flex flex-wrap gap-2">{action}</div>}
        </div>
      </CardHeader>

      <div className="flex flex-col gap-4 px-5 py-4">
        {openSeats === 0 ? null : (
          // Above the change list rather than beside the Apply button, because
          // it is an instruction about the cards below it: the seats to fill
          // are marked on the grid, and this says how many are left.
          <div className="border-primary/50 bg-primary/5 flex flex-wrap items-baseline gap-x-2 rounded-lg border border-dashed px-3 py-2">
            <span className="text-xs font-semibold tracking-tight">
              {openSeats === 1 ? "1 empty seat" : `${openSeats} empty seats`}
            </span>
            <span className="text-muted-foreground text-xs">
              Fill {openSeats === 1 ? "it" : "them"} before you apply the grid: pick the seat, then
              a driver.
            </span>
          </div>
        )}
        {kept === null ? null : (
          <KeptNote
            notes={kept}
            seasonYear={seasonYear}
            nameOf={(teamId) => teamName(teamId, nameYear(teamId, seasonYear))}
          />
        )}
        {edited.length === 0 &&
        resupplied.length === 0 &&
        rerated.size === 0 &&
        arrangement === null ? null : (
          <div className="border-border bg-muted/40 flex flex-col gap-2 rounded-lg border border-dashed px-3 py-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="text-xs font-semibold tracking-tight">
                {edit === undefined ? "This grid was edited" : "Changes so far"}
              </span>
              {edit === undefined && onClearEdits !== undefined ? (
                <button
                  type="button"
                  onClick={onClearEdits}
                  // A fill under the cursor, never an underline: the grid's one
                  // affordance for "this does something" (`NAME_TARGET`).
                  className="text-primary hover:bg-accent focus-visible:ring-ring -my-0.5 cursor-pointer rounded px-1.5 py-0.5 text-xs font-medium focus-visible:ring-2 focus-visible:outline-none"
                >
                  Clear all edits
                </button>
              ) : null}
            </div>
            {arrangement === null ? null : (
              <ArrangementNote arrangement={arrangement} ratingMode={ratingMode} />
            )}
            <GridChanges
              changes={edited}
              engineChanges={resupplied}
              chassisChanges={[...rerated.values()]}
            />
          </div>
        )}

        <ul
          className={cn(
            "grid gap-3 sm:grid-cols-2",
            // Three across normally, two while the reserve list holds the third
            // column, so the cards are not squeezed by a sidebar beside them.
            edit === undefined && "lg:grid-cols-3",
          )}
        >
          {entries.map((entry) => {
            const name = entryName(
              entry.teamId,
              entry.engineId,
              nameYear(entry.teamId, seasonYear),
            );
            const base = teamCountry(entry.teamId, nameYear(entry.teamId, seasonYear));
            const livery = liveryFor(entry.teamId, liveryYear(entry.teamId, seasonYear));
            const chassisChange = rerated.get(entry.teamId);
            const historical = historicalChassis?.[entry.teamId];
            const historicalEngine =
              entry.engineId === undefined ? undefined : historicalEngines?.[entry.engineId];
            const ghostCar = kept?.ghosts[entry.teamId];
            const marked = movedEngine.has(entry.teamId) || chassisChange !== undefined;
            return (
              <li
                key={entry.teamId}
                // Clipped, so the header band and the corner sash take the card's
                // rounded corners.
                className="border-border bg-card overflow-hidden rounded-xl border p-4"
              >
                {/*
                  The header band, run out to the card's edges. The sash is its
                  first child, so it paints over the band and under the
                  name and the chip, which are relative to sit above it.
                */}
                <div className="bg-card-header border-border/60 relative -mx-4 -mt-4 flex items-center gap-2 border-b px-4 pt-3 pb-2.5">
                  {livery === undefined ? null : <LiveryCorner livery={livery} />}
                  {/*
                    A marked team (engine or chassis changed) carries the soft
                    fill a moved driver's row does, so the note at the top and the
                    cards agree. On the header band that fill would be lost, so the
                    name sits on a card-coloured plate and the fill goes on it:
                    exactly a moved row's colour.
                  */}
                  <span
                    className={cn("relative flex min-w-0 flex-1", marked && "bg-card rounded px-1")}
                  >
                    <Popover>
                      <NameTrigger
                        className={cn(
                          "flex min-w-0 flex-1 items-center gap-1.5 text-sm font-semibold",
                          marked && SWAPPED_IN,
                        )}
                      >
                        {base === undefined ? null : <Flag country={base} title={base} />}
                        {livery === undefined ? null : (
                          // Sized down from the 1.5em the badge takes elsewhere:
                          // there it is a mark for a whole row, here it sits in a
                          // line of text beside a 0.75rem flag, and at its usual
                          // size it would read as the card's subject rather than
                          // the team's colours.
                          <LiveryBadge livery={livery} className="size-3.5" />
                        )}
                        <span className="truncate">{name}</span>
                      </NameTrigger>
                      {/* A little wider than a driver's panel: its header carries the car beside the name. */}
                      {/* Wider again in the editor, where each chassis row carries a stepper. */}
                      <PopoverContent className={edit === undefined ? "w-80" : "w-96"}>
                        <div className="mb-3 flex items-center justify-between gap-2">
                          {/*
                          Flag, badge, name — the card header this opened out
                          of, read back in the same order, for the reason the
                          driver panel repeats a driver's flag: a name written
                          one way everywhere else reads as a different
                          component when it loses its marks on opening. It is
                          the documented exception to "nothing that only
                          appears after a click wears a badge".
                        */}
                          <span className="flex min-w-0 items-center gap-1.5 font-semibold">
                            {base === undefined ? null : <Flag country={base} title={base} />}
                            {livery === undefined ? null : (
                              <LiveryBadge livery={livery} className="size-3.5" />
                            )}
                            <span className="truncate">{name}</span>
                            {/* Not while editing: the editor's popover is for re-rating, not for leaving. */}
                            {pageOf === null || edit !== undefined ? null : (
                              <PageLink link={pageOf.team(entry.teamId)} label={`${name}'s page`} />
                            )}
                          </span>
                          {livery === undefined ? null : (
                            <LiveryCar livery={livery} year={seasonYear} />
                          )}
                        </div>
                        {ghostCar === undefined ? null : (
                          <p className="text-muted-foreground mb-2 text-xs">
                            Gone by {seasonYear} in real life, so it races on with its {ghostCar}{" "}
                            car.
                          </p>
                        )}
                        {historical === undefined ? null : (
                          <p className="text-subtle mb-2 text-right text-xs">Real → this run</p>
                        )}
                        <div className="flex flex-col gap-2">
                          {CHASSIS_RATINGS.map((rating) => (
                            <Rating
                              key={rating.key}
                              label={rating.label}
                              value={entry.chassis[rating.key]}
                              {...(historical === undefined ? {} : { was: historical[rating.key] })}
                              {...(edit === undefined
                                ? {}
                                : {
                                    control: (
                                      <ChassisStepper
                                        teamName={name}
                                        chassis={entry.chassis}
                                        delta={
                                          chassisChange === undefined
                                            ? 0
                                            : chassisChange.to[rating.key] -
                                              chassisChange.from[rating.key]
                                        }
                                        rating={rating}
                                        onStep={(step) => {
                                          edit.onChassisStep(entry.teamId, step, rating.key);
                                        }}
                                      />
                                    ),
                                  })}
                            />
                          ))}
                        </div>
                        {entry.engine === undefined || entry.engineId === undefined ? null : (
                          // The chassis above and the engine below it, separately,
                          // because the headline number is already the two blended
                          // and a reader who opens this wants the parts.
                          <>
                            <div className="border-border/60 mt-3 mb-2 flex items-baseline justify-between gap-2 border-t pt-3">
                              <span className="text-xs font-semibold">
                                {engineName(entry.engineId)} engine
                              </span>
                              <span className="text-muted-foreground text-xs">
                                {historicalEngine === undefined
                                  ? `${seasonYear} spec`
                                  : "Real → this run"}
                              </span>
                            </div>
                            <div className="flex flex-col gap-2">
                              {ENGINE_RATINGS.map((rating) => (
                                <Rating
                                  key={rating.key}
                                  label={rating.label}
                                  value={entry.engine?.[rating.key] ?? 0}
                                  {...(historicalEngine === undefined
                                    ? {}
                                    : { was: historicalEngine[rating.key] })}
                                />
                              ))}
                            </div>
                          </>
                        )}
                        {entry.developmentTrend === undefined ||
                        entry.developmentTrend === 0 ? null : (
                          // Last, and separated, because it is the only thing in
                          // here that is not a rating: the chassis and the engine
                          // say what the car *is*, and this says how its year
                          // went. It is not in the headline number above — see
                          // `Development`.
                          <>
                            <div className="border-border/60 mt-3 mb-2 flex items-baseline justify-between gap-2 border-t pt-3">
                              <span className="text-xs font-semibold">In-season development</span>
                              <span className="text-muted-foreground text-xs">not in overall</span>
                            </div>
                            <Development trend={entry.developmentTrend} />
                            <p className="text-muted-foreground mt-2 text-xs">
                              {developmentNote(entry.developmentTrend)}
                            </p>
                          </>
                        )}
                      </PopoverContent>
                    </Popover>
                  </span>
                  {/*
                    Over the sash, so on a card-coloured plate: the chip's own
                    fills are tints, and would take on the team's colours. Flex,
                    so the plate is exactly the chip's box: an inline plate takes
                    the line's height and shows a sliver above and below it.
                  */}
                  <span
                    className={cn(
                      "relative flex shrink-0 rounded",
                      livery !== undefined && "bg-card ring-border ring-1",
                    )}
                  >
                    <Overall value={carOverall(entry.chassis, entry.engine)} />
                  </span>
                </div>
                {ghostCar === undefined ? null : (
                  <p className="text-subtle mt-1.5 text-xs">
                    Gone in real life, racing its {ghostCar} car
                  </p>
                )}

                {edit === undefined ? null : (
                  <>
                    <EnginePicker teamId={entry.teamId} engineId={entry.engineId} edit={edit} />
                    {/*
                      Its own row rather than beside the overall: in the
                      editor's two-column cards a stepper in the header took
                      its width out of the team name.
                    */}
                    <div className="mt-1.5 flex items-center gap-2 text-xs">
                      <span className={ROW_LABEL}>Chassis</span>
                      <ChassisStepper
                        teamName={name}
                        chassis={entry.chassis}
                        onStep={(step) => {
                          edit.onChassisStep(entry.teamId, step);
                        }}
                      />
                      {chassisChange === undefined ? null : (
                        <span className="text-muted-foreground min-w-0">
                          {chassisSummary(chassisChange)}
                        </span>
                      )}
                    </div>
                  </>
                )}

                <ul className="mt-2.5 flex flex-col gap-1.5">
                  {/*
                    Keyed by seat rather than by driver: a team can have two
                    open seats, and two rows keyed on the same sentinel would
                    collapse into one. The seat is a real identity rather than a
                    position in this list — `seatsInOrder` reorders the rows and
                    carries each seat number with its entrant — so a swap that
                    moves a driver up the card moves the row, not the key.
                  */}
                  {seatsInOrder(entry.drivers).map(({ entrant, seat }) =>
                    entrant.driverId === EMPTY_SEAT ? (
                      edit === undefined ? null : (
                        <EmptySeat
                          key={`seat-${seat}`}
                          teamId={entry.teamId}
                          seat={seat}
                          edit={edit}
                        />
                      )
                    ) : (
                      <DriverEntry
                        key={`seat-${seat}`}
                        entrant={entrant}
                        seasonYear={seasonYear}
                        ratingMode={ratingMode}
                        swappedIn={swappedIn.has(entrant.driverId)}
                        keptMark={
                          kept?.carried.has(entrant.driverId)
                            ? "kept"
                            : kept?.signed.has(entrant.driverId)
                              ? "signed"
                              : null
                        }
                        {...(edit === undefined ? {} : { edit })}
                      />
                    ),
                  )}
                </ul>
              </li>
            );
          })}
        </ul>
      </div>
    </Card>
  );
}
