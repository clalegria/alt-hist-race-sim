/**
 * What the routes inside `/run` share: the guard each runs before it renders,
 * the layout around them all, and the page each draws.
 *
 * Here rather than in `routes/` because TanStack reads every file in that
 * folder as a route, and a route file exports its `Route` and nothing else.
 * The route files stay one line of wiring each.
 */

import type { RandomnessLevel } from "@alt-hist/engine";
import {
  Navigate,
  Outlet,
  redirect,
  useBlocker,
  useMatches,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { RunFrame, SeasonPage, Shell } from "./App.js";
import { EraChampions } from "./components/EraChampions.js";
import { NotInRun, NotReached } from "./components/NotReached.js";
import { DriverPage, TeamPage } from "./components/PersonPages.js";
import { RosterIndex } from "./components/RosterIndex.js";
import { RunConfirmDialog } from "./components/RunDialogs.js";
import { stepsFor } from "./lib/page-steps.js";
import type { IndexSort } from "./lib/roster.js";
import {
  driversLink,
  PAGE_OF,
  type RosterLocation,
  type RosterPage,
  resolveRosterPage,
  rosterPageOf,
  teamsLink,
} from "./lib/roster-places.js";
import { crumbsFor, returnFor, runBarFor } from "./lib/run-bar.js";
import {
  isBackPastStart,
  linkTo,
  type RunPage,
  type RunParams,
  resolveRunPage,
  runPageOf,
} from "./lib/run-places.js";
import type { RunSettings } from "./lib/run-settings.js";
import { type SeasonTab, seasonTabLinks } from "./lib/season-tabs.js";
import { roundPages, sessionNav } from "./lib/session-nav.js";
import { backToSetupLock, settingsLock } from "./lib/settings-lock.js";
import type { Place } from "./lib/timeline.js";
import { cursorPlace, isUntouched, useSeasonStore } from "./store/season.js";

/**
 * The `beforeLoad` of every page inside `/run`: home when there is no run, the
 * cursor when the URL names a place the run does not have and never will, and
 * through otherwise — a place not reached yet included, which draws its own
 * page. It runs on every navigation to the page, before it renders, so a stray
 * URL never draws.
 */
export function guardRunPage(page: RunPage, params: RunParams): void {
  const run = useSeasonStore.getState().run;
  if (run === null) {
    throw redirect({ to: "/", replace: true });
  }
  const resolved = resolveRunPage(run, page, params);
  if (resolved.kind === "redirect" || resolved.kind === "raced") {
    throw redirect({ ...resolved.to, replace: true });
  }
}

/**
 * The page at one URL inside `/run`.
 *
 * Resolves again on every render, not only in the guard, because the store can
 * move under a page without a navigation — Restart season on a race leaves its
 * URL naming a session the new season has not revealed. A page that was
 * showing its place and no longer can goes to the cursor rather than drawing
 * something stale; only an address *arrived at* ahead of the cursor says it is
 * not reached yet.
 */
export function RunPlacePage({
  page,
  params,
  tab = "standings",
}: {
  page: RunPage;
  params: RunParams;
  /** The season page's tab, from its search params. */
  tab?: SeasonTab;
}) {
  const run = useSeasonStore((state) => state.run);
  const switchSeasonYear = useSeasonStore((state) => state.switchSeasonYear);
  const navigate = useNavigate();
  // The address this page last showed a place for, so a place lost under it
  // can be told from one that was never there.
  const showing = useRef<string | null>(null);
  const address = `${page}/${params.year ?? ""}/${params.round ?? ""}`;
  const resolved = run === null ? null : resolveRunPage(run, page, params);
  const visible = resolved?.kind === "season" || resolved?.kind === "review";
  const setupLock = run === null ? undefined : backToSetupLock(run);
  useEffect(() => {
    showing.current = visible ? address : null;
  }, [visible, address]);

  if (run === null || resolved === null) {
    // Drawn for an instant between an exit and the navigation it starts.
    return null;
  }
  switch (resolved.kind) {
    case "redirect":
      return <Navigate {...resolved.to} replace />;
    case "raced":
      // Continue on the grid races it under the page; the run's own navigation
      // is to the cursor, so going to the Grid tab here would undo it.
      return (
        <Navigate
          {...(showing.current === address ? linkTo(cursorPlace(run)) : resolved.to)}
          replace
        />
      );
    case "unreached":
      return showing.current === address ? (
        <Navigate {...linkTo(cursorPlace(run))} replace />
      ) : (
        <NotReached
          place={resolved.place}
          cursor={runBarFor(run).cursor}
          link={linkTo(cursorPlace(run))}
        />
      );
    case "review":
      return (
        <EraChampions
          run={resolved.run}
          inProgress={resolved.inProgress}
          seasonLink={(year) => linkTo({ year, beat: { kind: "summary" } })}
        />
      );
    case "season":
      return (
        <SeasonPage
          world={resolved.world}
          view={resolved.view}
          finished={resolved.finished}
          tab={tab}
          tabs={seasonTabLinks(resolved.place.year, tab)}
          pagesOf={(round) => roundPages(resolved.place.year, round)}
          sessionNav={sessionNav(cursorPlace(run), resolved.place)}
          {...(run.kind === "era" ? { run: run.run } : {})}
          settingsLock={settingsLock(run)}
          {...(setupLock === undefined ? {} : { backToSetupLock: setupLock })}
          onBackToSetup={() => {
            void navigate({ to: "/era/new" });
          }}
          onYearChange={(year) => {
            switchSeasonYear(year);
            // The run is now a different year, so the page it is on is too.
            const now = useSeasonStore.getState().run;
            if (now !== null) {
              void navigate({ ...linkTo(cursorPlace(now)), replace: true });
            }
          }}
        />
      );
  }
}

/**
 * The `beforeLoad` of the people pages: home when there is no run, the index
 * when the URL names no one the data has. Someone real the run has not had
 * passes, and the page says so (`NotInRun`).
 */
export function guardRosterPage(page: RosterPage, id?: string): void {
  const run = useSeasonStore.getState().run;
  if (run === null) {
    throw redirect({ to: "/", replace: true });
  }
  const resolved = resolveRosterPage(run, page, id);
  if (resolved.kind === "redirect") {
    throw redirect({ ...resolved.to, replace: true });
  }
}

/**
 * A people page: an index, or one driver or team across the run so far.
 *
 * Resolved on every render, like `RunPlacePage`, because the store can move
 * under it — a restart can take a driver out of the run whose page is on
 * screen — and then it goes to the index rather than drawing someone the run
 * no longer has.
 */
export function RosterPlacePage({
  page,
  id,
  sort = "titles",
}: {
  page: RosterPage;
  id?: string;
  sort?: IndexSort;
}) {
  const run = useSeasonStore((state) => state.run);
  if (run === null) {
    return null;
  }
  const resolved = resolveRosterPage(run, page, id);
  if (resolved.kind === "redirect") {
    return <Navigate {...resolved.to} replace />;
  }
  if (resolved.kind === "absent") {
    return <NotInRun page={resolved.page} id={resolved.id} />;
  }
  const { years, location } = resolved;
  switch (location.page) {
    case "drivers":
      return (
        <RosterIndex
          kind="drivers"
          years={years}
          sort={sort}
          linkFor={driversLink}
          pageOf={PAGE_OF}
        />
      );
    case "teams":
      return (
        <RosterIndex kind="teams" years={years} sort={sort} linkFor={teamsLink} pageOf={PAGE_OF} />
      );
    case "driver":
      return <DriverPage years={years} driverId={location.id ?? ""} />;
    case "team":
      return <TeamPage years={years} teamId={location.id ?? ""} />;
  }
}

/**
 * The layout around every page inside `/run`: the run bar and its actions,
 * the guard against Back past the run's first page, and an outlet for the page.
 *
 * Each action moves the store, then the URL. **The ways forward push** a
 * history entry — Continue, the skip, a jump — so Back returns to the page the
 * reader was on. **The restarts replace** it: the page they came from belongs
 * to results that no longer exist.
 */
export function RunLayout() {
  const run = useSeasonStore((state) => state.run);
  const continueRun = useSeasonStore((state) => state.continueRun);
  const jumpTo = useSeasonStore((state) => state.jumpTo);
  const restartSeason = useSeasonStore((state) => state.restartSeason);
  const restartEra = useSeasonStore((state) => state.restartEra);
  const exitRun = useSeasonStore((state) => state.exitRun);
  const navigate = useNavigate();
  const matches = useMatches();

  // Held until the reader answers the exit dialog. Off once there is no run,
  // so a Back after an exit is just a Back — and never held for an untouched
  // run, where going back to the setup page loses nothing. The store is read at
  // the moment of the navigation, not when this rendered.
  const blocker = useBlocker({
    shouldBlockFn: ({ action, current, next }) => {
      const now = useSeasonStore.getState().run;
      return (
        now !== null &&
        !isUntouched(now) &&
        isBackPastStart(action, current.pathname, next.pathname)
      );
    },
    withResolver: true,
    enableBeforeUnload: false,
    disabled: run === null,
  });

  // Each beat is a new page of results, so it starts at the top. A change of
  // URL does this by itself; this is for a change that keeps the URL — a
  // restart of a season whose grid was already on screen.
  // biome-ignore lint/correctness/useExhaustiveDependencies: firing on every change to the run is the point.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [run]);

  if (run === null) {
    return null;
  }

  // The trail is to the page on screen, which the router's deepest match names:
  // a beat's page, or a people page.
  const leaf = matches.at(-1);
  const page = leaf === undefined ? null : runPageOf(leaf.routeId);
  const rosterPage = leaf === undefined ? null : rosterPageOf(leaf.routeId);
  const resolved = page === null ? null : resolveRunPage(run, page, leaf?.params as RunParams);
  const params = (leaf?.params ?? {}) as { driverId?: string; teamId?: string };
  const person =
    rosterPage === null
      ? null
      : resolveRosterPage(run, rosterPage, params.driverId ?? params.teamId);
  // Someone the run has not had is placed at their list, which is where the
  // page points the reader.
  const place: Place | RosterLocation =
    person?.kind === "roster"
      ? person.location
      : person?.kind === "absent"
        ? { page: person.page === "driver" ? "drivers" : "teams" }
        : resolved === null || resolved.kind === "redirect" || resolved.kind === "raced"
          ? cursorPlace(run)
          : resolved.place;

  /** Moves the URL to wherever the cursor is now. */
  const toCursor = (replace: boolean) => {
    const now = useSeasonStore.getState().run;
    if (now !== null) {
      void navigate({ ...linkTo(cursorPlace(now)), replace });
    }
  };

  return (
    <RunFrame
      run={run}
      crumbs={crumbsFor(run, place)}
      // Only on a page drawn as itself: a place ahead says "Not reached yet",
      // and has no neighbours to offer.
      steps={
        resolved?.kind === "unreached" || person?.kind === "absent" ? null : stepsFor(run, place)
      }
      returnTo={returnFor(run, place)}
      onContinue={() => {
        continueRun();
        toCursor(false);
      }}
      onSkip={() => {
        // The skip is a jump to the end of this season.
        jumpTo({ year: run.world.year, beat: { kind: "summary" } });
        toCursor(false);
      }}
      onJump={(target) => {
        jumpTo(target);
        toCursor(false);
      }}
      onRestartSeason={() => {
        restartSeason();
        toCursor(true);
      }}
      onRestartEra={() => {
        restartEra();
        toCursor(true);
      }}
      onExit={() => {
        exitRun();
        // Replaced, so Back does not lead onto the run just discarded.
        void navigate({ to: "/", replace: true });
      }}
      leaving={
        blocker.status === "blocked"
          ? {
              onConfirm: () => {
                blocker.proceed();
                exitRun();
              },
              onCancel: blocker.reset,
            }
          : null
      }
    >
      <Outlet />
    </RunFrame>
  );
}

/**
 * A setup page — the year and the rules for a season or an era — and its one
 * way into a run.
 *
 * Start **pushes** the run's first page, which is what makes this page the
 * entry behind it, and so what a Back past the start lands on (and is asked
 * about). Starting while a run is in progress ends that run, so it asks first,
 * in the same dialog every other way out of a run uses — unless the run is
 * untouched, which is the reader who went back to change the randomness.
 */
export function SetupPage({
  start,
  picker,
}: {
  start: (year: number, randomness: RandomnessLevel, settings: RunSettings) => void;
  picker: (
    onStart: (year: number, randomness: RandomnessLevel, settings: RunSettings) => void,
  ) => React.ReactNode;
}) {
  const navigate = useNavigate();
  const asks = useSeasonStore((state) => state.run !== null && !isUntouched(state.run));
  const [pending, setPending] = useState<{
    year: number;
    randomness: RandomnessLevel;
    settings: RunSettings;
  } | null>(null);
  const begin = (year: number, randomness: RandomnessLevel, settings: RunSettings) => {
    start(year, randomness, settings);
    const run = useSeasonStore.getState().run;
    if (run !== null) {
      void navigate(linkTo(cursorPlace(run)));
    }
  };
  return (
    <Shell>
      {picker((year, randomness, settings) => {
        if (asks) {
          setPending({ year, randomness, settings });
        } else {
          begin(year, randomness, settings);
        }
      })}
      <RunConfirmDialog
        open={pending !== null}
        variant="replace"
        onConfirm={() => {
          if (pending !== null) {
            setPending(null);
            begin(pending.year, pending.randomness, pending.settings);
          }
        }}
        onCancel={() => {
          setPending(null);
        }}
      />
    </Shell>
  );
}
