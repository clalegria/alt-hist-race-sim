import {
  applyEngines,
  applyLineup,
  authoredEngines,
  authoredLineup,
  availableEngines,
  buildField,
  type Driver,
  driverRatingsFor,
  engineChanges,
  isAuthoredEngines,
  isAuthoredLineup,
  lineupChanges,
  type RatingMode,
  reserveDrivers,
  type SeasonEngines,
  type SeasonLineup,
  seatOf,
  swapDrivers,
} from "@alt-hist/data";
import type { RaceEntrant } from "@alt-hist/engine";
import { useMemo, useState } from "react";
import {
  AGE_RANGE,
  DEFAULT_DRIVER_FILTERS,
  type DriverFilters,
  filterDrivers,
  withAge,
} from "../lib/people.js";
import { driverOverall } from "../lib/rating.js";
import { seasonSeed } from "../lib/seasons.js";
import { DEFAULT_SORT_ORDER, type SortOrder, sortBy } from "../lib/sort.js";
import { cn } from "../lib/utils.js";
import { DriverLabel, type GridEditing, Overall, SeasonGrid } from "./SeasonGrid.js";
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
  filters,
  onChange,
}: {
  seasonYear: number;
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
        <span>Aged</span>
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
    () => filterDrivers(drivers, seasonYear, filters, keep),
    [drivers, seasonYear, filters, keep],
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
    <section className="border-border bg-card flex flex-col gap-2 rounded-xl border p-4">
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
                className="focus-visible:ring-ring flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded text-left focus-visible:ring-2 focus-visible:outline-none"
              >
                <DriverLabel driverId={driver.id} seasonYear={seasonYear} />
              </button>
              <Overall value={driverOverall(driverRatingsFor(driver, seasonYear, ratingMode))} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * What selecting a driver does, given who is already picked up.
 *
 * Pure, and exported, because it is the whole of the editing interaction and
 * the only part of it a DOM-less test can reach. Four cases:
 *
 * - nothing held: pick this driver up;
 * - the same driver again: put them down, unchanged;
 * - two drivers with no seat between them: no swap exists, so the second
 *   simply becomes the selection rather than doing nothing visible;
 * - otherwise: swap them, and start again with nothing held.
 */
export function pickUp(
  lineup: SeasonLineup,
  selected: string | null,
  driverId: string,
): { readonly lineup: SeasonLineup; readonly selected: string | null } {
  if (selected === driverId) {
    return { lineup, selected: null };
  }
  if (selected === null) {
    return { lineup, selected: driverId };
  }
  if (seatOf(lineup, selected) === null && seatOf(lineup, driverId) === null) {
    return { lineup, selected: driverId };
  }
  return { lineup: swapDrivers(lineup, selected, driverId), selected: null };
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
  const [draft, setDraft] = useState<SeasonLineup | null>(null);
  const [engineDraft, setEngineDraft] = useState<SeasonEngines | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  // How the pool is narrowed. View state like the draft, and deliberately *not*
  // reset when the editor closes: a reader who set it once meant it.
  const [filters, setFilters] = useState<DriverFilters>(DEFAULT_DRIVER_FILTERS);
  // How the two lists are ordered. Two pieces of state rather than one: the
  // grid and the pool are read for different reasons, and a reader hunting a
  // name among the reserves has not asked for the team cards to be reshuffled.
  const [teamSort, setTeamSort] = useState<SortOrder>(DEFAULT_SORT_ORDER);
  const [reserveSort, setReserveSort] = useState<SortOrder>(DEFAULT_SORT_ORDER);

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
    const withDrivers = draft === null ? season : applyLineup(season, draft);
    const entered = engineDraft === null ? withDrivers : applyEngines(withDrivers, engineDraft);
    return buildField(entered, undefined, ratingMode);
  }, [draft, engineDraft, field, season, ratingMode]);
  const reserve = useMemo(() => reserveDrivers(shown), [shown]);

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

  const select = (driverId: string): void => {
    if (draft === null) {
      return;
    }
    const next = pickUp(draft, selected, driverId);
    setDraft(next.lineup);
    setSelected(next.selected);
  };

  const chooseEngine = (teamId: string, engineId: string): void => {
    setEngineDraft((current) => (current === null ? current : { ...current, [teamId]: engineId }));
  };

  const editing: GridEditing | undefined =
    draft === null
      ? undefined
      : {
          selectedDriverId: selected,
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
          onClick={() => {
            onApply?.({
              lineup: isAuthoredLineup(season, draft) ? null : draft,
              engines:
                engineDraft === null || isAuthoredEngines(season, engineDraft) ? null : engineDraft,
            });
            stopEditing();
          }}
        >
          Apply grid
        </Button>
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
        action={action}
        sort={teamSort}
        onSortChange={setTeamSort}
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
            selectedDriverId={selected}
            onSelect={select}
            filters={filters}
            onFiltersChange={setFilters}
            sort={reserveSort}
            onSortChange={setReserveSort}
          />
        </aside>
      )}
    </div>
  );
}
