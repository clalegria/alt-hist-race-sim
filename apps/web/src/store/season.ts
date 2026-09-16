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
  arrangeLineup,
  authoredLineup,
  buildField,
  DEFAULT_RATING_MODE,
  filledLineup,
  type GridArrangement,
  isAuthoredEngines,
  isAuthoredLineup,
  type RatingMode,
  type SeasonEngines,
  type SeasonLineup,
  seasonConstants,
} from "@alt-hist/data";
import {
  createRng,
  DEFAULT_RANDOMNESS_LEVEL,
  type PointsScale,
  type RaceEntrant,
  type RandomnessLevel,
  type RngState,
  type SeasonResult,
  simulateSeason,
} from "@alt-hist/engine";
import { create } from "zustand";
import {
  readRandomness,
  readRatingMode,
  rememberRatingMode,
  rememberSeasonYear,
} from "../lib/preferences.js";
import { isPlayable, nextEraYear, seasonSeed } from "../lib/seasons.js";
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
   * How much the dice decided — the randomness level the run was started on.
   *
   * In the world for the same reason `ratingMode` is: it is a simulation input,
   * and the same seed at two levels is two different championships. It is also
   * one of the handful of facts a bug report has to carry, since without it a
   * seed reproduces nothing.
   *
   * Chosen once, on the setup screen, and never changed after: a standalone
   * season keeps the level it was started on, and an era keeps the level its
   * first year was started on for every year that follows.
   */
  readonly randomness: RandomnessLevel;
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
  /**
   * The rule the grid was arranged by, or null for a grid nobody rearranged in
   * one press — the reader's own swaps included, since those are seats and not a
   * rule.
   *
   * A record of *how* `lineup` came to be rather than a second copy of it: the
   * lineup is still what raced and still what every table reads. It is kept
   * because two things need it after the fact — the grid screen says which rule
   * is in force, and an era re-applies it to the next year when the reader asked
   * for that (`retain`). Plain data, like everything else in here.
   *
   * A hand edit in the editor clears it, because a grid that has been rearranged
   * and then meddled with is no longer the thing the rule describes.
   */
  readonly arrangement: GridArrangement | null;
  readonly season: SeasonResult;
}

/**
 * The only ability model an era runs on.
 *
 * Not a default an era starts from — the mode it is *fixed* at, with no switch
 * offered anywhere in the run. "At their peak" answers a question about one
 * season: what if these people met at the best they ever were. An era asks a
 * different question, and the answer to it is the ageing curve — drivers arrive
 * raw, come good, hold form and fall away, and who is quick in the tenth year is
 * not who was quick in the first. Peak ratings across a run would freeze every
 * driver at one age for twenty seasons and quietly delete the thing the mode
 * exists to show.
 *
 * A constant rather than a literal at each call site, so the two entry points
 * into an era cannot drift apart, and so the reason lives somewhere.
 */
export const ERA_RATING_MODE: RatingMode = "aged";

/**
 * The grid one of the editor's bulk rules produces for a year, rolled from that
 * year's own seed.
 *
 * The rule is re-run rather than the lineup copied, because a lineup belongs to
 * the entry list it was drawn for: "the best drivers in the best cars" is a
 * sentence about any season, and 1981's answer to it is not 1980's. Three
 * places need exactly that — the next year of an era that retained the rule,
 * "start again", and a switch of ability mode, which changes who counts as best.
 *
 * **Always over the season's own entry list**, never over the grid already on
 * screen. It makes the rule a function of the year, the seed and the mode and
 * nothing else, which is what keeps re-running it *stable*: flipping the ability
 * mode and back hands the reader the grid they had rather than a fresh shuffle
 * of a shuffle. Nothing is lost by it, because a rule cannot survive a hand
 * edit — the only grid a rule can be in force over is one the same rule made,
 * and arranging an arrangement draws on the same cast as arranging the entry
 * list did.
 *
 * The engines are the exception, and they are not a grid: a team handed a better
 * unit is a better car, and the rules rank cars with the engine folded in. So
 * the supply the season is *being run on* is applied first, or a re-run would
 * rank the field differently from the way the reader saw it ranked.
 *
 * **The dice come from the season's own seed**, so a randomised grid is
 * reproducible from the number the season is reproducible from: the same seed
 * gives the same shuffle, a fresh one gives a fresh grid, and an era's years
 * are as reproducible as their results. The generator is a separate one from
 * the season's — discarded here, with `createWorld` starting the stream the
 * races are run on — so re-rolling a grid cannot change what a race did with
 * it.
 *
 * Falls back to the authored grid if the rule somehow leaves a seat open, since
 * only a filled grid can be raced.
 */
function arrangedLineup(
  year: number,
  seed: number,
  arrangement: GridArrangement,
  ratingMode: RatingMode,
  engines: SeasonEngines | null,
): SeasonLineup {
  const season = seasonSeed(year);
  const authored = authoredLineup(season);
  const entered = engines === null ? season : applyEngines(season, engines);
  const arranged = arrangeLineup(entered, authored, arrangement, {
    mode: ratingMode,
    rng: createRng(seed),
  });
  return filledLineup(arranged) ?? authored;
}

/**
 * The grid a world's own season should be re-run on: the rule re-applied, or the
 * lineup exactly as it stands.
 *
 * Both actions that re-run a season in place — "start again", and a switch of
 * ability mode — want this, and want it to be one decision rather than two
 * copies of the same `if`.
 */
function nextLineup(world: World, seed: number, ratingMode: RatingMode): SeasonLineup | null {
  if (world.arrangement === null) {
    return world.lineup;
  }
  return arrangedLineup(world.year, seed, world.arrangement, ratingMode, world.engines);
}

/**
 * What the next year of an era starts from: the grid its own entry list gives
 * it, arranged by the rule the reader asked to keep — or nothing at all.
 *
 * **The rule crosses a year boundary and a grid does not.** That is the same
 * split the era already makes about the ability mode: what the reader chose
 * about *how to play* carries, and what they chose about one grid does not. A
 * rearranged lineup is a grid for a year now behind them; "the best drivers in
 * the best cars" is a way of playing, and a reader who ticked the box asked for
 * it every year rather than once.
 *
 * Returns the arrangement beside the lineup, because a rule the reader did not
 * ask to keep must not be recorded on a year it did not arrange.
 */
function nextEraGrid(
  last: World,
  year: number,
  seed: number,
): { lineup: SeasonLineup | null; arrangement: GridArrangement | null } {
  const { arrangement } = last;
  if (arrangement === null || !arrangement.retain) {
    return { lineup: null, arrangement: null };
  }
  return {
    // No engines: an era does not carry a supply deal across a year either.
    lineup: arrangedLineup(year, seed, arrangement, last.ratingMode, null),
    arrangement,
  };
}

/**
 * Runs a season from a seed and returns the world it produced.
 *
 * Pure: same seed and year in, same world out, no store involved. The store is
 * a place to keep this, not the thing that computes it.
 *
 * `arrangement` is **recorded, not obeyed**: the lineup handed in is the grid
 * that races, whatever rule is named beside it. The editor computes what the
 * reader is looking at before they apply it — over the draft they had already
 * changed, and with the engines they had already chosen — and a world that
 * quietly re-derived the grid from the rule would show them a season they never
 * agreed to. Re-running a rule is `arrangedLineup`, and every caller that wants
 * it does so before calling this.
 */
export function createWorld(
  seed: number,
  year: number,
  ratingMode: RatingMode = DEFAULT_RATING_MODE,
  lineup: SeasonLineup | null = null,
  engines: SeasonEngines | null = null,
  randomness: RandomnessLevel = DEFAULT_RANDOMNESS_LEVEL,
  arrangement: GridArrangement | null = null,
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
  // The level reaches the model as a derived copy of the constants, never as an
  // edit to them — and at the unscaled level it *is* them, untouched.
  const season = simulateSeason(field, entered.calendar, rng, seasonConstants(entered, randomness));

  return {
    seed,
    year: entered.year,
    ratingMode,
    randomness,
    points: entered.points,
    rngState: rng.getState(),
    field,
    lineup: edited,
    engines: resupplied,
    arrangement,
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
type PlayingScreen = Extract<Screen, { kind: "season" } | { kind: "era" }>;

function isPlaying(screen: Screen): screen is PlayingScreen {
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
   *
   * The randomness level comes from the setup screen, which is the only place
   * it is ever chosen. Omitted, the remembered one is used — the setup screen
   * seeds its slider from the same value, so the two cannot disagree.
   */
  readonly startSeason: (year: number, randomness?: RandomnessLevel) => void;
  /**
   * The same, from a chosen seed — the reproducible entry point tests use.
   *
   * Deliberately does *not* consult the remembered mode: this is the entry
   * point whose output must depend only on its arguments.
   */
  readonly simulate: (
    seed: number,
    year: number,
    ratingMode?: RatingMode,
    randomness?: RandomnessLevel,
  ) => void;
  /**
   * Starts an era at the given year: its first season, opened at the grid, with
   * an empty run behind it.
   *
   * Always at `ERA_RATING_MODE`, and the reader is not offered the choice.
   *
   * The randomness level, by contrast, *is* the reader's — but only here. It is
   * baked into the run at this point and carried by every year that follows, so
   * an era is one long championship run under one set of rules rather than a
   * dial the reader can turn the moment a season goes against them.
   */
  readonly startEra: (year: number, randomness?: RandomnessLevel) => void;
  /** The same from a chosen seed, and for the same reason: tests need one. */
  readonly simulateEra: (seed: number, year: number, randomness?: RandomnessLevel) => void;
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
   * Runs the era on in one go, up to and including `through` — or, with no year
   * given, straight to the last authored season.
   *
   * The era's "skip to the end", and it must produce **exactly** the history
   * stepping through would have: each year is built the way `nextEraSeason`
   * builds one, off the year before it, so skipping and playing differ only in
   * what the reader stopped to read. A test asserts the two are identical. That
   * is also why a *partial* jump is the same action with a stop year rather
   * than its own loop: an era jumped to 1980 and then run on must be the era
   * that was stepped through, year for year.
   *
   * A `through` that is behind the run, or that has no seed data, does nothing:
   * the screen only offers years ahead of the last one crowned, and a target the
   * loop could never reach would otherwise run the era to the end instead.
   *
   * None of these years is revealed session by session — they are crowned
   * unread, which is what skipping means everywhere else here too.
   */
  readonly simulateRestOfEra: (through?: number) => void;
  /**
   * Re-runs the season from the same seed with the other ability model.
   *
   * Only on the grid: past it, the reader has seen results that the new field
   * would not have produced. Keeping the seed makes the two modes comparable —
   * same dice, different drivers.
   *
   * **Standalone seasons only.** An era runs at `ERA_RATING_MODE` throughout and
   * offers no switch; called on an era screen this does nothing at all, not even
   * remember the choice — see the note on the constant.
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
  readonly setGrid: (
    lineup: SeasonLineup | null,
    engines: SeasonEngines | null,
    /**
     * The bulk rule the grid was arranged by, for the world to record. Null —
     * the default — for a grid the reader assembled by hand, which is every
     * caller that predates the rules.
     */
    arrangement?: GridArrangement | null,
  ) => void;
  /** Reveals the next session. */
  readonly nextSession: () => void;
  /** Jumps straight to the finished season. */
  readonly skipToEnd: () => void;
  /**
   * The grid of the season next door — the year before or the year after — on a
   * fresh seed.
   *
   * The shortcut off the grid screen, for the reader who has just finished 1980
   * and wants 1981. It is `startSeason` in every respect but where the settings
   * come from: the *world on screen* rather than the remembered preferences, so
   * stepping through a decade keeps the ability mode and the randomness level
   * the reader chose for the first of them, and does not quietly hand them a
   * different set of rules for the next.
   *
   * What does not carry is the grid: a lineup and a set of supply deals belong
   * to the year they were drawn for, and there is no sense in which Piquet at
   * Williams in 1980 means anything about the 1981 entry list.
   *
   * **Standalone seasons only, and only on the grid.** An era's year is decided
   * by the run rather than by the reader, and past the grid the results on
   * screen belong to a season this would replace. The year is remembered, since
   * it is the same choice the picker makes.
   */
  readonly switchSeasonYear: (year: number) => void;
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

export const useSeasonStore = create<SeasonStore>((set, get) => ({
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
  startSeason: (year, randomness = readRandomness()) => {
    set({
      screen: openSeason(createWorld(randomSeed(), year, readRatingMode(), null, null, randomness)),
    });
  },
  simulate: (seed, year, ratingMode, randomness) => {
    set({ screen: openSeason(createWorld(seed, year, ratingMode, null, null, randomness)) });
  },
  startEra: (year, randomness = readRandomness()) => {
    set({
      screen: {
        kind: "era",
        run: { startYear: year, seasons: [] },
        world: createWorld(randomSeed(), year, ERA_RATING_MODE, null, null, randomness),
        view: { kind: "grid" },
      },
    });
  },
  simulateEra: (seed, year, randomness) => {
    set({
      screen: {
        kind: "era",
        run: { startYear: year, seasons: [] },
        world: createWorld(seed, year, ERA_RATING_MODE, null, null, randomness),
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
      const seed = nextSeed(last.rngState);
      // The next year's dice continue the last year's stream, and its grid is
      // that year's own entry list. What the reader chose about *how to play* —
      // the ability mode, and a bulk rule they asked to keep — carries; what
      // they chose about one grid does not, because it was a grid for a year now
      // behind them.
      const grid = nextEraGrid(last, year, seed);
      return {
        screen: {
          kind: "era",
          run: state.screen.run,
          world: createWorld(
            seed,
            year,
            last.ratingMode,
            grid.lineup,
            null,
            // Baked in at the era's setup screen: every year of a run is raced
            // under the level its first year was started on.
            last.randomness,
            grid.arrangement,
          ),
          view: { kind: "grid" },
        },
      };
    });
  },
  simulateRestOfEra: (through) => {
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
      // A year already behind the run, or one with no season to play, is not a
      // place to jump to. Refused rather than clamped: the alternative is a
      // stray target silently running the whole era to 2026.
      if (through !== undefined && (through <= last.year || !isPlayable(through))) {
        return state;
      }
      // The same step `nextEraSeason` takes, taken until the data runs out or
      // the target year has been crowned: that year's own entry list, and dice
      // continuing the year before's stream. Written as a loop rather than a
      // second rule so the two cannot produce different histories.
      for (
        let year = nextEraYear(last.year);
        year !== null && (through === undefined || year <= through);
        year = nextEraYear(last.year)
      ) {
        const seed = nextSeed(last.rngState);
        const grid = nextEraGrid(last, year, seed);
        last = createWorld(
          seed,
          year,
          last.ratingMode,
          grid.lineup,
          null,
          last.randomness,
          grid.arrangement,
        );
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
    // An era does not have this choice, and calling it there must not leave a
    // trace: remembering a mode chosen on a screen that never offered it would
    // reach the *next standalone season* the reader starts.
    if (get().screen.kind === "era") {
      return;
    }
    // Remembered even if the switch itself is a no-op, so the choice survives
    // whatever the reader does next.
    rememberRatingMode(mode);
    set((state) =>
      state.screen.kind === "season" && state.screen.view.kind === "grid"
        ? {
            screen: replaceWorld(
              state.screen,
              createWorld(
                state.screen.world.seed,
                state.screen.world.year,
                mode,
                // Who is "fastest" is exactly what the ability mode decides, so
                // an arranged grid is arranged again on the new ratings rather
                // than carried over as the seats the old ones produced. The seed
                // is the same, so a randomised grid is the same shuffle and
                // flipping back and forth is not a slot machine.
                nextLineup(state.screen.world, state.screen.world.seed, mode),
                state.screen.world.engines,
                state.screen.world.randomness,
                state.screen.world.arrangement,
              ),
            ),
          }
        : state,
    );
  },
  setGrid: (lineup, engines, arrangement = null) => {
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
                state.screen.world.randomness,
                arrangement,
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
  switchSeasonYear: (year) => {
    set((state) => {
      if (state.screen.kind !== "season" || state.screen.view.kind !== "grid") {
        return state;
      }
      rememberSeasonYear(year);
      return {
        screen: openSeason(
          createWorld(
            randomSeed(),
            year,
            state.screen.world.ratingMode,
            // A grid the reader assembled was assembled for another year's
            // entry list; nothing about it transfers. The bulk rule behind it
            // goes too: it *could* be re-run on the new year, but retaining a
            // rule across years is the era's feature and the era's checkbox, and
            // a shortcut that quietly did it as well would be a second answer to
            // when a rule stops applying.
            null,
            null,
            state.screen.world.randomness,
          ),
        ),
      };
    });
  },
  restartSeason: () => {
    set((state) => {
      if (!isPlaying(state.screen)) {
        return state;
      }
      const { world } = state.screen;
      const seed = randomSeed();
      return {
        screen: replaceWorld(
          state.screen,
          createWorld(
            seed,
            world.year,
            world.ratingMode,
            // A rule the reader chose is re-run on the new dice, which is what
            // makes "start again" under `random` another throw of the field
            // rather than the same shuffle again. The two ranked rules are their
            // own fixed point, so they hand back the grid that was on screen.
            nextLineup(world, seed, world.ratingMode),
            world.engines,
            world.randomness,
            world.arrangement,
          ),
        ),
      };
    });
  },
}));
