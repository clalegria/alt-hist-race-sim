import { useEffect } from "react";
import { SeasonView } from "./components/SeasonView.js";
import { ThemeToggle } from "./components/ThemeToggle.js";
import { Button } from "./components/ui/button.js";
import { useSeasonStore, type View } from "./store/season.js";

/**
 * What the two forward buttons say, per stage. Null means the button is absent.
 *
 * Pure, and exported, because the button set *is* the navigation: getting it
 * wrong strands the reader mid-season with no way on.
 */
export function actionsFor(
  view: View,
  rounds: number,
): { next: string | null; skip: string | null } {
  switch (view.kind) {
    case "grid":
      return { next: "Simulate next session", skip: "Simulate full season" };
    case "qualifying":
      return { next: "Simulate next session", skip: "Simulate rest of the season" };
    case "race":
      // Nothing left to skip past once the last race has been run.
      return view.round + 1 < rounds
        ? { next: "Simulate next session", skip: "Simulate rest of the season" }
        : { next: "Show season summary", skip: null };
    case "summary":
      return { next: null, skip: null };
  }
}

/** Where in the season we are, short enough for the sticky bar. */
export function stageLabel(view: View, rounds: number): string {
  switch (view.kind) {
    case "grid":
      return "Grid";
    case "qualifying":
      return `Round ${view.round + 1}/${rounds} — Qualifying`;
    case "race":
      return `Round ${view.round + 1}/${rounds} — Race`;
    case "summary":
      return "Season summary";
  }
}

function Actions({
  view,
  rounds,
  onNext,
  onSkip,
  onRestart,
}: {
  view: View;
  rounds: number;
  onNext: () => void;
  onSkip: () => void;
  onRestart: () => void;
}) {
  const actions = actionsFor(view, rounds);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.next === null ? null : <Button onClick={onNext}>{actions.next}</Button>}
      {actions.skip === null ? null : (
        <Button variant="outline" onClick={onSkip}>
          {actions.skip}
        </Button>
      )}
      {view.kind === "grid" ? null : (
        <Button variant="outline" onClick={onRestart}>
          Start again
        </Button>
      )}
    </div>
  );
}

export function App() {
  const world = useSeasonStore((state) => state.world);
  const view = useSeasonStore((state) => state.view);
  const nextSession = useSeasonStore((state) => state.nextSession);
  const skipToEnd = useSeasonStore((state) => state.skipToEnd);
  const startAgain = useSeasonStore((state) => state.startAgain);

  const rounds = world.season.races.length;

  // Each stage is a new page of results, so it starts at the top. Without this,
  // stepping on from a race — where the buttons sit below two championship
  // tables — drops the reader into the middle of the next one.
  // biome-ignore lint/correctness/useExhaustiveDependencies: firing on every stage change is the point, including a restart that lands back on the same stage.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view, world.seed]);

  const actionProps = {
    view,
    rounds,
    onNext: nextSession,
    onSkip: skipToEnd,
    onRestart: startAgain,
  };

  return (
    <div className="min-h-dvh">
      {/*
        Sticky, so the way forward is always one click away rather than a scroll
        past a 28-row table. The same buttons repeat at the foot of the page,
        which is where a reader who has just finished reading actually is.
      */}
      <header className="bg-background/85 border-border sticky top-0 z-40 border-b backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight">{world.year} Season</span>
            <span className="text-muted-foreground text-xs">{stageLabel(view, rounds)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Actions {...actionProps} />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:py-10">
        <SeasonView world={world} view={view} />

        <div className="border-border flex flex-wrap items-center gap-3 border-t pt-6">
          <Actions {...actionProps} />
        </div>

        <footer className="text-muted-foreground/70 text-xs">
          Seed <span className="font-mono tabular-nums">{world.seed}</span>
        </footer>
      </div>
    </div>
  );
}
