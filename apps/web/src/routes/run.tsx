import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { EraChampionsScreen, SeasonScreen } from "../App.js";
import { useSeasonStore } from "../store/season.js";

/**
 * `/run` — the run in progress, whichever stage of it the reader is on.
 *
 * The whole reveal lives on this one URL for now: the cursor is in the store,
 * and a page per session arrives with the timeline (`docs/design/app-shell.md`).
 *
 * `beforeLoad` runs before the route renders, on every navigation to it, and
 * sends a reader with no run home: a typed URL, a reload (nothing survives one
 * yet), or browser-forward onto a run that has since been exited.
 */
export const Route = createFileRoute("/run")({
  beforeLoad: () => {
    if (useSeasonStore.getState().run === null) {
      throw redirect({ to: "/", replace: true });
    }
  },
  component: RunPage,
});

function RunPage() {
  const run = useSeasonStore((state) => state.run);
  const exitRun = useSeasonStore((state) => state.exitRun);
  const leaveEraSeason = useSeasonStore((state) => state.leaveEraSeason);
  const navigate = useNavigate();

  // Each stage is a new page of results, so it starts at the top. Without this,
  // stepping on from a race — where the buttons sit below two championship
  // tables — drops the reader into the middle of the next one. A change of
  // route scrolls to the top by itself; this is for the cursor moving within one.
  // biome-ignore lint/correctness/useExhaustiveDependencies: firing on every change to the run is the point, including a rewind that lands back on the same stage.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [run]);

  // The explicit ways out discard the run, so the history entry for this page
  // is replaced rather than kept: Back should not lead onto a run that is gone.
  const toMenu = () => {
    exitRun();
    void navigate({ to: "/", replace: true });
  };

  // Rendered for an instant between an exit and the navigation it starts.
  if (run === null) {
    return null;
  }

  switch (run.kind) {
    case "season":
      return (
        <SeasonScreen
          world={run.world}
          view={run.view}
          onBack={() => {
            exitRun();
            void navigate({ to: "/season/new", replace: true });
          }}
          onMainMenu={toMenu}
        />
      );
    case "era":
      return (
        <SeasonScreen
          world={run.world}
          view={run.view}
          run={run.run}
          onBack={() => {
            // Back to the roll-up if a year has been crowned; with none, the
            // run is gone and the reader goes back to the era picker.
            leaveEraSeason();
            if (useSeasonStore.getState().run === null) {
              void navigate({ to: "/era/new", replace: true });
            }
          }}
          onMainMenu={toMenu}
        />
      );
    case "era-champions":
      return <EraChampionsScreen run={run.run} onMainMenu={toMenu} />;
  }
}
