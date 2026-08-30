import {
  applyDraft,
  applyEngines,
  authoredEngines,
  authoredLineup,
  availableEngines,
  buildField,
  carryOverLineup,
  type Driver,
  driverRatingsFor,
  emptySeats,
  engineChanges,
  exchangePicks,
  filledLineup,
  type GridPick,
  isAuthoredEngines,
  isAuthoredLineup,
  type LineupDraft,
  lineupChanges,
  type RatingMode,
  reserveDrivers,
  type SeasonEngines,
  type SeasonLineup,
  type SeasonSeed,
  seatRefOf,
} from "@alt-hist/data";
import type { RaceEntrant } from "@alt-hist/engine";
import { useMemo, useState } from "react";
import {
  hasStoredDriverFilters,
  readDriverFilters,
  rememberDriverFilters,
} from "../lib/filter-preference.js";
import {
  AGE_RANGE,
  type DriverFilters,
  defaultDriverFilters,
  filterDrivers,
  withAge,
} from "../lib/people.js";
import { driverOverall } from "../lib/rating.js";
import { adjacentSeason, isPlayable, seasonSeed } from "../lib/seasons.js";
import { DEFAULT_SORT_ORDER, type SortOrder, sortBy } from "../lib/sort.js";
import { useSortOrder } from "../lib/sort-preference.js";
import { cn } from "../lib/utils.js";
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
 * Two things can be changed, and they are kept as two drafts because they are
 * two questions: **who drives the car** and **what is in the back of it**. They
 * apply together, as one edit, so a reader who did both gets one season rather
 * than two.
 *
 * The constraint the driver half is built around is that **only swaps exist**.
 * A team fields the number of cars it entered, so taking a seat always means
 * giving one up, and the field stays the size the starting limit was set
 * against. `swapDrivers` in `@alt-hist/data` enforces it; nothing here can
 * express an addition. Engines have the mirror constraint for free: a car has
 * exactly one, so fitting a new one always removes the old one.
 */

/**
 * One filter the pool can be narrowed by.
 *
 * A native checkbox rather than a styled control, for the reason the engine
 * picker is a native `select`: the platform one is keyboard- and
 * screen-reader-correct for free, and a DOM-less test can read `checked=""`
 * back out of the markup.
 */
function FilterToggle({
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
      <FilterToggle
        label={`Retired before ${seasonYear}`}
        checked={filters.hideRetired}
        onChange={(hideRetired) => {
          onChange({ ...filters, hideRetired });
        }}
      />
      <FilterToggle
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
): readonly RaceEntrant[] {
  const built = buildField(applyDraft(season, draft), undefined, ratingMode);
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
          driver: { racing: 0, qualifying: 0, consistency: 0, adaptability: 0, composure: 0 },
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

/** Both halves of an edit, applied together because they are one question. */
export interface GridEdit {
  readonly lineup: SeasonLineup | null;
  readonly engines: SeasonEngines | null;
}

export function GridStage({
  field,
  year,
  ratingMode,
  lineup,
  engines,
  previousLineup = null,
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
  /**
   * The previous season's grid **as it was actually raced**, for the carry-over
   * button — or null for the one that year was entered with.
   *
   * Inside an era the reader may have rewritten last year, and the grid they
   * watched is what "last season" means to them. A standalone season has no
   * year behind it, so it passes nothing and the button copies history.
   */
  previousLineup?: SeasonLineup | null;
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
  const season = seasonSeed(year);
  const applied = useMemo(() => lineup ?? authoredLineup(season), [lineup, season]);
  const appliedEngines = useMemo(() => engines ?? authoredEngines(season), [engines, season]);
  const engineIds = useMemo(
    () => availableEngines(season).map((engine) => engine.engineId),
    [season],
  );

  // Null means "not editing": one flag fewer than a draft plus a boolean, and
  // it cannot get into the state where the editor is open with nothing to edit.
  // The two drafts open and close together, so one null answers for both.
  const [draft, setDraft] = useState<LineupDraft | null>(null);
  const [engineDraft, setEngineDraft] = useState<SeasonEngines | null>(null);
  const [selected, setSelected] = useState<GridPick | null>(null);
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

  /** Narrows the pool, and remembers it against the mode it was set in. */
  const narrow = (next: DriverFilters): void => {
    setFilters(next);
    rememberDriverFilters(next);
  };
  // How every list on the app is ordered — one shared, session-remembered
  // choice, not one per switch. Both switches stay on screen, because they are
  // still where a reader reaches for the order; what changed is that they are
  // two views of one preference. See `lib/sort-preference.ts`.
  const [sort, setSort] = useSortOrder();

  const shown = draft ?? applied;
  const shownEngines = engineDraft ?? appliedEngines;
  const changes = useMemo(() => lineupChanges(season, shown), [season, shown]);
  const supplyChanges = useMemo(() => engineChanges(season, shownEngines), [season, shownEngines]);
  const untouched = useMemo(
    () =>
      (draft === null || isAuthoredLineup(season, draft)) &&
      (engineDraft === null || isAuthoredEngines(season, engineDraft)),
    [draft, engineDraft, season],
  );

  // Draft grids are rebuilt rather than raced: the ratings are the same
  // function of driver, engine, season and mode that `createWorld` will apply,
  // so what is on screen is what the season will be run on.
  const preview = useMemo(() => {
    if (draft === null && engineDraft === null) {
      return field;
    }
    const entered = engineDraft === null ? season : applyEngines(season, engineDraft);
    return previewField(entered, draft ?? applied, ratingMode);
  }, [draft, engineDraft, field, season, applied, ratingMode]);
  const reserve = useMemo(() => reserveDrivers(shown), [shown]);
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
    setSelected(null);
    onEditingChange?.(true);
  };

  const stopEditing = (): void => {
    setDraft(null);
    setEngineDraft(null);
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
    setDraft(carryOverLineup(season, previous, draft, { previousLineup, mode: ratingMode }));
    setSelected(null);
  };

  const chooseEngine = (teamId: string, engineId: string): void => {
    setEngineDraft((current) => (current === null ? current : { ...current, [teamId]: engineId }));
  };

  const editing: GridEditing | undefined =
    draft === null
      ? undefined
      : {
          selected,
          onSelect: select,
          engineIds,
          onEngineChange: chooseEngine,
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
              lineup: isAuthoredLineup(season, filled) ? null : filled,
              engines:
                engineDraft === null || isAuthoredEngines(season, engineDraft) ? null : engineDraft,
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
            setDraft(authoredLineup(season));
            setEngineDraft(authoredEngines(season));
            setSelected(null);
          }}
        >
          Restore {year} grid
        </Button>
        <Button variant="ghost" onClick={stopEditing}>
          Cancel
        </Button>
      </>
    );

  return (
    <div
      className={cn(
        "grid gap-4",
        draft === null ? "" : "lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start",
      )}
    >
      <SeasonGrid
        field={preview}
        seasonYear={year}
        changes={changes}
        engineChanges={supplyChanges}
        openSeats={open.length}
        action={action}
        ratingMode={ratingMode}
        sort={sort}
        onSortChange={setSort}
        {...(editing === undefined ? {} : { edit: editing })}
      />
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
