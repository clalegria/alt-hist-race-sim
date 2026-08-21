import { useEffect, useState } from "react";
import { MainMenu } from "./components/MainMenu.js";
import { SeasonPicker } from "./components/SeasonPicker.js";
import { SeasonView } from "./components/SeasonView.js";
import { ThemeToggle } from "./components/ThemeToggle.js";
import { Button } from "./components/ui/button.js";
import type { ModeId } from "./lib/modes.js";
import { useSeasonStore, type View, type World } from "./store/season.js";

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

/** The page frame: sticky bar with the theme toggle, and a centred column. */
function Shell({ bar, children }: { bar?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      {/*
        Sticky, so the way forward is always one click away rather than a scroll
        past a 28-row table. The same buttons repeat at the foot of the page,
        which is where a reader who has just finished reading actually is.
      */}
      <header className="bg-background/85 border-border sticky top-0 z-40 border-b backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          {bar ?? <span />}
          <ThemeToggle />
        </div>
      </header>
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 pb-8 sm:px-6 lg:pb-10">
        {children}
      </div>
    </div>
  );
}

interface SeasonActions {
  readonly view: View;
  readonly rounds: number;
  readonly onNext: () => void;
  readonly onSkip: () => void;
  /** True while the reader is being asked where "start again" should land. */
  readonly confirming: boolean;
  readonly onStartAgain: () => void;
  readonly onMainMenu: () => void;
  readonly onRestart: () => void;
  readonly onCancel: () => void;
}

/**
 * The forward buttons, or — once "Start again" is pressed — the two places it
 * can go.
 *
 * The choice is asked inline rather than in a modal: there is no dialog
 * primitive in here, and adding one for three buttons would buy a dependency
 * and a focus trap to solve a question that fits on the same row. Both copies
 * of this row (sticky bar and page foot) share one confirming flag, so they
 * always show the same thing.
 */
function Actions(props: SeasonActions) {
  if (props.confirming) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground text-xs">Start again from</span>
        <Button variant="outline" onClick={props.onMainMenu}>
          Main menu
        </Button>
        <Button variant="outline" onClick={props.onRestart}>
          Beginning of the season
        </Button>
        <Button variant="ghost" onClick={props.onCancel}>
          Cancel
        </Button>
      </div>
    );
  }

  const actions = actionsFor(props.view, props.rounds);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.next === null ? null : <Button onClick={props.onNext}>{actions.next}</Button>}
      {actions.skip === null ? null : (
        <Button variant="outline" onClick={props.onSkip}>
          {actions.skip}
        </Button>
      )}
      {props.view.kind === "grid" ? null : (
        <Button variant="outline" onClick={props.onStartAgain}>
          Start again
        </Button>
      )}
    </div>
  );
}

function SeasonScreen({ world, view }: { world: World; view: View }) {
  const nextSession = useSeasonStore((state) => state.nextSession);
  const skipToEnd = useSeasonStore((state) => state.skipToEnd);
  const restartSeason = useSeasonStore((state) => state.restartSeason);
  const openMenu = useSeasonStore((state) => state.openMenu);
  const setRatingMode = useSeasonStore((state) => state.setRatingMode);

  // Purely about what the reader is being asked, so it stays out of the store:
  // the rule is that *simulation* state lives there, not that React may hold
  // nothing at all.
  const [confirming, setConfirming] = useState(false);

  const rounds = world.season.races.length;
  const actionProps: SeasonActions = {
    view,
    rounds,
    onNext: nextSession,
    onSkip: skipToEnd,
    confirming,
    onStartAgain: () => {
      setConfirming(true);
    },
    onMainMenu: () => {
      setConfirming(false);
      openMenu();
    },
    onRestart: () => {
      setConfirming(false);
      restartSeason();
    },
    onCancel: () => {
      setConfirming(false);
    },
  };

  return (
    <Shell
      bar={
        <div className="flex flex-1 flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight">{world.year} Season</span>
            <span className="text-muted-foreground text-xs">{stageLabel(view, rounds)}</span>
          </div>
          <Actions {...actionProps} />
        </div>
      }
    >
      <div className="pt-8 lg:pt-10">
        <SeasonView world={world} view={view} onRatingModeChange={setRatingMode} />
      </div>

      <div className="border-border flex flex-wrap items-center gap-3 border-t pt-6">
        <Actions {...actionProps} />
      </div>

      <footer className="text-muted-foreground/70 text-xs">
        Seed <span className="font-mono tabular-nums">{world.seed}</span>
      </footer>
    </Shell>
  );
}

export function App() {
  const screen = useSeasonStore((state) => state.screen);
  const openSeasonSetup = useSeasonStore((state) => state.openSeasonSetup);
  const openMenu = useSeasonStore((state) => state.openMenu);
  const startSeason = useSeasonStore((state) => state.startSeason);

  // Each stage is a new page of results, so it starts at the top. Without this,
  // stepping on from a race — where the buttons sit below two championship
  // tables — drops the reader into the middle of the next one.
  // biome-ignore lint/correctness/useExhaustiveDependencies: firing on every screen change is the point, including a rewind that lands back on the same stage.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [screen]);

  switch (screen.kind) {
    case "menu":
      return (
        <Shell>
          <MainMenu
            onChoose={(mode: ModeId) => {
              if (mode === "season") {
                openSeasonSetup();
              }
            }}
          />
        </Shell>
      );
    case "season-setup":
      return (
        <Shell>
          <SeasonPicker onStart={startSeason} onBack={openMenu} />
        </Shell>
      );
    case "season":
      return <SeasonScreen world={screen.world} view={screen.view} />;
  }
}
