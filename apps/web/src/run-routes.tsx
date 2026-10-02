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
import { useEffect, useState } from "react";
import { RunFrame, SeasonPage, Shell } from "./App.js";
import { EraChampions } from "./components/EraChampions.js";
import { RunConfirmDialog } from "./components/RunDialogs.js";
import { crumbsFor } from "./lib/run-bar.js";
import {
  isBackPastStart,
  linkTo,
  type RunPage,
  type RunParams,
  resolveRunPage,
  runPageOf,
} from "./lib/run-places.js";
import { cursorPlace, useSeasonStore } from "./store/season.js";

/**
 * The `beforeLoad` of every page inside `/run`: home when there is no run, the
 * cursor when the URL names a place the run does not have or has not reached,
 * and through otherwise. It runs on every navigation to the page, before it
 * renders, so a stray URL never draws.
 */
export function guardRunPage(page: RunPage, params: RunParams): void {
  const run = useSeasonStore.getState().run;
  if (run === null) {
    throw redirect({ to: "/", replace: true });
  }
  const resolved = resolveRunPage(run, page, params);
  if (resolved.kind === "redirect") {
    throw redirect({ ...resolved.to, replace: true });
  }
}

/**
 * The page at one URL inside `/run`.
 *
 * Resolves again on every render, not only in the guard, because the store can
 * move under a page without a navigation — Restart season on a race leaves its
 * URL naming a session the new season has not revealed — and a page that
 * cannot be shown goes to the cursor rather than drawing something stale.
 */
export function RunPlacePage({ page, params }: { page: RunPage; params: RunParams }) {
  const run = useSeasonStore((state) => state.run);
  const switchSeasonYear = useSeasonStore((state) => state.switchSeasonYear);
  const navigate = useNavigate();
  if (run === null) {
    // Drawn for an instant between an exit and the navigation it starts.
    return null;
  }
  const resolved = resolveRunPage(run, page, params);
  switch (resolved.kind) {
    case "redirect":
      return <Navigate {...resolved.to} replace />;
    case "review":
      return <EraChampions run={resolved.run} />;
    case "season":
      return (
        <SeasonPage
          world={resolved.world}
          view={resolved.view}
          {...(run.kind === "era" ? { run: run.run } : {})}
          locked={resolved.view.kind === "grid" && !resolved.editable}
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
  // so a Back after an exit is just a Back.
  const blocker = useBlocker({
    shouldBlockFn: ({ action, current, next }) =>
      isBackPastStart(action, current.pathname, next.pathname),
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

  // The trail is to the page on screen, which the router's deepest match names.
  const leaf = matches.at(-1);
  const page = leaf === undefined ? null : runPageOf(leaf.routeId);
  const resolved = page === null ? null : resolveRunPage(run, page, leaf?.params as RunParams);
  const place =
    resolved === null || resolved.kind === "redirect" ? cursorPlace(run) : resolved.place;

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
 * about). Starting while a run is already in progress ends that run, so it asks
 * first, in the same dialog every other way out of a run uses.
 */
export function SetupPage({
  start,
  picker,
}: {
  start: (year: number, randomness: RandomnessLevel) => void;
  picker: (onStart: (year: number, randomness: RandomnessLevel) => void) => React.ReactNode;
}) {
  const navigate = useNavigate();
  const hasRun = useSeasonStore((state) => state.run !== null);
  const [pending, setPending] = useState<{ year: number; randomness: RandomnessLevel } | null>(
    null,
  );
  const begin = (year: number, randomness: RandomnessLevel) => {
    start(year, randomness);
    const run = useSeasonStore.getState().run;
    if (run !== null) {
      void navigate(linkTo(cursorPlace(run)));
    }
  };
  return (
    <Shell>
      {picker((year, randomness) => {
        if (hasRun) {
          setPending({ year, randomness });
        } else {
          begin(year, randomness);
        }
      })}
      <RunConfirmDialog
        open={pending !== null}
        variant="replace"
        onConfirm={() => {
          if (pending !== null) {
            setPending(null);
            begin(pending.year, pending.randomness);
          }
        }}
        onCancel={() => {
          setPending(null);
        }}
      />
    </Shell>
  );
}
