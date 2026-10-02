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
 * Above the world sits the `Run`: the season or era the reader has started, or
 * null before one is. Which *page* they are on is the URL's business, not the
 * store's (`.claude/rules/web-routing.md`). A world only exists inside a run, so
 * it is a member of those variants rather than a nullable field.
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
import { type Beat, comparePlaces, nextBeat, type Place, type View } from "../lib/timeline.js";

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
 * A run of seasons — the basic era mode: where it started, and every year
 * before the one on the cursor, in order.
 *
 * The finished worlds themselves rather than a table of champions, because
 * **results are the source of truth and statistics are derived**: who won 1983
 * is a `championshipStandings` call over the season that is already here, and
 * keeping a champion beside it would be a second copy of a fact nobody has to
 * store. It also means the roll-up can grow a column without the run changing
 * shape. Plain data throughout, like the world it holds, so an era serialises to
 * a save file exactly as one season does.
 *
 * The season on the cursor is *not* in here — it is the run's `world`, and
 * joins this list when Continue steps off its review onto the next year. Which
 * years have been *crowned* is `crowned(run)`: these, plus the world on the
 * cursor once the cursor reaches its review.
 */
export interface EraRun {
  readonly startYear: number;
  readonly seasons: readonly World[];
}

/**
 * The run in progress: what has been simulated, and how far through it the
 * reader is.
 *
 * `cursor` is the beat the reader has reached in `world`'s year
 * (`lib/timeline.ts`). Deliberately not part of `World`: where the reader has
 * got to is not simulation state, and a world's save file should not care.
 *
 * A new mode is a new variant here rather than a branch inside the season
 * screen. The era mode is the first to take that route: it reuses the season's
 * own beats, with an `EraRun` carried alongside and a review between years.
 * Which page shows a beat is the router's business.
 */
export type Run =
  /** A season, simulated and being revealed. */
  | { readonly kind: "season"; readonly world: World; readonly cursor: Beat }
  /** One season of an era, revealed exactly as a standalone one is, then reviewed. */
  | {
      readonly kind: "era";
      readonly run: EraRun;
      readonly world: World;
      readonly cursor: Beat;
    };

/**
 * The years of an era that have been crowned: every one before the cursor's,
 * and the cursor's own once it has reached its review.
 *
 * Derived rather than kept, so a year cannot be crowned twice and the world on
 * the cursor is never stored twice.
 */
export function crowned(run: Extract<Run, { kind: "era" }>): EraRun {
  return run.cursor.kind === "review"
    ? { startYear: run.run.startYear, seasons: [...run.run.seasons, run.world] }
    : run.run;
}

/** Where the cursor is, as a place in the run. */
export function cursorPlace(run: Run): Place {
  return { year: run.world.year, beat: run.cursor };
}

/**
 * Whether the cursor is on a beat of the season itself rather than the era's
 * review — the beats on which a season can still be started again.
 */
function isPlaying(run: Run | null): run is Run & { readonly cursor: View } {
  return run !== null && run.cursor.kind !== "review";
}

interface SeasonStore {
  /** The run in progress, or null before one is started and after one is exited. */
  readonly run: Run | null;
  /**
   * Discards the run. Only an explicit way out calls this — never a navigation,
   * since leaving the run's page is not leaving the run.
   */
  readonly exitRun: () => void;
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
   * Reveals the next beat — what Continue on the run bar does.
   *
   * Within a season that is the next session, then the summary. In an era the
   * summary leads on to the review, which is the moment the year is crowned
   * (`crowned`); and the review leads on to the next year's grid, which is
   * where that year is simulated.
   *
   * **The next year is the seam the advanced mode replaces.** Its field comes
   * from that year's seed file and nothing else — no market, no progression
   * model, nothing carried forward but the dice and how the reader chose to
   * play. A mode that simulates the grid instead substitutes what is handed to
   * `createWorld` in `nextEraWorld`, and nothing else about the loop changes.
   *
   * Nothing happens at a beat with nothing after it: a one-year run's summary,
   * or an era's review once `nextEraYear` says the data has run out.
   */
  readonly continueRun: () => void;
  /**
   * Runs the run on to `target` in one go: a later year's grid, or a season's
   * end (its summary). The one way of skipping — "simulate rest of the season"
   * is this with the end of the current season as its target.
   *
   * **Continue, pressed until it gets there** (`jumpRun`), so a jump writes
   * exactly the history stepping would have, by construction: skipping gives
   * up the reading, never the seasons. Every year passed on the way is crowned
   * unread.
   *
   * A target that is not ahead of the cursor, is neither a grid nor a summary,
   * or that the run can never reach — a year with no seed data, another year of
   * a one-year run — is refused outright rather than clamped: a stray target
   * must not quietly run the era to its end. Refused, it returns the state
   * itself, so a press that changes nothing re-renders nothing.
   */
  readonly jumpTo: (target: Place) => void;
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
   * stand: they were read, and this one has not been finished. Refused on the
   * review, where the year on the cursor has itself been crowned.
   */
  readonly restartSeason: () => void;
  /**
   * Back to the grid of the era's first year, on a fresh seed, every year
   * since discarded.
   *
   * The era's version of `restartSeason`, and the same promise: a new draw,
   * not a rewind. What carries is how the reader chose to play — the
   * randomness level, the ability mode — and **the first year's grid**, edits,
   * engines and bulk rule included (a rule ticked to be kept goes on arranging
   * every year after, as before). Grids edited in later years go with those
   * years: each was a grid for a year this run no longer has.
   */
  readonly restartEra: () => void;
}

/** A standalone season at its opening grid. */
function openSeason(world: World): Run {
  return { kind: "season", world, cursor: { kind: "grid" } };
}

/** An era at the grid of its first year, with nothing behind it. */
function openEra(world: World): Run {
  return {
    kind: "era",
    run: { startYear: world.year, seasons: [] },
    world,
    cursor: { kind: "grid" },
  };
}

/** The run it already was, with a different world, back at the grid. */
function replaceWorld(run: Run, world: World): Run {
  return { ...run, world, cursor: { kind: "grid" } };
}

/**
 * The year after `last` in an era, built off it: that year's own entry list,
 * the dice continuing `last`'s stream, and whatever the reader chose about how
 * to play — the ability mode, a bulk rule they asked to keep, the randomness
 * level — carried. What they chose about one grid does not carry, because it
 * was a grid for a year now behind them.
 *
 * The one step both Continue and a jump forward take, so the two cannot
 * produce different histories.
 */
function nextEraWorld(last: World, year: number): World {
  const seed = nextSeed(last.rngState);
  const grid = nextEraGrid(last, year, seed);
  return createWorld(
    seed,
    year,
    last.ratingMode,
    grid.lineup,
    null,
    // Baked in at the era's setup: every year of a run is raced under the
    // level its first year was started on.
    last.randomness,
    grid.arrangement,
  );
}

/**
 * The run one Continue further on, or null where there is nowhere further to
 * go: a one-year run's summary, or an era's review once the data runs out.
 *
 * Off a review is onto a new year: the one just crowned joins the run, and the
 * next is simulated from where its dice stopped.
 */
export function stepRun(run: Run): Run | null {
  const year = run.kind === "era" ? nextEraYear(run.world.year) : null;
  const next = nextBeat(
    run.cursor,
    run.world.season.races.length,
    run.kind === "era",
    year !== null,
  );
  if (next === null) {
    return null;
  }
  if (run.kind === "era" && run.cursor.kind === "review" && year !== null) {
    return {
      kind: "era",
      run: { startYear: run.run.startYear, seasons: [...run.run.seasons, run.world] },
      world: nextEraWorld(run.world, year),
      cursor: next,
    };
  }
  return { ...run, cursor: next };
}

/**
 * The run at `target`, reached by stepping — or null for a target a jump may
 * not land on: not ahead of the cursor, not a grid or a season's end, or never
 * reached because the run ends first.
 */
export function jumpRun(run: Run, target: Place): Run | null {
  if (target.beat.kind !== "grid" && target.beat.kind !== "summary") {
    return null;
  }
  if (comparePlaces(target, cursorPlace(run)) <= 0 || !isPlayable(target.year)) {
    return null;
  }
  let at = run;
  while (comparePlaces(cursorPlace(at), target) < 0) {
    const next = stepRun(at);
    if (next === null) {
      return null;
    }
    at = next;
  }
  // Every grid and every summary is a beat the walk passes through, so it stops
  // on the target exactly.
  return at;
}

export const useSeasonStore = create<SeasonStore>((set, get) => ({
  // Nothing is simulated until a mode is chosen: the app opens with no run, and
  // a season nobody asked for is neither shown nor computed.
  run: null,
  exitRun: () => {
    set({ run: null });
  },
  startSeason: (year, randomness = readRandomness()) => {
    set({
      run: openSeason(createWorld(randomSeed(), year, readRatingMode(), null, null, randomness)),
    });
  },
  simulate: (seed, year, ratingMode, randomness) => {
    set({ run: openSeason(createWorld(seed, year, ratingMode, null, null, randomness)) });
  },
  startEra: (year, randomness = readRandomness()) => {
    set({
      run: openEra(createWorld(randomSeed(), year, ERA_RATING_MODE, null, null, randomness)),
    });
  },
  simulateEra: (seed, year, randomness) => {
    set({ run: openEra(createWorld(seed, year, ERA_RATING_MODE, null, null, randomness)) });
  },
  continueRun: () => {
    set((state) => {
      const next = state.run === null ? null : stepRun(state.run);
      return next === null ? state : { run: next };
    });
  },
  jumpTo: (target) => {
    set((state) => {
      const landed = state.run === null ? null : jumpRun(state.run, target);
      return landed === null ? state : { run: landed };
    });
  },
  setRatingMode: (mode) => {
    // An era does not have this choice, and calling it there must not leave a
    // trace: remembering a mode chosen on a screen that never offered it would
    // reach the *next standalone season* the reader starts.
    if (get().run?.kind === "era") {
      return;
    }
    // Remembered even if the switch itself is a no-op, so the choice survives
    // whatever the reader does next.
    rememberRatingMode(mode);
    set((state) =>
      state.run?.kind === "season" && state.run.cursor.kind === "grid"
        ? {
            run: replaceWorld(
              state.run,
              createWorld(
                state.run.world.seed,
                state.run.world.year,
                mode,
                // Who is "fastest" is exactly what the ability mode decides, so
                // an arranged grid is arranged again on the new ratings rather
                // than carried over as the seats the old ones produced. The seed
                // is the same, so a randomised grid is the same shuffle and
                // flipping back and forth is not a slot machine.
                nextLineup(state.run.world, state.run.world.seed, mode),
                state.run.world.engines,
                state.run.world.randomness,
                state.run.world.arrangement,
              ),
            ),
          }
        : state,
    );
  },
  setGrid: (lineup, engines, arrangement = null) => {
    set((state) =>
      state.run !== null && state.run.cursor.kind === "grid"
        ? {
            run: replaceWorld(
              state.run,
              createWorld(
                state.run.world.seed,
                state.run.world.year,
                state.run.world.ratingMode,
                lineup,
                engines,
                state.run.world.randomness,
                arrangement,
              ),
            ),
          }
        : state,
    );
  },
  switchSeasonYear: (year) => {
    set((state) => {
      if (state.run?.kind !== "season" || state.run.cursor.kind !== "grid") {
        return state;
      }
      rememberSeasonYear(year);
      return {
        run: openSeason(
          createWorld(
            randomSeed(),
            year,
            state.run.world.ratingMode,
            // A grid the reader assembled was assembled for another year's
            // entry list; nothing about it transfers. The bulk rule behind it
            // goes too: it *could* be re-run on the new year, but retaining a
            // rule across years is the era's feature and the era's checkbox, and
            // a shortcut that quietly did it as well would be a second answer to
            // when a rule stops applying.
            null,
            null,
            state.run.world.randomness,
          ),
        ),
      };
    });
  },
  restartSeason: () => {
    set((state) => {
      if (!isPlaying(state.run)) {
        return state;
      }
      const { world } = state.run;
      const seed = randomSeed();
      return {
        run: replaceWorld(
          state.run,
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
  restartEra: () => {
    set((state) => {
      const run = state.run;
      if (run?.kind !== "era") {
        return state;
      }
      const first = run.run.seasons[0] ?? run.world;
      const seed = randomSeed();
      return {
        run: openEra(
          createWorld(
            seed,
            first.year,
            first.ratingMode,
            // As `restartSeason` does for one year: the reader's grid carries,
            // and a rule behind it is thrown again on the new dice.
            nextLineup(first, seed, first.ratingMode),
            first.engines,
            first.randomness,
            first.arrangement,
          ),
        ),
      };
    });
  },
}));
