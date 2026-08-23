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
import { driverOverall } from "../lib/rating.js";
import { seasonSeed } from "../lib/seasons.js";
import { cn } from "../lib/utils.js";
import { DriverLabel, type GridEditing, Overall, SeasonGrid } from "./SeasonGrid.js";
import { Button } from "./ui/button.js";

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
