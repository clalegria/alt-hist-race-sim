import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Shell } from "../App.js";
import { MainMenu } from "../components/MainMenu.js";
import { ResumeRun } from "../components/ResumeRun.js";
import { RunConfirmDialog } from "../components/RunDialogs.js";
import { runBarFor, runTitle } from "../lib/run-bar.js";
import { linkTo } from "../lib/run-places.js";
import { cursorPlace, isUntouched, useSeasonStore } from "../store/season.js";

/** `/` — the opening screen: what this is, which mode to run, and the run in progress. */
export const Route = createFileRoute("/")({ component: HomePage });

function HomePage() {
  const navigate = useNavigate();
  const run = useSeasonStore((state) => state.run);
  const exitRun = useSeasonStore((state) => state.exitRun);
  const [asking, setAsking] = useState(false);
  return (
    <Shell>
      <MainMenu
        {...(run === null
          ? {}
          : {
              resume: (
                <ResumeRun
                  title={runTitle(run)}
                  detail={runBarFor(run).cursor}
                  link={linkTo(cursorPlace(run))}
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
