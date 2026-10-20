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
import { type ReactNode, useMemo, useState } from "react";
import type { KeptNotes } from "../lib/kept.js";
import { seasonSeed, seasonWithChassis } from "../lib/seasons.js";
import { useSortOrder } from "../lib/sort-preference.js";
import { cn } from "../lib/utils.js";
import { ReserveList, useReserveFilters } from "./ReserveList.js";
import { RunConfirmDialog } from "./RunDialogs.js";
import { SeasonGrid } from "./SeasonGrid.js";
import { Button } from "./ui/button.js";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet.js";
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

  // The pool, for the sidebar and the phone's sheet alike. `picked` is the
  // sheet's close; the sidebar has nothing to close.
  const reserveList = (picked?: () => void) => (
    <ReserveList
      {...(picked === undefined ? {} : { sortName: "reserve-sort-sheet" })}
      drivers={grid.reserve}
      seasonYear={year}
      ratingMode={ratingMode}
      selectedDriverId={grid.selected?.kind === "driver" ? grid.selected.driverId : null}
      onSelect={(driverId) => {
        grid.select({ kind: "driver", driverId });
        picked?.();
      }}
      filters={filters}
      onFiltersChange={narrow}
      sort={sort}
      onSortChange={setSort}
    />
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
        action={action}
        ratingMode={ratingMode}
        sort={sort}
        onSortChange={setSort}
        {...(grid.edit === undefined ? {} : { edit: grid.edit })}
        {...(onApply === undefined
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
        <>
          {/* Sticky, because the seat being filled is usually somewhere else on a
            page fifteen cards long. From `lg` up only: below it the pool is the
            sheet the bar below opens, not a list under all fifteen cards. */}
          <aside className="hidden lg:sticky lg:top-24 lg:block">{reserveList()}</aside>
          <ReserveSheet count={grid.reserve.length}>{reserveList}</ReserveSheet>
        </>
      )}
    </div>
  );
}

/**
 * The pool on a phone: a bar pinned to the foot of the screen that opens it as
 * a bottom sheet (the mobile drawer pattern). Hidden from `lg` up, where the
 * pool stands beside the grid.
 *
 * `sticky bottom-0` inside the editor's own container rather than `fixed`: it
 * holds the screen's foot while the grid is in view and comes to rest at the
 * container's end, so it never covers the run actions or footer below and the
 * page needs no padding to clear it. (The run bar is pinned to the *top*, so
 * the two never meet.)
 *
 * `children` draws the pool and is handed `close`, to call once a driver is
 * picked so the reader lands back at the seats.
 */
export function ReserveSheet({
  count,
  children,
}: {
  /** Drivers without a seat, the count the list itself calls available. */
  count: number;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <div className="bg-card border-border sticky bottom-0 z-30 border-t pb-[env(safe-area-inset-bottom)] lg:hidden">
        <SheetTrigger asChild>
          <button
            type="button"
            className="hover:bg-accent flex w-full items-center justify-between gap-2 px-4 py-3 text-sm font-semibold"
          >
            <span>Without a drive ({count})</span>
            <span aria-hidden="true">▲</span>
          </button>
        </SheetTrigger>
      </div>
      <SheetContent aria-describedby={undefined}>
        {/* The pool's own band says "Without a drive" just below, so the
            sheet's title is for screen readers and its row holds only the ✕. */}
        <SheetHeader className="bg-card justify-end border-b-0 py-0.5">
          <SheetTitle className="sr-only">Without a drive</SheetTitle>
        </SheetHeader>
        <SheetBody>
          {children(() => {
            setOpen(false);
          })}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
