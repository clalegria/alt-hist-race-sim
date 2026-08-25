/**
 * The single world-state store.
 *
 * Everything the simulation knows lives in one plain-data object. No class
 * instances, no functions, no `Rng` — which means `JSON.stringify(world)` is a
 * complete save file, and reloading one is `JSON.parse`. That property is the
 * whole point of keeping state here rather than scattered across components,
 * and there is a test that asserts it survives a round trip.
 *
 * The `Rng` itself is deliberately absent: it holds a closure and cannot be
 * serialized. What is stored is its numeric `getState()` snapshot, which
 * `createRngFromState` turns back into a working generator exactly where the
 * season left off.
 *
 * Above the world sits the `Screen`: which of the app's pages the reader is on.
 * A world only exists on the season screen, so it is a member of that variant
 * rather than a nullable field — the menu cannot accidentally read a season
 * nobody has started, and no code has to guard against it.
 */

import {
  applyEngines,
  applyLineup,
  buildField,
  DEFAULT_RATING_MODE,
  isAuthoredEngines,
  isAuthoredLineup,
  type RatingMode,
  type SeasonEngines,
  type SeasonLineup,
} from "@alt-hist/data";
import {
  createRng,
  type PointsScale,
  type RaceEntrant,
  type RngState,
  type SeasonResult,
  simulateSeason,
} from "@alt-hist/engine";
import { create } from "zustand";
import { readRatingMode, rememberRatingMode } from "../lib/preferences.js";
import { nextEraYear, seasonSeed } from "../lib/seasons.js";
import { nextSeed, randomSeed } from "../lib/seed.js";

/** The serializable world. Add to this and it must stay plain data. */
export interface World {
  readonly seed: number;
  readonly year: number;
  /**
   * Which ratings the field was built from — authored peaks, or each driver's
   * ability in this season. Part of the world because it is a simulation input:
   * the same seed under the other mode is a different championship.
   */
  readonly ratingMode: RatingMode;
  /**
   * The championship points scale the year was scored on, straight from its
   * seed file — 9-6-4-3-2-1 for 1980, 25-18-15-12-10-8-6-4-2-1 for 2010.
   *
   * Held here rather than looked up from the year for the same reason `field`
   * is: this is the record of the season as it was actually run. A save file
   * opened after its year's scale was re-authored should still add up to the
   * totals the reader saw, and every table on screen scores off this one array
   * rather than each deriving its own.
   */
  readonly points: PointsScale;
  /**
   * The generator's position after the last race simulated. Rebuild with
   * `createRngFromState` to continue the same stream into the next season.
   */
  readonly rngState: RngState;
  /**
   * The grid exactly as it was raced — every driver and car rating that fed the
   * simulation. Kept in the world rather than re-read from the seed files
   * because it will stop being derivable from them: once the ageing curve lands,
   * a driver's ratings are rolled per run, and this is the only record of what
   * they actually were.
   */
  readonly field: readonly RaceEntrant[];
  /**
   * The reader's own driver allocation, or null for the grid as history had it.
   *
   * Null rather than a copy of the authored lineup, so "was this grid edited?"
   * is a property of the world rather than a comparison somebody has to
   * remember to make — and so an untouched season serialises to exactly what it
   * always did. `createWorld` normalises an edit that lands back on the
   * authored grid to null, which is why a reader who undoes their last swap
   * stops being told the grid was edited.
   */
  readonly lineup: SeasonLineup | null;
  /**
   * The reader's own engine allocation, or null for the supply deals the season
   * was entered with. Null for exactly the same reason `lineup` is: "was this
   * changed?" should be a property of the world rather than a comparison
   * somebody has to remember to make.
   *
   * Separate from `lineup` because they are separate questions — who drives the
   * car, and what is in the back of it — and a reader can change either without
   * touching the other.
   */
  readonly engines: SeasonEngines | null;
  readonly season: SeasonResult;
}

/**
 * Runs a season from a seed and returns the world it produced.
 *
 * Pure: same seed and year in, same world out, no store involved. The store is
 * a place to keep this, not the thing that computes it.
 */
export function createWorld(
  seed: number,
  year: number,
  ratingMode: RatingMode = DEFAULT_RATING_MODE,
  lineup: SeasonLineup | null = null,
  engines: SeasonEngines | null = null,
): World {
  const authored = seasonSeed(year);
  // An edit that puts everyone back where they started is not an edit, and a
  // season that claimed otherwise would carry a notice nobody could explain.
  const edited = lineup !== null && !isAuthoredLineup(authored, lineup) ? lineup : null;
  const resupplied = engines !== null && !isAuthoredEngines(authored, engines) ? engines : null;
  const withDrivers = edited === null ? authored : applyLineup(authored, edited);
  const entered = resupplied === null ? withDrivers : applyEngines(withDrivers, resupplied);
  const rng = createRng(seed);
  const field = buildField(entered, undefined, ratingMode);
  // The calendar itself, not its length: the round's country is what gives the
  // drivers and teams from it their home advantage.
  const season = simulateSeason(field, entered.calendar, rng);

  return {
    seed,
    year: entered.year,
    ratingMode,
    points: entered.points,
    rngState: rng.getState(),
    field,
    lineup: edited,
    engines: resupplied,
    season,
  };
}

/**
 * How much of the season the reader has been shown.
 *
 * The whole year is simulated the moment a seed is drawn — one continuous RNG
 * stream through every round, which is what makes a season reproducible. This
 * cursor therefore *reveals* a season that already exists rather than driving
 * the simulation. "Simulate next session" is a promise about what the reader
 * sees next, not about when the dice are rolled, and the results are identical
 * either way.
 *
 * Deliberately not part of `World`: where the reader has got to is not
 * simulation state, and a save file should not care.
 */
export type View =
  | { readonly kind: "grid" }
  /** `round` is a zero-based index into `world.season.races`. */
  | { readonly kind: "qualifying"; readonly round: number }
  | { readonly kind: "race"; readonly round: number }
  | { readonly kind: "summary" };

/**
 * A run of seasons — the basic era mode: where it started, and every year
 * already finished, in order.
 *
 * The finished worlds themselves rather than a table of champions, because
 * **results are the source of truth and statistics are derived**: who won 1983
 * is a `championshipStandings` call over the season that is already here, and
 * keeping a champion beside it would be a second copy of a fact nobody has to
 * store. It also means the roll-up can grow a column without the run changing
 * shape. Plain data throughout, like the world it holds, so an era serialises to
 * a save file exactly as one season does.
 *
 * The season currently being revealed is *not* in here — it lives on the era
 * screen beside the run, and joins the list when the reader steps off its
 * summary. So `seasons` is precisely "the years that have been crowned".
 */
export interface EraRun {
  readonly startYear: number;
  readonly seasons: readonly World[];
}

/**
 * Which page the app is on.
 *
 * The menu is the seam every future mode arrives through, so a new one is a new
 * variant here rather than a branch inside the season screen. The era mode is
 * the first to take that route: it reuses the season screen's own reveal, with
 * a run carried alongside and a roll-up between years.
 */
export type Screen =
  /** The opening screen: what this is, and which mode to run. */
  | { readonly kind: "menu" }
  /** Choosing the year to start from. */
  | { readonly kind: "season-setup" }
  /** A season, simulated and being revealed. */
  | { readonly kind: "season"; readonly world: World; readonly view: View }
  /** Choosing the year an era starts from. */
  | { readonly kind: "era-setup" }
  /** One season of an era, revealed exactly as a standalone one is. */
  | {
      readonly kind: "era";
      readonly run: EraRun;
      readonly world: World;
      readonly view: View;
    }
  /** Between years: the champions crowned so far, season by season. */
  | { readonly kind: "era-champions"; readonly run: EraRun };

/**
 * The screens that carry a season being revealed.
 *
 * A standalone season and a season inside an era are the same screen with a
 * different frame around it, so every action over a world — stepping the
 * cursor, skipping, re-running on other ratings or another grid — works on
 * either. Narrowing to this once is what keeps the store from growing a second
 * copy of each of those actions.
 */
export type PlayingScreen = Extract<Screen, { kind: "season" } | { kind: "era" }>;

export function isPlaying(screen: Screen): screen is PlayingScreen {
  return screen.kind === "season" || screen.kind === "era";
}

/**
 * The next thing to show: qualifying, then that race, then the next qualifying,
 * and the summary once the last race has been seen.
 */
export function advance(view: View, rounds: number): View {
  switch (view.kind) {
    case "grid":
      return rounds > 0 ? { kind: "qualifying", round: 0 } : { kind: "summary" };
    case "qualifying":
      return { kind: "race", round: view.round };
    case "race":
      return view.round + 1 < rounds
        ? { kind: "qualifying", round: view.round + 1 }
        : { kind: "summary" };
    case "summary":
      return view;
  }
}

interface SeasonStore {
  readonly screen: Screen;
  /** Back to the opening screen, abandoning whatever season was running. */
  readonly openMenu: () => void;
  /** The year picker, for a single season. */
  readonly openSeasonSetup: () => void;
  /** The year picker, for an era: the year it starts from. */
  readonly openEraSetup: () => void;
  /**
   * Simulates a fresh season of the given year and opens it at the grid, using
   * the remembered ability mode.
   */
  readonly startSeason: (year: number) => void;
  /**
   * The same, from a chosen seed — the reproducible entry point tests use.
   *
   * Deliberately does *not* consult the remembered mode: this is the entry
   * point whose output must depend only on its arguments.
   */
  readonly simulate: (seed: number, year: number, ratingMode?: RatingMode) => void;
  /**
   * Starts an era at the given year: its first season, opened at the grid, with
   * an empty run behind it.
   */
  readonly startEra: (year: number) => void;
  /** The same from a chosen seed, and for the same reason: tests need one. */
  readonly simulateEra: (seed: number, year: number, ratingMode?: RatingMode) => void;
  /**
   * Ends the season on screen and shows the champions crowned so far.
   *
   * The moment a season stops being the one being played and becomes part of
   * the run: this is the only thing that appends to `run.seasons`, so a year
   * cannot be counted twice, and none is crowned before it has been read.
   */
  readonly showEraChampions: () => void;
  /**
   * Leaves the era season on screen without crowning it, back to the page it
   * was reached from: the roll-up if any year has been crowned, the era picker
   * if this is the run's first.
   *
   * The grid's Back, in other words. It exists because a grid inside an era has
   * nowhere else to go — "Start again" is not offered there, since nothing has
   * been revealed to start again *from* — and because leaving a year unread must
   * not add it to the roll of honour.
   */
  readonly leaveEraSeason: () => void;
  /**
   * Runs the next year of the era, on the grid history had that year.
   *
   * **This is the seam the advanced mode replaces.** The field for year N+1
   * comes from that year's seed file and nothing else — no market, no
   * progression model, nothing carried forward but the dice and how the reader
   * chose to play. A mode that simulates the grid instead substitutes what is
   * handed to `createWorld` here, and nothing else about the loop changes.
   *
   * Nothing happens past the end of the authored range: `nextEraYear` says the
   * era stops there, and the screen offers no button to call this.
   */
  readonly nextEraSeason: () => void;
  /**
   * Runs every remaining year of the era in one go, straight to the last
   * authored season.
   *
   * The era's "skip to the end", and it must produce **exactly** the history
   * stepping through would have: each year is built the way `nextEraSeason`
   * builds one, off the year before it, so skipping and playing differ only in
   * what the reader stopped to read. A test asserts the two are identical.
   *
   * None of these years is revealed session by session — they are crowned
   * unread, which is what skipping means everywhere else here too.
   */
  readonly simulateRestOfEra: () => void;
  /**
   * Re-runs the season from the same seed with the other ability model.
   *
   * Only on the grid: past it, the reader has seen results that the new field
   * would not have produced. Keeping the seed makes the two modes comparable —
   * same dice, different drivers.
   */
  readonly setRatingMode: (mode: RatingMode) => void;
  /**
   * Re-runs the season from the same seed with the reader's own grid: who
   * drives what, and what is in the back of it. `null` for either half means
   * that half as the season entered it.
   *
   * One action rather than two because the editor applies one draft — a reader
   * who moved a driver and changed a supplier asked a single question, and
   * applying them separately would simulate a season nobody asked for in
   * between.
   *
   * Grid-only for the same reason as `setRatingMode`: past it, the results on
   * screen were driven by a field that no longer exists. The seed is kept, so
   * an alternate grid is the same dice thrown at different people — which is
   * the comparison the feature is for.
   */
  readonly setGrid: (lineup: SeasonLineup | null, engines: SeasonEngines | null) => void;
  /** Reveals the next session. */
  readonly nextSession: () => void;
  /** Jumps straight to the finished season. */
  readonly skipToEnd: () => void;
  /**
   * Back to the grid of the same *year* and the same ability mode, on a fresh
   * seed.
   *
   * A new draw rather than a rewind: replaying results the reader has already
   * seen is a re-read, and what "start again" has always meant here is another
   * go at the season. Everything *chosen* carries over — the ability mode and
   * an edited grid alike — drivers and engines both — because a reader who put
   * Mansell in the Williams asked for that grid, not for one season of it. Only
   * the dice change. The menu is where a different year comes from.
   *
   * Inside an era it re-runs the current year only. The seasons already crowned
   * stand: they were read, and this one has not been finished.
   */
  readonly restartSeason: () => void;
}

/** A standalone season screen at its opening grid. */
function openSeason(world: World): Screen {
  return { kind: "season", world, view: { kind: "grid" } };
}

/** The screen it already was, showing a different world, back at the grid. */
function replaceWorld(screen: PlayingScreen, world: World): PlayingScreen {
  return screen.kind === "season"
    ? { kind: "season", world, view: { kind: "grid" } }
    : { kind: "era", run: screen.run, world, view: { kind: "grid" } };
}

export const useSeasonStore = create<SeasonStore>((set) => ({
  // Nothing is simulated until a mode is chosen: the app opens on the menu, and
  // a season nobody asked for is neither shown nor computed.
  screen: { kind: "menu" },
  openMenu: () => {
    set({ screen: { kind: "menu" } });
  },
  openSeasonSetup: () => {
    set({ screen: { kind: "season-setup" } });
  },
  openEraSetup: () => {
    set({ screen: { kind: "era-setup" } });
  },
  startSeason: (year) => {
    set({ screen: openSeason(createWorld(randomSeed(), year, readRatingMode())) });
  },
  simulate: (seed, year, ratingMode) => {
    set({ screen: openSeason(createWorld(seed, year, ratingMode)) });
  },
  startEra: (year) => {
    set({
      screen: {
        kind: "era",
        run: { startYear: year, seasons: [] },
        world: createWorld(randomSeed(), year, readRatingMode()),
        view: { kind: "grid" },
      },
    });
  },
  simulateEra: (seed, year, ratingMode) => {
    set({
      screen: {
        kind: "era",
        run: { startYear: year, seasons: [] },
        world: createWorld(seed, year, ratingMode),
        view: { kind: "grid" },
      },
    });
  },
  showEraChampions: () => {
    set((state) =>
      state.screen.kind === "era"
        ? {
            screen: {
              kind: "era-champions",
              run: {
                startYear: state.screen.run.startYear,
                seasons: [...state.screen.run.seasons, state.screen.world],
              },
            },
          }
        : state,
    );
  },
  leaveEraSeason: () => {
    set((state) =>
      state.screen.kind === "era"
        ? {
            screen:
              state.screen.run.seasons.length === 0
                ? { kind: "era-setup" }
                : { kind: "era-champions", run: state.screen.run },
          }
        : state,
    );
  },
  nextEraSeason: () => {
    set((state) => {
      if (state.screen.kind !== "era-champions") {
        return state;
      }
      const last = state.screen.run.seasons.at(-1);
      const year = last === undefined ? null : nextEraYear(last.year);
      if (last === undefined || year === null) {
        return state;
      }
      return {
        screen: {
          kind: "era",
          run: state.screen.run,
          // The next year's dice continue the last year's stream, and its grid
          // is that year's own entry list. What the reader chose about *how to
          // play* — the ability mode — carries; what they chose about one grid
          // does not, because it was a grid for a year now behind them.
          world: createWorld(nextSeed(last.rngState), year, last.ratingMode),
          view: { kind: "grid" },
        },
      };
    });
  },
  simulateRestOfEra: () => {
    set((state) => {
      if (state.screen.kind !== "era-champions") {
        return state;
      }
      const seasons = [...state.screen.run.seasons];
      let last = seasons.at(-1);
      // Nothing left to run is nothing to do — and returning the state itself
      // rather than an equal copy keeps the screen from re-rendering the whole
      // roll of honour for a button press that changed nothing.
      if (last === undefined || nextEraYear(last.year) === null) {
        return state;
      }
      // The same step `nextEraSeason` takes, taken until the data runs out:
      // that year's own entry list, and dice continuing the year before's
      // stream. Written as a loop rather than a second rule so the two cannot
      // produce different histories.
      for (let year = nextEraYear(last.year); year !== null; year = nextEraYear(last.year)) {
        last = createWorld(nextSeed(last.rngState), year, last.ratingMode);
        seasons.push(last);
      }
      return {
        screen: {
          kind: "era-champions",
          run: { startYear: state.screen.run.startYear, seasons },
        },
      };
    });
  },
  setRatingMode: (mode) => {
    // Remembered even if the switch itself is a no-op, so the choice survives
    // whatever the reader does next.
    rememberRatingMode(mode);
    set((state) =>
      isPlaying(state.screen) && state.screen.view.kind === "grid"
        ? {
            screen: replaceWorld(
              state.screen,
              createWorld(
                state.screen.world.seed,
                state.screen.world.year,
                mode,
                state.screen.world.lineup,
                state.screen.world.engines,
              ),
            ),
          }
        : state,
    );
  },
  setGrid: (lineup, engines) => {
    set((state) =>
      isPlaying(state.screen) && state.screen.view.kind === "grid"
        ? {
            screen: replaceWorld(
              state.screen,
              createWorld(
                state.screen.world.seed,
                state.screen.world.year,
                state.screen.world.ratingMode,
                lineup,
                engines,
              ),
            ),
          }
        : state,
    );
  },
  nextSession: () => {
    set((state) =>
      isPlaying(state.screen)
        ? {
            screen: {
              ...state.screen,
              view: advance(state.screen.view, state.screen.world.season.races.length),
            },
          }
        : state,
    );
  },
  skipToEnd: () => {
    set((state) =>
      isPlaying(state.screen) ? { screen: { ...state.screen, view: { kind: "summary" } } } : state,
    );
  },
  restartSeason: () => {
    set((state) =>
      isPlaying(state.screen)
        ? {
            screen: replaceWorld(
              state.screen,
              createWorld(
                randomSeed(),
                state.screen.world.year,
                state.screen.world.ratingMode,
                state.screen.world.lineup,
                state.screen.world.engines,
              ),
            ),
          }
        : state,
    );
  },
}));
