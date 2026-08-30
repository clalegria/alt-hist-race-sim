import { useEffect, useState } from "react";
import { EraChampions } from "./components/EraChampions.js";
import { MainMenu } from "./components/MainMenu.js";
import { EraPicker, SeasonPicker } from "./components/SeasonPicker.js";
import { SeasonView } from "./components/SeasonView.js";
import { SiteFooter } from "./components/SiteFooter.js";
import { ThemeToggle } from "./components/ThemeToggle.js";
import { Button } from "./components/ui/button.js";
import { YearPicker } from "./components/YearPicker.js";
import type { ModeId } from "./lib/modes.js";
import { adjacentSeason, isPlayable, nextEraYear, PLAYABLE_SEASONS } from "./lib/seasons.js";
import { type EraRun, useSeasonStore, type View, type World } from "./store/season.js";

/**
 * What each button says, per stage — the two forward ones, and the way back off
 * the grid. Null means the button is absent.
 *
 * Pure, and exported, because the button set *is* the navigation: getting it
 * wrong strands the reader mid-season with no way on.
 *
 * `inEra` is the only thing the era mode changes here, and it changes exactly
 * one stage: a standalone season *ends* at its summary and offers nothing
 * forward, where a season inside an era has a next page — the champions crowned
 * so far. Every other stage is the same screen with the same buttons, which is
 * the point of running the era on the season flow rather than beside it.
 */
export function actionsFor(
  view: View,
  rounds: number,
  inEra = false,
): { next: string | null; skip: string | null; back: string | null } {
  switch (view.kind) {
    case "grid":
      // The grid has revealed nothing yet, so leaving it costs the reader
      // nothing and needs no confirming: one button, straight back to the page
      // it came from. Past here that job belongs to "Start again", which has a
      // season on screen to ask about.
      return { next: "Simulate next session", skip: "Simulate full season", back: "Back" };
    case "qualifying":
      return { next: "Simulate next session", skip: "Simulate rest of the season", back: null };
    case "race":
      // Nothing left to skip past once the last race has been run.
      return view.round + 1 < rounds
        ? { next: "Simulate next session", skip: "Simulate rest of the season", back: null }
        : { next: "Show season summary", skip: null, back: null };
    case "summary":
      return inEra
        ? { next: "Show champions so far", skip: null, back: null }
        : { next: null, skip: null, back: null };
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

/**
 * The two ways on from the roll of honour: the next year, and the far end.
 *
 * `next` is the year that follows the last one crowned, and `rest` the year the
 * era can run to in one go — null for each where the button should not be
 * drawn. Pure and exported for the same reason `actionsFor` is: which buttons a
 * screen offers *is* its navigation, and this is the one screen a reader can be
 * stranded on with nothing forward.
 *
 * `rest` is null at the end of the range, and also when the next year *is* the
 * end: two buttons that do the same thing is a worse offer than one. It is both
 * the far end of the jump the second button opens and the year that jump
 * defaults to, so where there is nowhere past the next year to jump *to*, there
 * is no button either.
 */
export function eraActionsFor(lastCrowned: number | undefined): {
  next: number | null;
  rest: number | null;
} {
  const next = lastCrowned === undefined ? null : nextEraYear(lastCrowned);
  const end = PLAYABLE_SEASONS.at(-1);
  return { next, rest: next === null || end === undefined || next === end ? null : end };
}

/**
 * Which year a jump forward will actually run to.
 *
 * The reader picks a year in a picker that outlives the jump it describes — the
 * roll of honour re-renders with the era four seasons longer and the same year
 * still selected — so a chosen year is only honoured while it is still ahead of
 * the run and still has a season behind it. Anything else falls back to `rest`,
 * the far end, which is also what an untouched picker means.
 *
 * Pure and exported for the same reason the two beside it are: it decides what
 * a button does, and a stale year here would either do nothing or quietly run
 * the era to 2026.
 */
export function eraJumpTarget(
  lastCrowned: number | undefined,
  chosen: number | null,
): number | null {
  const { next, rest } = eraActionsFor(lastCrowned);
  // Where there is no jump to make there is no target, whatever was picked:
  // `rest` being null is the screen saying it draws no jump button at all.
  if (rest === null || next === null) {
    return null;
  }
  return chosen !== null && chosen >= next && isPlayable(chosen) ? chosen : rest;
}

/**
 * What the sticky bar calls the season on screen.
 *
 * Inside an era it also says which run it belongs to, because a reader four
 * years in has no other reminder that stepping off this summary goes to a roll
 * of honour rather than nowhere.
 */
export function seasonLabel(year: number, run?: EraRun): string {
  return run === undefined ? `${year} Season` : `${year} Season — era from ${run.startYear}`;
}

/**
 * The page frame: sticky bar with the theme toggle, a centred column, and the
 * site footer.
 *
 * The footer is rendered here rather than by each screen so that every screen
 * has one — the attribution belongs to the app, not to the season screen that
 * happened to have a seed worth printing. `seed` is the only part that varies,
 * and only the season screen passes it.
 */
function Shell({
  bar,
  seed,
  children,
}: {
  bar?: React.ReactNode;
  seed?: number;
  children: React.ReactNode;
}) {
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
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-5xl flex-col gap-6 px-4 pb-8 sm:px-6 lg:pb-10">
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
 * The sticky-bar content for a screen that is only a choice: one way back.
 *
 * In the bar rather than under the choice itself, so every screen keeps its
 * navigation in the same place — the season screen's buttons sit here too, and
 * a Back button below six rows of year buttons is somewhere nobody looks.
 *
 * Pushed to the right end of the bar, up against the theme toggle, because that
 * is where the season screen's buttons sit: navigation is always the right-hand
 * side of the bar, whatever screen the reader is on.
 */
export function BackBar({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
      <Button variant="outline" onClick={onBack}>
        Back
      </Button>
    </div>
  );
}

interface SeasonActions {
  readonly view: View;
  readonly rounds: number;
  /** Present only inside an era, which changes the summary's way forward. */
  readonly run?: EraRun | undefined;
  readonly onNext: () => void;
  readonly onSkip: () => void;
  /** True while the reader is being asked where "start again" should land. */
  readonly confirming: boolean;
  /** True while the grid is being rearranged, which is not a moment to step on. */
  readonly editingGrid: boolean;
  readonly onStartAgain: () => void;
  /** Out of the grid, back to the page that opened it. */
  readonly onBack: () => void;
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
  if (props.editingGrid) {
    // No way forward while a grid is half-rearranged: the draft would go with
    // it, and the season simulated would be the one the reader was replacing.
    return (
      <span className="text-muted-foreground text-xs">
        Editing the grid. Apply or cancel it to carry on.
      </span>
    );
  }

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

  const actions = actionsFor(props.view, props.rounds, props.run !== undefined);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.next === null ? null : <Button onClick={props.onNext}>{actions.next}</Button>}
      {actions.skip === null ? null : (
        <Button variant="outline" onClick={props.onSkip}>
          {actions.skip}
        </Button>
      )}
      {/* The same trailing slot in both cases: the way off this screen. */}
      {actions.back === null ? null : (
        <Button variant="outline" onClick={props.onBack}>
          {actions.back}
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

/**
 * A season being revealed — standalone, or one year of an era.
 *
 * One screen for both. An era is the season flow run again and again, so a
 * second copy of this with a different header is exactly the duplication the
 * mode was meant not to need: what differs is the run carried alongside, which
 * changes where the summary leads and where the grid's Back goes, whether the
 * ability toggle is offered at all, and nothing else.
 *
 * Exported for the tests, like `actionsFor` beside it: `run` is a prop, so both
 * cases render statically. The app as a whole cannot be — Zustand serves a
 * *server* snapshot of its initial state to `renderToStaticMarkup`, so a driven
 * store never reaches the markup and every such render is the opening menu.
 */
export function SeasonScreen({ world, view, run }: { world: World; view: View; run?: EraRun }) {
  const nextSession = useSeasonStore((state) => state.nextSession);
  const skipToEnd = useSeasonStore((state) => state.skipToEnd);
  const restartSeason = useSeasonStore((state) => state.restartSeason);
  const openMenu = useSeasonStore((state) => state.openMenu);
  const openSeasonSetup = useSeasonStore((state) => state.openSeasonSetup);
  const showEraChampions = useSeasonStore((state) => state.showEraChampions);
  const leaveEraSeason = useSeasonStore((state) => state.leaveEraSeason);
  const setRatingMode = useSeasonStore((state) => state.setRatingMode);
  const switchSeasonYear = useSeasonStore((state) => state.switchSeasonYear);
  const setGrid = useSeasonStore((state) => state.setGrid);

  // Purely about what the reader is being asked, so it stays out of the store:
  // the rule is that *simulation* state lives there, not that React may hold
  // nothing at all.
  const [confirming, setConfirming] = useState(false);
  const [editingGrid, setEditingGrid] = useState(false);

  const inEra = run !== undefined;
  const rounds = world.season.races.length;
  // The grid the reader actually watched last year, for the editor's carry-over
  // button — the era's own history rather than the seed file's, since inside an
  // era last season may itself have been rewritten. A standalone season has no
  // year behind it and gets null, which the editor reads as "copy history".
  const previousYear = adjacentSeason(world.year, -1);
  const previousLineup =
    previousYear === null
      ? null
      : (run?.seasons.find((season) => season.year === previousYear)?.lineup ?? null);
  const actionProps: SeasonActions = {
    view,
    rounds,
    run,
    // The summary is the one stage an era takes somewhere else: on to the
    // champions, crowning this year on the way.
    onNext: inEra && view.kind === "summary" ? showEraChampions : nextSession,
    onSkip: skipToEnd,
    confirming,
    editingGrid: editingGrid && view.kind === "grid",
    onStartAgain: () => {
      setConfirming(true);
    },
    onBack: inEra ? leaveEraSeason : openSeasonSetup,
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
      seed={world.seed}
      bar={
        <div className="flex flex-1 flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight">
              {seasonLabel(world.year, run)}
            </span>
            <span className="text-muted-foreground text-xs">{stageLabel(view, rounds)}</span>
          </div>
          <Actions {...actionProps} />
        </div>
      }
    >
      <div className="pt-8 lg:pt-10">
        <SeasonView
          world={world}
          view={view}
          // An era is fixed at `ERA_RATING_MODE` and offers no switch, so the
          // handler is not passed either — the store would refuse it anyway, and
          // wiring a control that cannot fire is how one comes back by accident.
          canChooseAbility={run === undefined}
          previousLineup={previousLineup}
          {...(run === undefined
            ? { onRatingModeChange: setRatingMode, onYearChange: switchSeasonYear }
            : {})}
          onGridChange={(edit) => {
            setGrid(edit.lineup, edit.engines);
          }}
          onGridEditingChange={setEditingGrid}
        />
      </div>

      <div className="border-border flex flex-wrap items-center gap-3 border-t pt-6">
        <Actions {...actionProps} />
      </div>
    </Shell>
  );
}

/**
 * The roll-up between two years: what the era has crowned, and the way on.
 *
 * The buttons are here rather than inside `EraChampions` for the same reason
 * every other screen's are in the bar — navigation is the right-hand end of the
 * bar on every page — and so the roll-up itself stays a pure render of a run.
 *
 * Two of the three ways on ask something first, and both ask it inline, in the
 * button row itself, exactly as "Start again" does on the season screen: no
 * dialog primitive, one flag shared by both copies of the row so they never
 * disagree. **Jumping forward** opens a year picker over the roll of honour —
 * the same `YearPicker` the setup screens use, restricted to years the era has
 * not reached — defaulting to the far end, which is what the button used to do
 * outright. **Main menu** throws the run away and there is no save file yet, so
 * it confirms rather than going on a single click.
 */
function EraChampionsScreen({ run }: { run: EraRun }) {
  const nextEraSeason = useSeasonStore((state) => state.nextEraSeason);
  const simulateRestOfEra = useSeasonStore((state) => state.simulateRestOfEra);
  const openMenu = useSeasonStore((state) => state.openMenu);
  const lastCrowned = run.seasons.at(-1)?.year;
  const onward = eraActionsFor(lastCrowned);

  // What the reader is being asked, which is not simulation state and so stays
  // out of the store — the same split the season screen's `confirming` makes.
  const [asking, setAsking] = useState<"jump" | "menu" | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const target = eraJumpTarget(lastCrowned, chosen);
  const jumping = asking === "jump" && target !== null;

  const actions =
    asking === "menu" ? (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground text-xs">Leave the era? It is not saved.</span>
        <Button
          variant="outline"
          onClick={() => {
            setAsking(null);
            openMenu();
          }}
        >
          Main menu
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setAsking(null);
          }}
        >
          Cancel
        </Button>
      </div>
    ) : jumping ? (
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() => {
            setAsking(null);
            simulateRestOfEra(target);
          }}
        >
          Simulate through to {target}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setAsking(null);
          }}
        >
          Cancel
        </Button>
      </div>
    ) : (
      <div className="flex flex-wrap items-center gap-2">
        {onward.next === null ? null : (
          <Button onClick={nextEraSeason}>Simulate {onward.next}</Button>
        )}
        {onward.rest === null ? null : (
          <Button
            variant="outline"
            onClick={() => {
              setAsking("jump");
            }}
          >
            Jump forward
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() => {
            setAsking("menu");
          }}
        >
          Main menu
        </Button>
      </div>
    );

  return (
    <Shell
      bar={
        <div className="flex flex-1 flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight">Era from {run.startYear}</span>
            <span className="text-muted-foreground text-xs">Between seasons</span>
          </div>
          {actions}
        </div>
      }
    >
      {/*
        Above the roll of honour rather than below it: the screen is scrolled to
        the top when it opens, and a picker under twenty crowned seasons is a
        panel nobody would find.
      */}
      {jumping ? (
        <div className="pt-6">
          <YearPicker
            year={target}
            onSelect={setChosen}
            title="Jump forward to"
            lead={`Every season from ${lastCrowned === undefined ? "" : lastCrowned + 1} on is simulated in one go, and the era stops on the year you pick. Nothing after it is run, so you can carry on from there.`}
            describeYear={(year) => `Simulate the era through to ${year}`}
            // Only years the era has ahead of it: a year already crowned is
            // history this run has written, and the store refuses it anyway.
            playable={(year) => isPlayable(year) && onward.next !== null && year >= onward.next}
          />
        </div>
      ) : null}

      <EraChampions run={run} />
      <div className="border-border flex flex-wrap items-center gap-3 border-t pt-6">{actions}</div>
    </Shell>
  );
}

export function App() {
  const screen = useSeasonStore((state) => state.screen);
  const openSeasonSetup = useSeasonStore((state) => state.openSeasonSetup);
  const openEraSetup = useSeasonStore((state) => state.openEraSetup);
  const openMenu = useSeasonStore((state) => state.openMenu);
  const startSeason = useSeasonStore((state) => state.startSeason);
  const startEra = useSeasonStore((state) => state.startEra);

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
              } else if (mode === "era-basic") {
                openEraSetup();
              }
            }}
          />
        </Shell>
      );
    case "season-setup":
      return (
        <Shell bar={<BackBar onBack={openMenu} />}>
          <SeasonPicker onStart={startSeason} />
        </Shell>
      );
    case "season":
      return <SeasonScreen world={screen.world} view={screen.view} />;
    case "era-setup":
      return (
        <Shell bar={<BackBar onBack={openMenu} />}>
          <EraPicker onStart={startEra} />
        </Shell>
      );
    case "era":
      return <SeasonScreen world={screen.world} view={screen.view} run={screen.run} />;
    case "era-champions":
      return <EraChampionsScreen run={screen.run} />;
  }
}
