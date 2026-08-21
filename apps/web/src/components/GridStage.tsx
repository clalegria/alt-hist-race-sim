import {
  applyLineup,
  authoredLineup,
  buildField,
  type Driver,
  driverRatingsFor,
  isAuthoredLineup,
  lineupChanges,
  type RatingMode,
  reserveDrivers,
  type SeasonLineup,
  seatOf,
  swapDrivers,
} from "@alt-hist/data";
import type { RaceEntrant } from "@alt-hist/engine";
import { useMemo, useState } from "react";
import { driverOverall } from "../lib/rating.js";
import { seasonSeed } from "../lib/seasons.js";
import { cn } from "../lib/utils.js";
import { DriverLabel, type GridEditing, Overall, SeasonGrid } from "./SeasonGrid.js";
import { Button } from "./ui/button.js";

/**
 * The opening grid, and the editor that lets a reader rearrange it.
 *
 * Editing is a *draft*: swaps accumulate in component state and change nothing
 * until Apply, which hands the finished lineup to the store and re-runs the
 * year. That is deliberate — every applied lineup re-simulates fourteen races,
 * and a reader mid-way through moving four drivers around has not yet asked a
 * question worth answering.
 *
 * The constraint the whole thing is built around is that **only swaps exist**.
 * A team fields the number of cars it entered, so taking a seat always means
 * giving one up, and the field stays the size the starting limit was set
 * against. `swapDrivers` in `@alt-hist/data` enforces it; nothing here can
 * express an addition.
 */

/**
 * The drivers with no seat, as a pick-list beside the grid.
 *
 * Exported so it can be rendered on its own: `GridStage` keeps the draft in
 * component state, which a DOM-less test cannot open.
 */
export function ReserveList({
  drivers,
  seasonYear,
  ratingMode,
  selectedDriverId,
  onSelect,
}: {
  drivers: readonly Driver[];
  seasonYear: number;
  ratingMode: RatingMode;
  selectedDriverId: string | null;
  onSelect: (driverId: string) => void;
}) {
  return (
    <section className="border-border bg-card flex flex-col gap-2 rounded-xl border p-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold tracking-tight">Without a drive</h3>
        <p className="text-muted-foreground text-xs">
          {drivers.length} in the pool. Select one to put them in the selected seat.
        </p>
      </div>
      <ul className="flex flex-col gap-1">
        {drivers.map((driver) => {
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

export function GridStage({
  field,
  year,
  ratingMode,
  lineup,
  onApply,
  onEditingChange,
}: {
  /** The grid as raced. Replaced by a preview of the draft while editing. */
  field: readonly RaceEntrant[];
  year: number;
  ratingMode: RatingMode;
  /** The applied lineup, or null for the season as it was entered. */
  lineup: SeasonLineup | null;
  /** Absent in tests, where nothing is clicked. The controls still render. */
  onApply?: (lineup: SeasonLineup | null) => void;
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

  // Null means "not editing": one flag fewer than a draft plus a boolean, and
  // it cannot get into the state where the editor is open with nothing to edit.
  const [draft, setDraft] = useState<SeasonLineup | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const shown = draft ?? applied;
  const changes = useMemo(() => lineupChanges(season, shown), [season, shown]);

  // Draft grids are rebuilt rather than raced: the ratings are the same
  // function of driver, season and mode that `createWorld` will apply, so what
  // is on screen is what the season will be run on.
  const preview = useMemo(
    () => (draft === null ? field : buildField(applyLineup(season, draft), undefined, ratingMode)),
    [draft, field, season, ratingMode],
  );
  const reserve = useMemo(() => reserveDrivers(shown), [shown]);

  const startEditing = (from: SeasonLineup): void => {
    setDraft(from);
    setSelected(null);
    onEditingChange?.(true);
  };

  const stopEditing = (): void => {
    setDraft(null);
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

  const editing: GridEditing | undefined =
    draft === null ? undefined : { selectedDriverId: selected, onSelect: select };

  const action =
    draft === null ? (
      <Button
        variant="outline"
        onClick={() => {
          startEditing(applied);
        }}
      >
        Edit grid
      </Button>
    ) : (
      <>
        <Button
          onClick={() => {
            onApply?.(isAuthoredLineup(season, draft) ? null : draft);
            stopEditing();
          }}
        >
          Apply grid
        </Button>
        <Button
          variant="outline"
          disabled={isAuthoredLineup(season, draft)}
          onClick={() => {
            setDraft(authoredLineup(season));
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
        action={action}
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
          />
        </aside>
      )}
    </div>
  );
}
