import { Outlet } from "@tanstack/react-router";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { KeptNames } from "./components/EntryNames.js";
import { KeptLiveries } from "./components/Liveries.js";
import { StepLinks } from "./components/PageSteps.js";
import { RunActions, type RunActionsProps, RunBar } from "./components/RunBar.js";
import { JumpDialog, type RunConfirm, RunConfirmDialog } from "./components/RunDialogs.js";
import type { RunChoice } from "./components/RunSettingsDialog.js";
import { SeasonHistoryProvider } from "./components/SeasonHistory.js";
import { SeasonView } from "./components/SeasonView.js";
import { SiteFooter } from "./components/SiteFooter.js";
import { TopNav } from "./components/TopNav.js";
import type { GridEdit } from "./components/useGridDraft.js";
import type { PageSteps } from "./lib/page-steps.js";
import { type RevealedWorld, revealed } from "./lib/reveal.js";
import { PAGE_OF } from "./lib/roster-places.js";
import { type Crumb, type ReturnLink, runBarFor } from "./lib/run-bar.js";
import type { SeasonTab, SeasonTabLink } from "./lib/season-tabs.js";
import { adjacentSeason } from "./lib/seasons.js";
import { type RoundPages, racePage, type SessionNav } from "./lib/session-nav.js";
import type { Place, View } from "./lib/timeline.js";
import { cn } from "./lib/utils.js";
import { type EraRun, isUntouched, type Run, racedLineup, useSeasonStore } from "./store/season.js";

/**
 * A page inside the frame: its sticky bar, a centred column, and the site
 * footer, with `foot` full width between the column and the footer (Home's
 * track, whose lower verge the footer then becomes). The column grows to fill
 * the window, so on a short page the foot and the footer sit at the bottom of it
 * and the page sits in the middle of the room above them.
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
  foot,
  fit = false,
  children,
}: {
  bar?: React.ReactNode;
  seed?: number;
  foot?: React.ReactNode;
  /**
   * On a wide screen, the column, `foot` and the footer fill the window below
   * the nav exactly, so the foot and the footer are always in view. What the
   * column holds must then scroll within itself (Home's modes).
   */
  fit?: boolean;
  children: React.ReactNode;
}) {
  const page = (
    <>
      {/* A page shorter than the window sits in the middle of it; a longer one starts at the top. */}
      <div
        className={cn(
          "mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center-safe gap-6 px-4 sm:px-6",
          fit && "lg:min-h-0",
        )}
      >
        {children}
      </div>
      {foot}
      {/* Home's track meets the footer, which becomes its verge; every other page leaves a gap. */}
      <SiteFooter
        {...(seed === undefined ? {} : { seed })}
        {...(foot === undefined ? { className: "mt-6" } : { onVerge: true })}
      />
    </>
  );
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
      {fit ? (
        // The window's height less the nav's band and its rule. A floor, so a
        // window too short for even the tightened page scrolls instead.
        <div className="flex flex-col lg:h-[calc(100dvh-var(--spacing-nav)-1px)] lg:min-h-[30rem]">
          {page}
        </div>
      ) : (
        page
      )}
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
  steps = null,
  returnTo,
  onContinue,
  onSkip,
  onJump,
  onRestartSeason,
  onRestartEra,
  onExit,
  leaving,
  children,
}: {
  run: Run;
  crumbs: readonly Crumb[];
  /**
   * The page either side: arrows after the trail and named links at the foot,
   * from this one value so the two always agree. Null on a page with none.
   */
  steps?: PageSteps | null;
  /** The way back to where the run is, while the page is elsewhere. */
  returnTo: ReturnLink | null;
  onContinue: () => void;
  onSkip: () => void;
  /** Jump to…, once the reader has picked where. */
  onJump: (target: Place) => void;
  /** Restart season, confirmed. */
  onRestartSeason: () => void;
  /** Restart era, confirmed. */
  onRestartEra: () => void;
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
  const [asking, setAsking] = useState<RunConfirm | "jump" | null>(null);
  const state = runBarFor(run);
  // Every year the reader has reached, the cursor's cut at the cursor: what
  // the career panel behind any name on any page of the run reads.
  const years = useMemo(() => revealed(run).years, [run]);
  const actions: RunActionsProps = {
    state,
    returnTo,
    // Only while the cursor is on a grid: the flag outlives nothing else.
    editingGrid: editingGrid && run.cursor.kind === "grid",
    onContinue,
    onSkip,
    onJump: () => {
      setAsking("jump");
    },
    onRestartSeason: () => {
      setAsking("restartSeason");
    },
    onRestartEra: () => {
      setAsking("restartEra");
    },
    onExit: () => {
      // Nothing to lose, so nothing to ask.
      if (isUntouched(run)) {
        onExit();
      } else {
        setAsking("exit");
      }
    },
  };
  // A held Back is asked as an exit, whatever else was being asked.
  const confirming: RunConfirm | null =
    leaving !== null ? "exit" : asking === "jump" || asking === "replace" ? null : asking;
  const confirmed: Record<RunConfirm, () => void> = {
    exit: () => {
      if (leaving !== null) {
        leaving.onConfirm();
      } else {
        onExit();
      }
    },
    replace: () => {},
    clearEdits: () => {},
    restartSeason: onRestartSeason,
    restartEra: onRestartEra,
  };

  return (
    <GridEditingContext.Provider value={setEditingGrid}>
      <Shell seed={run.world.seed} bar={<RunBar crumbs={crumbs} steps={steps} {...actions} />}>
        {/* Every team on every page of the run is named by the run's own rule. */}
        <KeptNames from={run.world.namesKeptFrom}>
          <KeptLiveries from={run.world.liveriesKeptFrom}>
            {/*
              People pages are an era's, so a one-year run's panels lead to none;
              race pages are every run's.
            */}
            <SeasonHistoryProvider
              seasons={years}
              pageOf={run.kind === "era" ? PAGE_OF : null}
              racePage={racePage}
            >
              <div className="flex flex-col gap-6 pt-8 lg:pt-10">
                {children}
                {steps === null ? null : <StepLinks steps={steps} />}
              </div>
            </SeasonHistoryProvider>
          </KeptLiveries>
        </KeptNames>
        <div className="border-border flex border-t pt-6">
          <RunActions {...actions} />
        </div>
      </Shell>
      <RunConfirmDialog
        open={confirming !== null}
        variant={confirming ?? "exit"}
        onConfirm={() => {
          setAsking(null);
          if (confirming !== null) {
            confirmed[confirming]();
          }
        }}
        onCancel={() => {
          setAsking(null);
          leaving?.onCancel();
        }}
      />
      <JumpDialog
        open={asking === "jump"}
        run={run}
        onJump={(target) => {
          setAsking(null);
          onJump(target);
        }}
        onCancel={() => {
          setAsking(null);
        }}
      />
    </GridEditingContext.Provider>
  );
}

/**
 * One beat of one season, on its own page: the grid, a session or the
 * summary, for whichever year of the run the URL names.
 *
 * `run` is present only inside an era, and is the years before this one: it
 * changes whether the year switcher is offered, which settings the grid's
 * settings line shows and what the grid editor's carry-over copies, and
 * nothing else. A grid page is always the cursor's, so always editable: a
 * raced one is the season page's Grid tab (`resolveRunPage`). `onYearChange` is the grid's shortcut to the season next door, which
 * moves the URL and so comes from the route.
 *
 * `world` is the year as far as the reader has got (`revealYear`), never the
 * store's whole world: a page is never handed a result past the cursor.
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
  settingsLock = null,
  backToSetupLock,
  onBackToSetup,
  onYearChange,
  finished,
  tab,
  tabs,
  pagesOf,
  sessionNav,
}: {
  world: RevealedWorld;
  view: View;
  run?: EraRun;
  /** Why the run settings can no longer be changed here (`settingsLock`), or null. */
  settingsLock?: string | null;
  /** On an era's first grid, why it cannot go back to setup (`backToSetupLock`), or null. */
  backToSetupLock?: string | null;
  onBackToSetup?: () => void;
  onYearChange?: (year: number) => void;
  /** On the season's page: whether its summary is reached, and its tabs. */
  finished?: boolean;
  tab?: SeasonTab;
  tabs?: readonly SeasonTabLink[];
  /** On the season's page: a round's pages, for the calendar. */
  pagesOf?: (round: number) => RoundPages;
  /** On a session's page: the links around it. */
  sessionNav?: SessionNav | null;
}) {
  const setGrid = useSeasonStore((state) => state.setGrid);
  const setRunSettings = useSeasonStore((state) => state.setRunSettings);
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
  // era last season may itself have been rewritten, or kept. Read off what
  // raced rather than the year's `lineup`, which is null for any grid the reader
  // did not edit, the kept one included. A standalone season has no year behind
  // it and gets null, which the editor reads as "copy history".
  const previousYear = adjacentSeason(world.year, -1);
  const previousWorld =
    previousYear === null ? undefined : run?.seasons.find((season) => season.year === previousYear);
  const previousLineup = previousWorld === undefined ? null : racedLineup(previousWorld);
  const editable = view.kind === "grid";

  return (
    <SeasonView
      world={world}
      view={view}
      inEra={run !== undefined}
      previousLineup={previousLineup}
      {...(run === undefined && editable && onYearChange !== undefined ? { onYearChange } : {})}
      {...(editable
        ? {
            onGridChange: (edit: GridEdit) => {
              setGrid(edit.lineup, edit.engines, edit.chassis, edit.engineRatings, edit.trends);
            },
          }
        : {})}
      onGridEditingChange={setEditingGrid}
      settingsLock={settingsLock}
      {...(editable && settingsLock === null
        ? {
            onSettingsChange: (choice: RunChoice) => {
              setRunSettings(choice.randomness, choice.settings, choice.ratingMode);
            },
          }
        : {})}
      {...(editable && backToSetupLock !== undefined
        ? {
            backToSetupLock,
            ...(onBackToSetup === undefined ? {} : { onBackToSetup }),
          }
        : {})}
      {...(finished === undefined ? {} : { finished })}
      {...(tab === undefined ? {} : { tab })}
      {...(tabs === undefined ? {} : { tabs })}
      {...(pagesOf === undefined ? {} : { pagesOf })}
      {...(sessionNav === undefined ? {} : { sessionNav })}
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
