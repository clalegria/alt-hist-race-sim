import { type Driver, driverRatingsFor, type RatingMode } from "@alt-hist/data";
import { useMemo, useState } from "react";
import {
  hasStoredDriverFilters,
  readDriverFilters,
  rememberDriverFilters,
} from "../lib/filter-preference.js";
import { count } from "../lib/history.js";
import { type DriverFilters, defaultDriverFilters, filterDrivers } from "../lib/people.js";
import { driverOverall } from "../lib/rating.js";
import { DEFAULT_SORT_ORDER, type SortOrder, sortBy } from "../lib/sort.js";
import { cn, MONO_LABEL } from "../lib/utils.js";
import { AgeRangeInput } from "./AgeRangeInput.js";
import { DriverLabel, NAME_TARGET, Overall, SELECTED_ROW } from "./SeasonGrid.js";
import { SortToggle } from "./SortToggle.js";
import { Card, CardBand } from "./ui/card.js";

/**
 * One filter on the pool, as a yes-or-no answer.
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
    <fieldset className="border-border text-muted-foreground flex flex-col gap-1.5 border p-2 text-xs">
      <legend className={cn(MONO_LABEL, "px-1")}>Hide</legend>
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
      <AgeRangeInput band={filters} ratingMode={ratingMode} onChange={onChange} />
    </fieldset>
  );
}

/**
 * How the pool is narrowed, and the setter that remembers it.
 *
 * Held by the editor so the panel stays controlled, but the answer is the
 * reader's: `lib/filter-preference` remembers it, because the editor is
 * re-mounted every time a grid is applied and setting the same four things
 * again each visit is what this was.
 *
 * The mode the filters were opened for decides what the panel *opens* on — the
 * two modes disagree about which career filters make sense — and that is all it
 * decides: a set the reader chose is theirs. So the defaults are only re-laid
 * on a mode change while nothing has ever been stored. Adjusting state during
 * render is React's own pattern for this.
 */
export function useReserveFilters(
  ratingMode: RatingMode,
): readonly [DriverFilters, (filters: DriverFilters) => void] {
  const [filters, setFilters] = useState<DriverFilters>(() => readDriverFilters(ratingMode));
  const [filtersMode, setFiltersMode] = useState<RatingMode>(ratingMode);
  if (filtersMode !== ratingMode) {
    setFiltersMode(ratingMode);
    if (!hasStoredDriverFilters()) {
      setFilters(defaultDriverFilters(ratingMode));
    }
  }
  const narrow = (next: DriverFilters): void => {
    setFilters(next);
    rememberDriverFilters(next);
  };
  return [filters, narrow];
}

/**
 * The drivers with no seat, as a pick-list beside the grid.
 *
 * Exported so it can be rendered on its own: the editor keeps the draft in
 * component state, which a DOM-less test cannot open. The filters are
 * **controlled** for the same reason — held above, passed in, so every state
 * the list can be narrowed to renders without a click.
 *
 * **The filters only narrow this list.** Nothing on the grid reads them: a
 * driver they hide is still free to take a seat, and who the run's settings may
 * sign is the settings' own pool.
 *
 * `drivers` is the whole pool without a seat; what is drawn is that list
 * filtered. Both counts are on screen, because "3 in the pool" with nothing
 * saying the other twenty are hidden is how a reader concludes the app has lost
 * half its drivers.
 *
 * The filters apply to *everyone* in the pool, including a driver the season
 * entered who has just been swapped out of the grid — losing a seat puts them
 * in the pool on the same terms as anyone else, and a list that quietly exempts
 * some of its rows is a list whose counts lie.
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
  sortName = "reserve-sort",
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
  /**
   * The sort switch's radio group. The phone's sheet passes its own: the
   * sidebar's copy is still mounted, hidden, and one name would group the two.
   */
  sortName?: string;
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
  const pool = count(drivers.length, "driver", "drivers");

  return (
    // The same panel as the grid it stands beside: a head band, then a tower
    // of full-width rows.
    <Card>
      <CardBand title="Without a drive">
        <SortToggle
          label="Sort drivers without a drive"
          name={sortName}
          order={sort}
          {...(onSortChange === undefined ? {} : { onChange: onSortChange })}
        />
      </CardBand>
      <div className="flex flex-col gap-2 p-3">
        <p className="text-muted-foreground text-xs">
          {shown.length === drivers.length
            ? `${pool} available.`
            : `${shown.length} of ${pool} available.`}
          {shown.length === 0 ? null : " Pick one to put them in the seat."}
        </p>
        <ReserveFilters
          seasonYear={seasonYear}
          ratingMode={ratingMode}
          filters={filters}
          onChange={onFiltersChange ?? (() => {})}
        />
        {shown.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            No driver matches. Try widening the filters.
          </p>
        ) : null}
      </div>
      <ul className="striped border-border flex flex-col border-t empty:hidden">
        {listed.map((driver) => {
          const selected = driver.id === selectedDriverId;
          return (
            <li
              key={driver.id}
              className={cn("flex items-center gap-2 px-3 py-1 text-sm", selected && SELECTED_ROW)}
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
    </Card>
  );
}
