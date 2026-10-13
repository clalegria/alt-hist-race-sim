import {
  authoredChassis,
  type Driver,
  drivers,
  type GridArrangement,
  type RatingMode,
  type SeasonChassis,
  type SeasonEngineRatings,
  type SeasonEngines,
  type SeasonLineup,
  type SeasonSeed,
  type SeasonTrends,
} from "@alt-hist/data";
import type { RaceEntrant } from "@alt-hist/engine";
import { useMemo, useState } from "react";
import type { KeptNotes } from "../lib/kept.js";
import { seasonSeed, seasonWithChassis } from "../lib/seasons.js";
import { useSortOrder } from "../lib/sort-preference.js";
import { cn } from "../lib/utils.js";
import { ReserveList, useReserveFilters } from "./ReserveList.js";
import { RunConfirmDialog } from "./RunDialogs.js";
import { SeasonGrid } from "./SeasonGrid.js";
import { Button } from "./ui/button.js";
import { type GridEdit, useGridDraft } from "./useGridDraft.js";

/**
 * The opening grid, and the editor that lets a reader change it.
 *
 * The editor only changes this grid. Who drives where across the whole run is a
 * setting (*Who drives where*), already in the grid this opens on; the drafts
 * and their rules are `useGridDraft`, the pool beside the grid `ReserveList`.
 */
export function GridStage({
  field,
  year,
  ratingMode,
  lineup,
  engines,
  chassis = null,
  engineRatings = null,
  trends = null,
  baselineChassis = null,
  historicalEngines = null,
  runSeason = null,
  kept = null,
  arrangement = null,
  previousLineup = null,
  pool = drivers,
  locked = false,
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
  /** The applied engine ratings, per engine, or null for the ones the season was entered with. */
  engineRatings?: SeasonEngineRatings | null;
  /** The applied development trends, or null for the ones the season was entered with. */
  trends?: SeasonTrends | null;
  /**
   * The run's own chassis for the year (*Chassis performance*), or null for the
   * authored ones: what the season was entered with, and so what Restore puts
   * back and every change is measured from (`World.baselineChassis`).
   */
  baselineChassis?: SeasonChassis | null;
  /**
   * Each engine as history rated it when *Engine performance* rolled the run's
   * own (`historicalEngineRatings`), or null: for the popover's history → this
   * run.
   */
  historicalEngines?: SeasonEngineRatings | null;
  /**
   * The season as the run entered it when that is not the seed file with
   * `baselineChassis` in it — kept teams, signings or a reseat
   * (`enteredSeason`) — or null. Restore puts it back.
   */
  runSeason?: SeasonSeed | null;
  /** What *Teams: The first season's teams* did to the year (`keptNotes`), or null. */
  kept?: KeptNotes | null;
  /** The rule the run's settings reseat the grid by (`seatingArrangement`), or null. */
  arrangement?: GridArrangement | null;
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
   * overalls and the carry-over all read the ratings the season will race on.
   */
  pool?: readonly Driver[];
  /**
   * A grid that has been raced: drawn as it stood, with no way into the editor.
   * The store would refuse the edit anyway, and a button that does nothing is a
   * control that lies.
   */
  locked?: boolean;
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
  const grid = useGridDraft({
    season,
    field,
    year,
    ratingMode,
    lineup,
    engines,
    chassis,
    engineRatings,
    trends,
    previousLineup,
    pool,
    onApply,
    onEditingChange,
  });
  // Whether the reader is being asked to confirm Clear all edits.
  const [clearing, setClearing] = useState(false);
  const [filters, narrow] = useReserveFilters(ratingMode);
  // How every list on the app is ordered — one shared, session-remembered
  // choice, not one per switch. See `lib/sort-preference.ts`.
  const [sort, setSort] = useSortOrder();

  const action =
    grid.edit === undefined ? (
      <Button variant="outline" onClick={grid.start}>
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
          disabled={grid.open.length > 0}
          onClick={grid.apply}
        >
          Apply grid
        </Button>
        {grid.previous === null ? null : (
          <Button variant="outline" onClick={grid.copyPrevious}>
            Copy {grid.previous.year} grid
          </Button>
        )}
        <Button variant="outline" disabled={grid.untouched} onClick={grid.restore}>
          Restore {year} grid
        </Button>
        <Button variant="ghost" onClick={grid.stop}>
          Cancel
        </Button>
      </>
    );

  return (
    <div
      className={cn(
        "grid gap-4",
        grid.edit === undefined ? "" : "lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start",
      )}
    >
      <SeasonGrid
        field={grid.preview}
        seasonYear={year}
        changes={grid.changes}
        engineChanges={grid.supplyChanges}
        chassisChanges={grid.rerated}
        engineRatingChanges={grid.reratedEngines}
        trendChanges={grid.retrended}
        historicalChassis={historicalChassis}
        historicalEngines={historicalEngines}
        arrangement={arrangement}
        kept={kept}
        openSeats={grid.open.length}
        {...(locked ? {} : { action })}
        ratingMode={ratingMode}
        sort={sort}
        onSortChange={setSort}
        {...(grid.edit === undefined ? {} : { edit: grid.edit })}
        {...(locked || onApply === undefined
          ? {}
          : {
              onClearEdits: () => {
                setClearing(true);
              },
            })}
      />
      {/*
        Clear all edits asks first: a grid built from forty swaps is one click
        from gone otherwise, and nothing undoes an applied grid. Every part
        null is the grid as the season entered it — the run's own cars, kept
        seats and reseat included, since those are the baseline and not edits.
      */}
      <RunConfirmDialog
        open={clearing}
        variant="clearEdits"
        onConfirm={() => {
          setClearing(false);
          onApply?.({
            lineup: null,
            engines: null,
            chassis: null,
            engineRatings: null,
            trends: null,
          });
        }}
        onCancel={() => {
          setClearing(false);
        }}
      />
      {grid.edit === undefined ? null : (
        // Sticky, because the seat being filled is usually somewhere else on a
        // page fifteen cards long.
        <aside className="lg:sticky lg:top-24">
          <ReserveList
            drivers={grid.reserve}
            seasonYear={year}
            ratingMode={ratingMode}
            selectedDriverId={grid.selected?.kind === "driver" ? grid.selected.driverId : null}
            onSelect={(driverId) => {
              grid.select({ kind: "driver", driverId });
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
