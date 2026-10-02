import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Shell } from "../App.js";
import { MainMenu } from "../components/MainMenu.js";
import { ResumeRun } from "../components/ResumeRun.js";
import { runBarFor, runTitle } from "../lib/run-bar.js";
import { linkTo } from "../lib/run-places.js";
import { cursorPlace, useSeasonStore } from "../store/season.js";

/** `/` — the opening screen: what this is, which mode to run, and the run in progress. */
export const Route = createFileRoute("/")({ component: HomePage });

function HomePage() {
  const navigate = useNavigate();
  const run = useSeasonStore((state) => state.run);
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
    </Shell>
  );
}
