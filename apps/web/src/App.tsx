import { Outlet } from "@tanstack/react-router";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { KeptNames } from "./components/EntryNames.js";
import type { GridEdit } from "./components/GridStage.js";
import { KeptLiveries } from "./components/Liveries.js";
import { RunActions, type RunActionsProps, RunBar } from "./components/RunBar.js";
import { JumpDialog, type RunConfirm, RunConfirmDialog } from "./components/RunDialogs.js";
import type { RunChoice } from "./components/RunSettingsDialog.js";
import { SeasonHistoryProvider } from "./components/SeasonHistory.js";
import { SeasonView } from "./components/SeasonView.js";
import { SiteFooter } from "./components/SiteFooter.js";
import { TopNav } from "./components/TopNav.js";
import { type RevealedWorld, revealed } from "./lib/reveal.js";
import { PAGE_OF } from "./lib/roster-places.js";
import { type Crumb, type ReturnLink, runBarFor } from "./lib/run-bar.js";
import type { SeasonTab, SeasonTabLink } from "./lib/season-tabs.js";
import { adjacentSeason } from "./lib/seasons.js";
import { type RoundPages, racePage, type SessionNav } from "./lib/session-nav.js";
import type { Place, View } from "./lib/timeline.js";
import { type EraRun, isUntouched, type Run, racedLineup, useSeasonStore } from "./store/season.js";

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
      <Shell seed={run.world.seed} bar={<RunBar crumbs={crumbs} {...actions} />}>
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
              <div className="flex flex-col gap-6 pt-8 lg:pt-10">{children}</div>
            </SeasonHistoryProvider>
          </KeptLiveries>
        </KeptNames>
        <div className="border-border flex flex-wrap items-center justify-between gap-3 border-t pt-6">
          <span className="text-muted-foreground text-xs">{state.cursor}</span>
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
 * changes whether the ability toggle is offered, which settings the grid's
 * settings line shows and what the grid editor's carry-over copies, and
 * nothing else. `locked` is a grid the run has moved
 * past. `onYearChange` is the grid's shortcut to the season next door, which
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
  locked = false,
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
  locked?: boolean;
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
  const setRatingMode = useSeasonStore((state) => state.setRatingMode);
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
              setGrid(edit.lineup, edit.engines, edit.chassis);
            },
          }
        : {})}
      onGridEditingChange={setEditingGrid}
      settingsLock={settingsLock}
      {...(editable && settingsLock === null
        ? {
            onSettingsChange: (choice: RunChoice) => {
              setRunSettings(choice.randomness, choice.settings);
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
