import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Shell } from "../App.js";
import { HomeParade } from "../components/HomeParade.js";
import { KeptLiveries, Liveries } from "../components/Liveries.js";
import { MainMenu } from "../components/MainMenu.js";
import { ResumeRun, RunNotResumed } from "../components/ResumeRun.js";
import { RunConfirmDialog } from "../components/RunDialogs.js";
import { TeamCar } from "../components/TeamCar.js";
import { runBarFor, runLeader, runTitle } from "../lib/run-bar.js";
import { linkTo } from "../lib/run-places.js";
import { cursorPlace, isUntouched, type Run, useSeasonStore } from "../store/season.js";

/**
 * `/` — the opening screen: what this is, which mode to run, and the run in
 * progress, with a parade of cars across it now and then.
 */
export const Route = createFileRoute("/")({ component: HomePage });

/** The run in progress, as `ResumeRun` draws it. */
function LiveSession({ run, onExit }: { run: Run; onExit: () => void }) {
  const bar = runBarFor(run);
  const leader = runLeader(run);
  return (
    <ResumeRun
      title={runTitle(run)}
      detail={bar.cursor}
      rounds={bar.rounds}
      roundsRun={bar.roundsRun}
      {...(leader === null
        ? {}
        : {
            // The providers the run's frame wraps its pages in (`App.tsx`), so the
            // car is painted as the run's own pages paint it.
            car: (
              <KeptLiveries from={run.world.liveriesKeptFrom}>
                <Liveries year={leader.year}>
                  <TeamCar teamId={leader.teamId} />
                </Liveries>
              </KeptLiveries>
            ),
          })}
      link={linkTo(cursorPlace(run))}
      onExit={onExit}
    />
  );
}

function HomePage() {
  const navigate = useNavigate();
  const run = useSeasonStore((state) => state.run);
  const exitRun = useSeasonStore((state) => state.exitRun);
  const resumeFailed = useSeasonStore((state) => state.resumeFailed);
  const dismissResumeFailed = useSeasonStore((state) => state.dismissResumeFailed);
  const [asking, setAsking] = useState(false);
  return (
    <Shell>
      <HomeParade />
      <MainMenu
        {...(run === null
          ? resumeFailed
            ? { resume: <RunNotResumed onDismiss={dismissResumeFailed} /> }
            : {}
          : {
              resume: (
                <LiveSession
                  run={run}
                  onExit={() => {
                    // Nothing to lose, so nothing to ask.
                    if (isUntouched(run)) {
                      exitRun();
                    } else {
                      setAsking(true);
                    }
                  }}
                />
              ),
            })}
        onChoose={(mode) => {
          if (mode === "season") {
            void navigate({ to: "/season/new" });
          } else if (mode === "era-basic") {
            void navigate({ to: "/era/new" });
          }
        }}
      />
      <RunConfirmDialog
        open={asking && run !== null}
        variant="exit"
        onConfirm={() => {
          setAsking(false);
          exitRun();
        }}
        onCancel={() => {
          setAsking(false);
        }}
      />
    </Shell>
  );
}
