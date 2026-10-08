import {
  ARRANGEMENT_KINDS,
  type ArrangementKind,
  applyChassis,
  applyDraft,
  applyEngines,
  arrangeLineup,
  authoredChassis,
  authoredEngines,
  authoredLineup,
  availableEngines,
  buildField,
  type ChassisSpec,
  carryOverLineup,
  chassisChanges,
  type Driver,
  driverRatingsFor,
  drivers,
  emptySeats,
  engineChanges,
  exchangePicks,
  filledLineup,
  type GridArrangement,
  type GridPick,
  isAuthoredChassis,
  isAuthoredEngines,
  isAuthoredLineup,
  type LineupDraft,
  lineupChanges,
  type RatingMode,
  reserveDrivers,
  type SeasonChassis,
  type SeasonEngines,
  type SeasonLineup,
  type SeasonSeed,
  seatRefOf,
  stepChassis,
} from "@alt-hist/data";
import { createRng, type RaceEntrant } from "@alt-hist/engine";
import { useMemo, useState } from "react";
import {
  hasStoredDriverFilters,
  readDriverFilters,
  rememberDriverFilters,
} from "../lib/filter-preference.js";
import type { KeptNotes } from "../lib/kept.js";
import {
  AGE_RANGE,
  type DriverFilters,
  defaultDriverFilters,
  filterDrivers,
  withAge,
} from "../lib/people.js";
import { driverOverall } from "../lib/rating.js";
import { adjacentSeason, isPlayable, seasonSeed, seasonWithChassis } from "../lib/seasons.js";
import { randomSeed } from "../lib/seed.js";
import { DEFAULT_SORT_ORDER, type SortOrder, sortBy } from "../lib/sort.js";
import { useSortOrder } from "../lib/sort-preference.js";
import { cn } from "../lib/utils.js";
import { ARRANGEMENT_LABELS } from "./LineupChanges.js";
import {
  DriverLabel,
  EMPTY_SEAT,
  type GridEditing,
  NAME_TARGET,
  Overall,
  SeasonGrid,
} from "./SeasonGrid.js";
import { SortToggle } from "./SortToggle.js";
import { Button } from "./ui/button.js";
import { Input } from "./ui/input.js";

/**
 * The opening grid, and the editor that lets a reader rearrange it.
 *
 * Editing is a *draft*: changes accumulate in component state and change nothing
 * until Apply, which hands the finished grid to the store and re-runs the year.
 * That is deliberate — every applied grid re-simulates a whole season, and a
 * reader mid-way through moving four drivers around has not yet asked a question
 * worth answering.
 *
 * Three things can be changed, and they are kept as three drafts because they
 * are three questions: **who drives the car**, **what is in the back of it**,
 * and **how good the chassis is**. They apply together, as one edit, so a
 * reader who did all three gets one season rather than three.
 *
 * The constraint the driver half is built around is that **only swaps exist**.
 * A team fields the number of cars it entered, so taking a seat always means
 * giving one up, and the field stays the size the starting limit was set
 * against. `swapDrivers` in `@alt-hist/data` enforces it; nothing here can
 * express an addition. Engines have the mirror constraint for free: a car has
 * exactly one, so fitting a new one always removes the old one.
 */

/**
 * One yes-or-no answer in the editor — a filter on the pool, or a setting on the
 * bulk rules.
 *
 * A native checkbox rather than a styled control, for the reason the engine
 * picker is a native `select`: the platform one is keyboard- and
 * screen-reader-correct for free, and a DOM-less test can read `checked=""`
 * back out of the markup.
 */
function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
        className="accent-primary size-3.5 cursor-pointer"
      />
      {label}
    </label>
  );
}

/**
 * What narrows the pool: two career filters and an age range.
 *
 * Both career filters are phrased as what they *hide*, because that is what a
 * checkbox turning on does — "drivers active in 1980" would leave a reader
 * guessing which way the tick points.
 */
function ReserveFilters({
  seasonYear,
  ratingMode,
  filters,
  onChange,
}: {
  seasonYear: number;
  ratingMode: RatingMode;
  filters: DriverFilters;
  onChange: (filters: DriverFilters) => void;
}) {
  return (
    <fieldset className="border-border text-muted-foreground flex flex-col gap-1.5 rounded-lg border p-2 text-xs">
      <legend className="px-1">Hide</legend>
      <Toggle
        label={`Retired before ${seasonYear}`}
        checked={filters.hideRetired}
        onChange={(hideRetired) => {
          onChange({ ...filters, hideRetired });
        }}
      />
      <Toggle
        label={`Debuting after ${seasonYear}`}
        checked={filters.hideFuture}
        onChange={(hideFuture) => {
          onChange({ ...filters, hideFuture });
        }}
      />
      <div className="flex items-center gap-1.5">
        {/*
          Which age is being narrowed, said out loud in peak mode. The numbers
          are read against the age each driver was at their best there, and a
          bare "Aged 18 to 42" beside a 1980 season is read as 1980 ages — which
          is the misreading that makes the list look broken when a driver from
          another decade survives it.
        */}
        <span>{ratingMode === "peak" ? "Peak age" : "Aged"}</span>
        <Input
          type="number"
          aria-label="Youngest age"
          min={AGE_RANGE.min}
          max={AGE_RANGE.max}
          value={filters.minAge}
          onChange={(event) => {
            onChange(withAge(filters, "min", event.target.valueAsNumber));
          }}
          className="h-7 w-14 px-1.5 text-center text-xs"
        />
        <span>to</span>
        <Input
          type="number"
          aria-label="Oldest age"
          min={AGE_RANGE.min}
          max={AGE_RANGE.max}
          value={filters.maxAge}
          onChange={(event) => {
            onChange(withAge(filters, "max", event.target.valueAsNumber));
          }}
          className="h-7 w-14 px-1.5 text-center text-xs"
        />
      </div>
    </fieldset>
  );
}

/**
 * The bulk rules, as a panel of their own above the grid.
 *
 * Its own section rather than three more buttons in the grid's header, because
 * these are a different kind of act: everything else in the editor moves one
 * driver and leaves the rest of the grid alone, and each of these reseats the
 * whole field in one press. Mixing them into the same row as Apply and Cancel
 * would put "throw the field in the air" next to "keep what I did".
 *
 * **Controlled**, like every other part of the editor: which rule is chosen and
 * both settings are held in `GridStage`, so a DOM-less test can render each
 * state without a click. The chosen rule is marked by `aria-pressed` and a solid
 * button, which is also the only part of it a static render can read back.
 *
 * Exported for that reason, the way `ReserveList` is.
 */
export function GridArrangements({
  chosen,
  includeUnemployed,
  retain,
  inEra = false,
  onChoose,
  onIncludeUnemployedChange,
  onRetainChange,
}: {
  /** The rule in force on the draft, or null once the reader has edited a seat. */
  chosen: ArrangementKind | null;
  /** Whether the rules may give a seat to somebody who has none. */
  includeUnemployed: boolean;
  /** Whether every following season of the era is arranged the same way. */
  retain: boolean;
  /**
   * Whether this season is one year of an era, which is the only case where
   * there *is* a next season to keep a rule for. The checkbox is not drawn
   * otherwise — a control that cannot mean anything is worse than no control.
   */
  inEra?: boolean;
  /** Absent in tests, where nothing is clicked. The controls still render. */
  onChoose?: (kind: ArrangementKind) => void;
  onIncludeUnemployedChange?: (include: boolean) => void;
  onRetainChange?: (retain: boolean) => void;
}) {
  return (
    // `ReserveList`'s panel, minus the header: the same border, padding and
    // elevation, because the two are the editor's two side panels and sitting
    // them at different heights would read as one of them being a dialog.
    <section className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4 shadow-sm">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold tracking-tight">Rearrange the whole grid</h3>
        <p className="text-muted-foreground text-xs">
          One press instead of forty swaps. Each of these reseats every car, and the grid says which
          one is in force until you move a driver by hand — an edit of your own is the end of the
          rule.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {ARRANGEMENT_KINDS.map((kind) => (
          <Button
            key={kind}
            variant={kind === chosen ? "primary" : "outline"}
            aria-pressed={kind === chosen}
            onClick={() => {
              onChoose?.(kind);
            }}
          >
            {ARRANGEMENT_LABELS[kind]}
          </Button>
        ))}
      </div>
      <div className="text-muted-foreground flex flex-col gap-1.5 text-xs">
        <Toggle
          label="Include unemployed drivers"
          checked={includeUnemployed}
          onChange={onIncludeUnemployedChange ?? (() => {})}
        />
        {inEra ? (
          <Toggle
            label="Keep this for every season of the era"
            checked={retain}
            onChange={onRetainChange ?? (() => {})}
          />
        ) : null}
      </div>
    </section>
  );
}

/**
 * The drivers with no seat, as a pick-list beside the grid.
 *
 * Exported so it can be rendered on its own: `GridStage` keeps the draft in
 * component state, which a DOM-less test cannot open. The filters are
 * **controlled** for the same reason — held above, passed in, so every state
 * the list can be narrowed to renders without a click.
 *
 * `drivers` is the whole pool without a seat; what is drawn is that list
 * filtered. Both counts are on screen, because "3 in the pool" with nothing
 * saying the other twenty are hidden is how a reader concludes the app has lost
 * half its drivers.
 *
 * The filters apply to *everyone* in the pool, including a driver the season
 * entered who has just been swapped out of the grid — losing a seat puts them
 * in the pool on the same terms as anyone else, and a list that quietly exempts
 * some of its rows is a list whose counts lie. Getting them back is the same
 * move as reaching anyone else the filters hide: widen the filters.
 */
export function ReserveList({
  drivers,
  seasonYear,
  ratingMode,
  selectedDriverId,
  onSelect,
  filters,
  onFiltersChange,
  sort = DEFAULT_SORT_ORDER,
  onSortChange,
}: {
  drivers: readonly Driver[];
  seasonYear: number;
  ratingMode: RatingMode;
  selectedDriverId: string | null;
  onSelect: (driverId: string) => void;
  filters: DriverFilters;
  /** Absent in tests, where nothing is clicked. The controls still render. */
  onFiltersChange?: (filters: DriverFilters) => void;
  /** How the pool is ordered. Controlled, beside the filters, for the same reason. */
  sort?: SortOrder;
  onSortChange?: (order: SortOrder) => void;
}) {
  // The one exemption: whoever is held. A selection the filters hide is a
  // selection the reader cannot put down, and it would be highlighted on a row
  // that is not on screen.
  const keep = useMemo(
    () => (selectedDriverId === null ? new Set<string>() : new Set([selectedDriverId])),
    [selectedDriverId],
  );
  // Filtered, then ordered — the counts below describe the filtering, and the
  // order is only how what survived is laid out.
  const shown = useMemo(
    () => filterDrivers(drivers, seasonYear, filters, keep, ratingMode),
    [drivers, seasonYear, filters, keep, ratingMode],
  );
  const listed = useMemo(
    () =>
      sortBy(
        shown,
        sort,
        (driver) => driver.name,
        (driver) => driverOverall(driverRatingsFor(driver, seasonYear, ratingMode)),
        (driver) => driverRatingsFor(driver, seasonYear, ratingMode).racing,
      ),
    [shown, sort, seasonYear, ratingMode],
  );

  return (
    // Card's own classes minus the header, since this panel's heading is a
    // smaller one inside it: `shadow-sm` included, so it sits at the same
    // elevation as the grid it stands beside.
    <section className="border-border bg-card flex flex-col gap-2 rounded-xl border p-4 shadow-sm">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold tracking-tight">Without a drive</h3>
          <SortToggle
            label="Sort drivers without a drive"
            name="reserve-sort"
            order={sort}
            {...(onSortChange === undefined ? {} : { onChange: onSortChange })}
          />
        </div>
        <p className="text-muted-foreground text-xs">
          {shown.length === drivers.length
            ? `${drivers.length} in the pool.`
            : `${shown.length} of ${drivers.length} in the pool.`}{" "}
          Select one to put them in the selected seat.
        </p>
      </div>
      <ReserveFilters
        seasonYear={seasonYear}
        ratingMode={ratingMode}
        filters={filters}
        onChange={onFiltersChange ?? (() => {})}
      />
      {shown.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          Nobody in the pool matches. Widen the filters above.
        </p>
      ) : null}
      <ul className="flex flex-col gap-1">
        {listed.map((driver) => {
          const selected = driver.id === selectedDriverId;
          return (
            <li
              key={driver.id}
              className={cn(
                "flex items-center gap-2 rounded px-1 py-0.5 text-sm",
                selected && "ring-primary ring-2",
              )}
            >
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  onSelect(driver.id);
                }}
                className={cn(NAME_TARGET, "flex min-w-0 flex-1 items-center gap-1.5")}
              >
                <DriverLabel driverId={driver.id} seasonYear={seasonYear} ratingMode={ratingMode} />
              </button>
              <Overall value={driverOverall(driverRatingsFor(driver, seasonYear, ratingMode))} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Whether two picks name the same thing. */
function samePick(a: GridPick, b: GridPick): boolean {
  if (a.kind === "driver" && b.kind === "driver") {
    return a.driverId === b.driverId;
  }
  if (a.kind === "seat" && b.kind === "seat") {
    return a.teamId === b.teamId && a.seat === b.seat;
  }
  return false;
}

/** Whether a pick has a seat to write back to — a reserve driver does not. */
function holdsASeat(lineup: LineupDraft, pick: GridPick): boolean {
  return pick.kind === "seat" || seatRefOf(lineup, pick.driverId) !== null;
}

/**
 * What selecting a driver — or an open seat — does, given what is already
 * picked up.
 *
 * Pure, and exported, because it is the whole of the editing interaction and
 * the only part of it a DOM-less test can reach. Four cases:
 *
 * - nothing held: pick this up;
 * - the same thing again: put it down, unchanged;
 * - two picks with no seat between them — two drivers out of the pool — have
 *   nothing to exchange, so the second simply becomes the selection rather than
 *   doing nothing visible;
 * - otherwise: exchange them, and start again with nothing held.
 *
 * The seat cases fall out of the same four. A driver held and an open seat
 * chosen moves them into it, leaving their old car empty if they had one; an
 * open seat held and a name chosen fills it.
 */
export function pickUp(
  lineup: LineupDraft,
  selected: GridPick | null,
  pick: GridPick,
): { readonly lineup: LineupDraft; readonly selected: GridPick | null } {
  if (selected !== null && samePick(selected, pick)) {
    return { lineup, selected: null };
  }
  if (selected === null) {
    return { lineup, selected: pick };
  }
  if (!holdsASeat(lineup, selected) && !holdsASeat(lineup, pick)) {
    return { lineup, selected: pick };
  }
  return { lineup: exchangePicks(lineup, selected, pick), selected: null };
}

/**
 * The draft grid as a field the page can draw, open seats included.
 *
 * `buildField` cannot make an entrant without a driver, and an all-but-empty
 * team would otherwise vanish from the page the reader has to fill it in on. So
 * the season is built without its open seats and they are spliced back in as
 * placeholder entrants — the team's own chassis and engine, nobody driving —
 * which is what lets every layer above this stay a plain function of a field.
 *
 * Nothing simulated can reach one: this field is drawn and thrown away, and the
 * draft behind it cannot be applied while an open seat remains.
 */
export function previewField(
  season: SeasonSeed,
  draft: LineupDraft,
  ratingMode: RatingMode,
  pool: readonly Driver[] = drivers,
): readonly RaceEntrant[] {
  const built = buildField(applyDraft(season, draft), pool, ratingMode);
  const seated = new Map<string, RaceEntrant[]>();
  for (const entrant of built) {
    const already = seated.get(entrant.teamId);
    if (already === undefined) {
      seated.set(entrant.teamId, [entrant]);
    } else {
      already.push(entrant);
    }
  }

  const field: RaceEntrant[] = [];
  for (const entry of season.entries) {
    const taken = seated.get(entry.teamId) ?? [];
    const engine = season.engines.find((spec) => spec.engineId === entry.engineId);
    let next = 0;
    for (const driverId of draft[entry.teamId] ?? entry.drivers) {
      if (driverId === null) {
        field.push({
          driverId: EMPTY_SEAT,
          teamId: entry.teamId,
          driver: {
            racing: 0,
            qualifying: 0,
            consistency: 0,
            adaptability: 0,
            composure: 0,
            wetWeather: 0,
          },
          chassis: entry.chassis,
          engineId: entry.engineId,
          ...(engine === undefined
            ? {}
            : {
                engine: {
                  racing: engine.racing,
                  qualifying: engine.qualifying,
                  reliability: engine.reliability,
                },
              }),
        });
        continue;
      }
      const entrant = taken[next];
      next += 1;
      if (entrant !== undefined) {
        field.push(entrant);
      }
    }
  }
  return field;
}

/** Every part of an edit, applied together because they are one question. */
export interface GridEdit {
  readonly lineup: SeasonLineup | null;
  readonly engines: SeasonEngines | null;
  readonly chassis: SeasonChassis | null;
  /**
   * The bulk rule the lineup came out of, or null for a grid assembled by hand.
   *
   * Beside the lineup rather than instead of it: the lineup is the grid that
   * races, and this is only the record of how it was arrived at — what the grid
   * screen reports afterwards, and what an era re-applies next year.
   */
  readonly arrangement: GridArrangement | null;
}

export function GridStage({
  field,
  year,
  ratingMode,
  lineup,
  engines,
  chassis = null,
  baselineChassis = null,
  runSeason = null,
  kept = null,
  arrangement = null,
  inEra = false,
  previousLineup = null,
  pool = drivers,
  locked = false,
  pendingSeats = null,
  onApply,
  onEditingChange,
}: {
  /** The grid as raced. Replaced by a preview of the draft while editing. */
  field: readonly RaceEntrant[];
  year: number;
  ratingMode: RatingMode;
  /** The applied lineup, or null for the season as it was entered. */
  lineup: SeasonLineup | null;
  /** The applied engine supply, or null for the deals the season was entered with. */
  engines: SeasonEngines | null;
  /** The applied chassis ratings, or null for the chassis the season was entered with. */
  chassis?: SeasonChassis | null;
  /**
   * The run's own chassis for the year (*Car performance*), or null for the
   * authored ones: what the season was entered with, and so what Restore puts
   * back and every change is measured from (`World.baselineChassis`).
   */
  baselineChassis?: SeasonChassis | null;
  /**
   * The season as the run entered it when that is not the seed file with
   * `baselineChassis` in it — under *Keep the starting grid*, the kept year
   * with its signings (`enteredSeason`) — or null. Restore puts it back.
   */
  runSeason?: SeasonSeed | null;
  /** What *Keep the starting grid* did to the year (`keptNotes`), or null. */
  kept?: KeptNotes | null;
  /**
   * The bulk rule the applied grid was arranged by, or null for one nobody
   * rearranged.
   *
   * Read twice: the grid states it while the editor is shut, and re-opening the
   * editor opens on the rule and the settings that are already in force rather
   * than on a blank panel.
   */
  arrangement?: GridArrangement | null;
  /**
   * Whether this season is one year of an era. Only the bulk rules read it — a
   * rule can be kept for the following years, and a standalone season has none.
   */
  inEra?: boolean;
  /**
   * The previous season's grid **as it was actually raced**, for the carry-over
   * button — or null for the one that year was entered with.
   *
   * Inside an era the reader may have rewritten last year, and the grid they
   * watched is what "last season" means to them. A standalone season has no
   * year behind it, so it passes nothing and the button copies history.
   */
  previousLineup?: SeasonLineup | null;
  /**
   * The drivers the run rates (`driverPoolOf`), so the preview, the pool's
   * overalls, the carry-over and the bulk rules all read the ratings the season
   * will race on.
   */
  pool?: readonly Driver[];
  /**
   * A grid that has been raced: drawn as it stood, with no way into the editor.
   * The store would refuse the edit anyway, and a button that does nothing is a
   * control that lies.
   */
  locked?: boolean;
  /**
   * A pending year's seats, empty ones `null` (*I fill them*), or null. The
   * editor opens on them and cannot be shut — there is no season to fall back
   * to until they are filled — Restore puts them back, and Apply always hands
   * over the whole lineup, since it becomes the year's baseline.
   */
  pendingSeats?: LineupDraft | null;
  /** Absent in tests, where nothing is clicked. The controls still render. */
  onApply?: (edit: GridEdit) => void;
  /**
   * Told when the editor opens and closes, so the page can take its "simulate
   * next session" buttons away — stepping on mid-edit would throw the draft
   * away without saying so, and would run a season on the grid the reader was
   * in the middle of replacing.
   */
  onEditingChange?: (editing: boolean) => void;
}) {
  const season = useMemo(
    () => runSeason ?? seasonWithChassis(year, baselineChassis),
    [runSeason, year, baselineChassis],
  );
  // History's chassis, for the popover to set beside the run's own. Only when
  // the run rolled its own: otherwise the two are one and there is nothing to show.
  const historicalChassis = useMemo(
    () => (baselineChassis === null ? null : authoredChassis(seasonSeed(year))),
    [year, baselineChassis],
  );
  const applied = useMemo<LineupDraft>(
    () => pendingSeats ?? lineup ?? authoredLineup(season),
    [pendingSeats, lineup, season],
  );
  const appliedEngines = useMemo(() => engines ?? authoredEngines(season), [engines, season]);
  const appliedChassis = useMemo(() => chassis ?? authoredChassis(season), [chassis, season]);
  const engineIds = useMemo(
    () => availableEngines(season).map((engine) => engine.engineId),
    [season],
  );

  // Null means "not editing": one flag fewer than a draft plus a boolean, and
  // it cannot get into the state where the editor is open with nothing to edit.
  // The three drafts open and close together, so one null answers for all.
  // A pending year's grid opens with the editor already open.
  const [draft, setDraft] = useState<LineupDraft | null>(pendingSeats);
  const [engineDraft, setEngineDraft] = useState<SeasonEngines | null>(() =>
    pendingSeats === null ? null : appliedEngines,
  );
  const [chassisDraft, setChassisDraft] = useState<SeasonChassis | null>(() =>
    pendingSeats === null ? null : appliedChassis,
  );
  const [selected, setSelected] = useState<GridPick | null>(null);
  // Which bulk rule the draft is currently the product of, and the two settings
  // the rules are applied under. Three pieces rather than one `GridArrangement`
  // because the settings outlive the rule: clearing the rule after a hand edit
  // must not also forget that the reader had asked for the pool to be included.
  const [chosen, setChosen] = useState<ArrangementKind | null>(arrangement?.kind ?? null);
  const [includeUnemployed, setIncludeUnemployed] = useState(
    arrangement?.includeUnemployed ?? false,
  );
  const [retain, setRetain] = useState(arrangement?.retain ?? false);
  // How the pool is narrowed. Held here so the panel stays controlled, but the
  // answer is the reader's rather than this component's: `lib/filter-preference`
  // remembers it, because the editor is re-mounted every time a grid is applied
  // and setting the same four things again each visit is what this was.
  const [filters, setFilters] = useState<DriverFilters>(() => readDriverFilters(ratingMode));
  // The mode the filters above were opened for. It decides what the panel
  // *opens* on — the two modes disagree about which career filters make sense —
  // and that is all it decides: a set the reader chose is theirs, and switching
  // to peak ratings to see the same people at their best must not quietly
  // rewrite it. So the defaults are only re-laid while nothing has ever been
  // stored, which is exactly when there is nothing to lose and when a first flip
  // to `peak` should open on the field of all-time greats that mode is for.
  // Adjusting state during render is React's own pattern for this.
  const [filtersMode, setFiltersMode] = useState<RatingMode>(ratingMode);
  if (filtersMode !== ratingMode) {
    setFiltersMode(ratingMode);
    if (!hasStoredDriverFilters()) {
      setFilters(defaultDriverFilters(ratingMode));
    }
  }

  // How every list on the app is ordered — one shared, session-remembered
  // choice, not one per switch. Both switches stay on screen, because they are
  // still where a reader reaches for the order; what changed is that they are
  // two views of one preference. See `lib/sort-preference.ts`.
  const [sort, setSort] = useSortOrder();

  const shown = draft ?? applied;
  const shownEngines = engineDraft ?? appliedEngines;
  const shownChassis = chassisDraft ?? appliedChassis;
  const changes = useMemo(() => lineupChanges(season, shown), [season, shown]);
  const supplyChanges = useMemo(() => engineChanges(season, shownEngines), [season, shownEngines]);
  const rerated = useMemo(() => chassisChanges(season, shownChassis), [season, shownChassis]);
  const untouched = useMemo(
    () =>
      (draft === null ||
        (pendingSeats === null ? isAuthoredLineup(season, draft) : draft === pendingSeats)) &&
      (engineDraft === null || isAuthoredEngines(season, engineDraft)) &&
      (chassisDraft === null || isAuthoredChassis(season, chassisDraft)) &&
      // A rule that happened to land back on the authored grid is still a rule
      // in force, and Restore is the way to put it down — so it counts as a
      // change even when no seat did.
      chosen === null,
    [draft, engineDraft, chassisDraft, season, chosen, pendingSeats],
  );

  /**
   * The season with the drafted cars in it — engines and chassis — which is
   * what both the preview and the bulk rules read: a team handed a better unit
   * or a better tub is a better car, and the grid ranks it as one.
   */
  const entered = useMemo(() => {
    const resupplied = engineDraft === null ? season : applyEngines(season, engineDraft);
    return chassisDraft === null ? resupplied : applyChassis(resupplied, chassisDraft);
  }, [season, engineDraft, chassisDraft]);

  // Draft grids are rebuilt rather than raced: the ratings are the same
  // function of driver, car, season and mode that `createWorld` will apply,
  // so what is on screen is what the season will be run on.
  const preview = useMemo(() => {
    if (draft === null && engineDraft === null && chassisDraft === null) {
      return field;
    }
    return previewField(entered, draft ?? applied, ratingMode, pool);
  }, [draft, engineDraft, chassisDraft, field, entered, applied, ratingMode, pool]);
  // What the grid reports: the rule on the draft while the editor is open, the
  // rule the season was run under once it is shut. One value rather than a
  // branch at the call site, so the notice cannot say two different things.
  const shownArrangement = useMemo<GridArrangement | null>(() => {
    if (draft === null) {
      return arrangement;
    }
    return chosen === null ? null : { kind: chosen, includeUnemployed, filters, retain };
  }, [draft, arrangement, chosen, includeUnemployed, filters, retain]);
  const reserve = useMemo(() => reserveDrivers(shown, pool), [shown, pool]);
  /** The open seats, and therefore whether this grid can be applied at all. */
  const open = useMemo(() => emptySeats(shown), [shown]);

  /**
   * The season to copy from: the playable year before this one, or null at the
   * start of the authored range, where the button is not drawn.
   *
   * The *playable* one rather than `year - 1`, so a gap in the seed data is
   * skipped rather than offering a year `seasonSeed` would throw on.
   */
  const previousYear = useMemo(() => adjacentSeason(year, -1), [year]);
  const previous = useMemo(
    () => (previousYear === null || !isPlayable(previousYear) ? null : seasonSeed(previousYear)),
    [previousYear],
  );

  const startEditing = (): void => {
    setDraft(applied);
    setEngineDraft(appliedEngines);
    setChassisDraft(appliedChassis);
    setSelected(null);
    // Opened on whatever is in force, so a reader coming back to a season
    // arranged by rule sees which rule, and does not have to re-tick the pool.
    setChosen(arrangement?.kind ?? null);
    setIncludeUnemployed(arrangement?.includeUnemployed ?? false);
    setRetain(arrangement?.retain ?? false);
    onEditingChange?.(true);
  };

  const stopEditing = (): void => {
    setDraft(null);
    setEngineDraft(null);
    setChassisDraft(null);
    setSelected(null);
    onEditingChange?.(false);
  };

  const select = (pick: GridPick): void => {
    if (draft === null) {
      return;
    }
    const next = pickUp(draft, selected, pick);
    setDraft(next.lineup);
    setSelected(next.selected);
    // A hand edit ends the rule. Not out of caution: the grid *says* which rule
    // it is arranged by, and one swap later that sentence is no longer true —
    // and inside an era a rule left in force would arrange next year too, off
    // the back of a change the reader made to this one. Only an edit, though:
    // `pickUp` hands back the draft it was given for picking a name up and for
    // putting it down again, and neither has changed the grid.
    if (next.lineup !== draft) {
      setChosen(null);
    }
  };

  /**
   * Last season's drivers, over this one.
   *
   * Over the *draft* rather than the applied grid, so it composes with whatever
   * the reader has already changed rather than throwing it away — and so the
   * button can be pressed twice without meaning something different the second
   * time. Whatever is held is put down first: a selection pointing at a seat
   * the copy has just refilled no longer means anything.
   */
  const copyPreviousGrid = (): void => {
    if (draft === null || previous === null) {
      return;
    }
    setDraft(carryOverLineup(season, previous, draft, { previousLineup, mode: ratingMode, pool }));
    setSelected(null);
    // Last season's drivers are their own arrangement of the grid, and not one
    // of the three rules. Whatever was in force is no longer what is on screen.
    setChosen(null);
  };

  /**
   * One of the bulk rules, over the draft on screen.
   *
   * Over the *draft* rather than the applied grid, for the reason the carry-over
   * button is: it composes with whatever the reader has already changed, and the
   * engines and chassis they have already chosen are what the cars are ranked
   * on — a team handed a better car is a better car, and the rule has to agree
   * with the numbers the grid is printing beside each one.
   *
   * `include` and `narrowedTo` are passed rather than read off the state, because
   * both controls that hold them re-run the rule as they change and the state
   * has not settled by then.
   *
   * The dice are a fresh seed each press, so pressing `Randomize grid` twice
   * gives two grids — the seeded stream is what makes the *season* reproducible,
   * and choosing which stream to draw from is a reader's action like choosing a
   * seed is. The seed the season is eventually run on re-rolls it for the years
   * that follow in an era.
   */
  const rearrange = (kind: ArrangementKind, include: boolean, narrowedTo: DriverFilters): void => {
    if (draft === null) {
      return;
    }
    const rules: GridArrangement = {
      kind,
      includeUnemployed: include,
      filters: narrowedTo,
      retain,
    };
    setDraft(
      arrangeLineup(entered, draft, rules, {
        mode: ratingMode,
        rng: createRng(randomSeed()),
        pool,
      }),
    );
    setChosen(kind);
    setSelected(null);
  };

  /**
   * Widening or narrowing the cast, which re-runs the rule in force.
   *
   * Both of these are settings on the rules rather than edits of the grid, so
   * neither puts the rule down — and both apply at once, because a control that
   * only affected the *next* press would leave the panel saying one thing and
   * the grid showing another. Opening the age range to 45 adds three names to
   * the pool beside the grid, and it has to add them to the grid too.
   */
  const includeThePool = (include: boolean): void => {
    setIncludeUnemployed(include);
    if (chosen !== null) {
      rearrange(chosen, include, filters);
    }
  };

  /**
   * Narrows the pool, remembers it against the mode it was set in, and re-runs
   * whichever rule is in force over the pool it now describes.
   *
   * The filter panel belongs to the list of drivers without a drive, and that
   * list is precisely what "include unemployed drivers" means — so a rule drawn
   * from a pool the reader has just widened has to be drawn again, or the panel
   * and the grid disagree about who was available. Nothing to re-run when the
   * pool is not being drawn on: the filters then narrow a list and no more.
   *
   * It sits here, beside the checkbox, rather than up with the state it sets,
   * because the two are one behaviour — and because `rearrange` has to be
   * declared above whatever calls it.
   */
  const narrow = (next: DriverFilters): void => {
    setFilters(next);
    rememberDriverFilters(next);
    if (chosen !== null && includeUnemployed) {
      rearrange(chosen, includeUnemployed, next);
    }
  };

  const chooseEngine = (teamId: string, engineId: string): void => {
    setEngineDraft((current) => (current === null ? current : { ...current, [teamId]: engineId }));
    // A hand edit like any other, and this one in particular: the rules rank the
    // cars with the engine folded in, so changing a supplier is changing the
    // pecking order the grid on screen was arranged against.
    setChosen(null);
  };

  /**
   * One team's chassis a point better or worse — one rating, or all four.
   *
   * A hand edit like an engine change, and for the same reason: the rules rank
   * the cars on their ratings, so re-rating one changes the pecking order the
   * grid on screen was arranged against. Only an actual change, though — a press
   * at the limit of the scale hands back the draft it was given.
   */
  const stepTeamChassis = (teamId: string, step: 1 | -1, key?: keyof ChassisSpec): void => {
    if (chassisDraft === null) {
      return;
    }
    const next = stepChassis(chassisDraft, teamId, step, key);
    if (next !== chassisDraft) {
      setChassisDraft(next);
      setChosen(null);
    }
  };

  const editing: GridEditing | undefined =
    draft === null
      ? undefined
      : {
          selected,
          onSelect: select,
          engineIds,
          onEngineChange: chooseEngine,
          onChassisStep: stepTeamChassis,
        };

  const action =
    draft === null ? (
      <Button variant="outline" onClick={startEditing}>
        Edit grid
      </Button>
    ) : (
      <>
        <Button
          // A grid with a car nobody is driving is not a grid, so Apply is shut
          // until every seat is filled. Disabled rather than hidden, and said
          // out loud under the header: the reader is one name short of running
          // the season, and a button that quietly vanished would read as the
          // editor breaking.
          disabled={open.length > 0}
          onClick={() => {
            const filled = filledLineup(draft);
            if (filled === null) {
              return;
            }
            onApply?.({
              lineup: pendingSeats === null && isAuthoredLineup(season, filled) ? null : filled,
              engines:
                engineDraft === null || isAuthoredEngines(season, engineDraft) ? null : engineDraft,
              chassis:
                chassisDraft === null || isAuthoredChassis(season, chassisDraft)
                  ? null
                  : chassisDraft,
              arrangement: shownArrangement,
            });
            stopEditing();
          }}
        >
          Apply grid
        </Button>
        {previous === null ? null : (
          <Button variant="outline" onClick={copyPreviousGrid}>
            Copy {previous.year} grid
          </Button>
        )}
        <Button
          variant="outline"
          disabled={untouched}
          onClick={() => {
            setDraft(pendingSeats ?? authoredLineup(season));
            setEngineDraft(authoredEngines(season));
            setChassisDraft(authoredChassis(season));
            setSelected(null);
            // The season's own grid is no rule's output, so the rule goes with
            // the seats. The two settings stay: they are how the reader plays,
            // not part of what was restored.
            setChosen(null);
          }}
        >
          Restore {year} grid
        </Button>
        {pendingSeats === null ? (
          <Button variant="ghost" onClick={stopEditing}>
            Cancel
          </Button>
        ) : null}
      </>
    );

  return (
    <div
      className={cn(
        "grid gap-4",
        draft === null ? "" : "lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start",
      )}
    >
      {/*
        The rules panel and the grid share the left-hand column, so the panel
        sits above the cards it rearranges rather than beside the reserve list —
        which is a pick-list for one seat, and a different job.
      */}
      <div className="flex flex-col gap-4">
        {draft === null ? null : (
          <GridArrangements
            chosen={chosen}
            includeUnemployed={includeUnemployed}
            retain={retain}
            inEra={inEra}
            onChoose={(kind) => {
              rearrange(kind, includeUnemployed, filters);
            }}
            onIncludeUnemployedChange={includeThePool}
            onRetainChange={setRetain}
          />
        )}
        <SeasonGrid
          field={preview}
          seasonYear={year}
          changes={changes}
          engineChanges={supplyChanges}
          chassisChanges={rerated}
          historicalChassis={historicalChassis}
          arrangement={shownArrangement}
          kept={kept}
          openSeats={open.length}
          {...(locked ? {} : { action })}
          ratingMode={ratingMode}
          sort={sort}
          onSortChange={setSort}
          {...(editing === undefined ? {} : { edit: editing })}
        />
      </div>
      {draft === null ? null : (
        // Sticky, because the seat being filled is usually somewhere else on a
        // page fifteen cards long.
        <aside className="lg:sticky lg:top-24">
          <ReserveList
            drivers={reserve}
            seasonYear={year}
            ratingMode={ratingMode}
            selectedDriverId={selected?.kind === "driver" ? selected.driverId : null}
            onSelect={(driverId) => {
              select({ kind: "driver", driverId });
            }}
            filters={filters}
            onFiltersChange={narrow}
            sort={sort}
            onSortChange={setSort}
          />
        </aside>
      )}
    </div>
  );
}
