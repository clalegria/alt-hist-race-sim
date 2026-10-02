import { Outlet } from "@tanstack/react-router";
import { createContext, useContext, useEffect, useState } from "react";
import type { GridEdit } from "./components/GridStage.js";
import { RunActions, type RunActionsProps, RunBar } from "./components/RunBar.js";
import { ExitRunDialog, JumpForwardDialog } from "./components/RunDialogs.js";
import { SeasonView } from "./components/SeasonView.js";
import { SiteFooter } from "./components/SiteFooter.js";
import { TopNav } from "./components/TopNav.js";
import { type Crumb, runBarFor } from "./lib/run-bar.js";
import { adjacentSeason } from "./lib/seasons.js";
import type { View } from "./lib/timeline.js";
import { type EraRun, type Run, useSeasonStore, type World } from "./store/season.js";

/**
 * A page inside the frame: its sticky bar, a centred column, and the site
 * footer.
 *
 * The footer is rendered here rather than by each screen so that every screen
 * has one — the attribution belongs to the app, not to the season screen that
 * happened to have a seed worth printing. `seed` is the only part that varies,
 * and only the season screen passes it. A page with nothing to put in the bar
 * draws no bar.
 */
export function Shell({
  bar,
  seed,
  children,
}: {
  bar?: React.ReactNode;
  seed?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col">
      {/*
        Sticky, so the way forward is always one click away rather than a scroll
        past a 28-row table. The same buttons repeat at the foot of the page,
        which is where a reader who has just finished reading actually is. The
        top nav above it scrolls away; this is the bar that stays.
      */}
      {bar === undefined ? null : (
        <div className="bg-background/85 border-border sticky top-0 z-40 border-b backdrop-blur">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
            {bar}
          </div>
        </div>
      )}
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 pb-8 sm:px-6 lg:pb-10">
        {children}
        {/* Pushed to the bottom of the viewport on a short page, so the credit
            sits at the foot of the window rather than under the last button. */}
        <div className="mt-auto">
          <SiteFooter {...(seed === undefined ? {} : { seed })} />
        </div>
      </div>
    </div>
  );
}

/**
 * Tells the run bar whether the grid editor is open. The grid page raises it;
 * the frame, which draws the bar, holds it. A context rather than a prop
 * because the page is the router's `<Outlet />`, not a child the frame renders.
 */
const GridEditingContext = createContext<(editing: boolean) => void>(() => {});

/**
 * Everything a page inside a run sits in: the run bar at the top, the same
 * actions again at the foot, and the dialogs those actions open.
 *
 * Every action is a prop, because each one moves the store *and* the URL and
 * that is the route's job (`run-routes.tsx`); this keeps the frame free of the
 * router apart from the breadcrumbs' links. What the reader is being asked —
 * start again, exit, jump where — is component state, the same split as
 * everywhere else: it is not simulation state.
 *
 * **Pages read, the run bar acts.** A page inside a run never advances or
 * edits it, the grid editor on the cursor's own grid excepted, so a read-only
 * view of a run later is these pages with this bar's actions hidden.
 */
export function RunFrame({
  run,
  crumbs,
  onContinue,
  onSkip,
  onJump,
  onRestart,
  onExit,
  leaving,
  children,
}: {
  run: Run;
  crumbs: readonly Crumb[];
  onContinue: () => void;
  onSkip: () => void;
  onJump: (through: number) => void;
  onRestart: () => void;
  /** Exit run, confirmed. */
  onExit: () => void;
  /**
   * A Back past the run's first page, held while the reader is asked. Null
   * while nothing is being held.
   */
  leaving: { onConfirm: () => void; onCancel: () => void } | null;
  children: React.ReactNode;
}) {
  const [editingGrid, setEditingGrid] = useState(false);
  const [asking, setAsking] = useState<"restart" | "exit" | "jump" | null>(null);
  const state = runBarFor(run);
  const actions: RunActionsProps = {
    state,
    // Only while the cursor is on a grid: the flag outlives nothing else.
    editingGrid: editingGrid && run.cursor.kind === "grid",
    confirmingRestart: asking === "restart",
    onContinue,
    onSkip,
    onJump: () => {
      setAsking("jump");
    },
    onStartAgain: () => {
      setAsking("restart");
    },
    onRestart: () => {
      setAsking(null);
      onRestart();
    },
    onCancelRestart: () => {
      setAsking(null);
    },
    onExit: () => {
      setAsking("exit");
    },
  };

  return (
    <GridEditingContext.Provider value={setEditingGrid}>
      <Shell seed={run.world.seed} bar={<RunBar crumbs={crumbs} {...actions} />}>
        <div className="flex flex-col gap-6 pt-8 lg:pt-10">{children}</div>
        <div className="border-border flex flex-wrap items-center justify-between gap-3 border-t pt-6">
          <span className="text-muted-foreground text-xs">{state.cursor}</span>
          <RunActions {...actions} />
        </div>
      </Shell>
      <ExitRunDialog
        open={asking === "exit" || leaving !== null}
        variant="exit"
        onConfirm={() => {
          setAsking(null);
          if (leaving !== null) {
            leaving.onConfirm();
          } else {
            onExit();
          }
        }}
        onCancel={() => {
          setAsking(null);
          leaving?.onCancel();
        }}
      />
      {run.cursor.kind === "review" ? (
        <JumpForwardDialog
          open={asking === "jump"}
          lastCrowned={run.world.year}
          onJump={(through) => {
            setAsking(null);
            onJump(through);
          }}
          onCancel={() => {
            setAsking(null);
          }}
        />
      ) : null}
    </GridEditingContext.Provider>
  );
}

/**
 * One beat of one season, on its own page: the grid, a session or the
 * summary, for whichever year of the run the URL names.
 *
 * `run` is present only inside an era, and is the years before this one: it
 * changes whether the ability toggle is offered and what the grid editor's
 * carry-over copies, and nothing else. `locked` is a grid the run has moved
 * past. `onYearChange` is the grid's shortcut to the season next door, which
 * moves the URL and so comes from the route.
 *
 * Rendering the route itself cannot show a season — Zustand serves a *server*
 * snapshot of its initial state to `renderToStaticMarkup`, so a driven store
 * never reaches the markup — so this takes the world as a prop and is tested
 * as a component.
 */
export function SeasonPage({
  world,
  view,
  run,
  locked = false,
  onYearChange,
}: {
  world: World;
  view: View;
  run?: EraRun;
  locked?: boolean;
  onYearChange?: (year: number) => void;
}) {
  const setRatingMode = useSeasonStore((state) => state.setRatingMode);
  const setGrid = useSeasonStore((state) => state.setGrid);
  const setEditingGrid = useContext(GridEditingContext);
  // Leaving the grid page mid-edit — browser Back, a breadcrumb — unmounts the
  // editor without it saying it closed, which would leave the bar waiting on it.
  useEffect(
    () => () => {
      setEditingGrid(false);
    },
    [setEditingGrid],
  );

  // The grid the reader actually watched last year, for the editor's carry-over
  // button — the era's own history rather than the seed file's, since inside an
  // era last season may itself have been rewritten. A standalone season has no
  // year behind it and gets null, which the editor reads as "copy history".
  const previousYear = adjacentSeason(world.year, -1);
  const previousLineup =
    previousYear === null
      ? null
      : (run?.seasons.find((season) => season.year === previousYear)?.lineup ?? null);
  const editable = view.kind === "grid" && !locked;

  return (
    <SeasonView
      world={world}
      view={view}
      // An era is fixed at `ERA_RATING_MODE` and offers no switch, so the
      // handler is not passed either — the store would refuse it anyway, and
      // wiring a control that cannot fire is how one comes back by accident.
      canChooseAbility={run === undefined}
      inEra={run !== undefined}
      locked={locked}
      previousLineup={previousLineup}
      {...(run === undefined && editable
        ? {
            onRatingModeChange: setRatingMode,
            ...(onYearChange === undefined ? {} : { onYearChange }),
          }
        : {})}
      {...(editable
        ? {
            onGridChange: (edit: GridEdit) => {
              setGrid(edit.lineup, edit.engines, edit.arrangement);
            },
          }
        : {})}
      onGridEditingChange={setEditingGrid}
    />
  );
}

/**
 * The frame every page sits in: the top nav, then whichever route matched.
 *
 * The root route renders this (`routes/__root.tsx`), and `<Outlet />` is
 * where the router puts the page for the current URL — the slot a layout leaves
 * for its children. Each page brings its own `Shell`.
 */
export function App() {
  return (
    <div className="flex min-h-dvh flex-col">
      <TopNav />
      <Outlet />
    </div>
  );
}
