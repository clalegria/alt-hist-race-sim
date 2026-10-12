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
  applyChassis,
  applyEngines,
  applyLineup,
  arrangeLineup,
  authoredChassis,
  authoredEngineRatings,
  authoredLineup,
  buildField,
  DEFAULT_RATING_MODE,
  filledLineup,
  fillSeats,
  isAuthoredChassis,
  isAuthoredEngines,
  isAuthoredLineup,
  type KeptYear,
  keptYear,
  type LineupDraft,
  type RatingMode,
  type SeasonChassis,
  type SeasonEngineRatings,
  type SeasonEngines,
  type SeasonLineup,
  type SeasonSeed,
  type SeasonTrends,
  seasonConstants,
  seatedSeason,
} from "@alt-hist/data";
import {
  createRng,
  DEFAULT_RANDOMNESS_LEVEL,
  type PointsScale,
  type RaceConstants,
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
  readRunSettings,
  rememberRandomness,
  rememberRatingMode,
  rememberRunSettings,
  rememberSeasonYear,
} from "../lib/preferences.js";
import {
  driverPoolOf,
  emptySeatRules,
  enginesWalkFromLastYear,
  HISTORICAL_SETTINGS,
  type RunSettings,
  rememberedAfterSeason,
  rolledChassisOf,
  rolledEnginesOf,
  sameSettings,
  seasonSettings,
  seatingArrangement,
  settingsInForce,
  trendsOf,
  walksFromLastYear,
} from "../lib/run-settings.js";
import { enteredSeason, isPlayable, nextEraYear, seasonSeed, withRunCars } from "../lib/seasons.js";
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
   * Chosen before the run is under way — on the setup screen, or from the
   * run's untouched first grid (`setRunSettings`) — and never changed after:
   * a standalone season keeps its level, and an era keeps its first year's for
   * every year that follows.
   */
  readonly randomness: RandomnessLevel;
  /**
   * The run's what-ifs (`lib/run-settings.ts`), chosen when `randomness` is and
   * carried into every year after, exactly as `randomness` is. A simulation
   * input for the same reason: the recipe rebuilds a world from what it records.
   */
  readonly settings: RunSettings;
  /**
   * The year the run's team names are kept from — the era's first year, under
   * *Team name changes: No* — or null for every team named as it was that
   * year. Each team is named, and based, as in its first season at or after it
   * (`firstYearInRun`). Recorded because one world cannot know where its era
   * started, and the base is a simulation input: it is where a team is at home.
   */
  readonly namesKeptFrom: number | null;
  /**
   * The year the run's liveries are kept from — the era's first year, under
   * *Livery changes: No* — or null for every team painted as it was that year.
   * The rule `namesKeptFrom` follows (`firstYearInRun`). Display only: nothing
   * simulated reads a livery.
   */
  readonly liveriesKeptFrom: number | null;
  /**
   * The year the run's engine suppliers are kept from — the era's first year,
   * under *Engine supplier changes: No* — or null for history's supply. Each
   * team runs the engine of its first season in the run (`withFirstEngines`).
   * Part of the year's baseline, not an edit: `engines` is measured from it.
   */
  readonly enginesKeptFrom: number | null;
  /**
   * The championship points scale the year was scored on: its seed file's,
   * unless the run's `settings` name one table for every year.
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
   * The reader's own chassis ratings, or null for the chassis the season was
   * entered with — null for the reason `lineup` and `engines` are.
   *
   * A third part of the grid rather than part of `engines`: how good the car a
   * team built is, as opposed to whose unit is in the back of it. It re-rates
   * one season's cars and nothing else; the authored data is never touched.
   */
  readonly chassis: SeasonChassis | null;
  /**
   * The run's own chassis for this year, rolled under *Chassis performance*, or null
   * for the chassis the season was entered with.
   *
   * **The year's baseline, not an edit**: `lineup`, `engines` and `chassis`, the
   * editor and its notices are all measured from the season with these cars in
   * it (`seasonWithChassis`), so a varied car never reads as the reader's change.
   * Rolled once, from the world's seed, and kept here rather than re-rolled on
   * read — the recipe does not record it, since the seed rebuilds it.
   */
  readonly baselineChassis: SeasonChassis | null;
  /**
   * Each team's chassis as raced the year before in this run (`racedChassis`),
   * which *Chassis performance* from last year's car walks off — or null
   * when the cars do not walk, or there was no year before.
   *
   * Recorded for the reason `namesKeptFrom` is: one year cannot see the run
   * behind it, so every action that rebuilds this year in place passes it on.
   * The recipe does not store it — a rebuild takes it from the world before.
   */
  readonly walkedFrom: SeasonChassis | null;
  /**
   * The run's own engine ratings for this year, rolled under *Engine
   * performance* — per engine, so every team running one moves together — or
   * null for the authored ones. **The year's baseline, not an edit**, as
   * `baselineChassis` is; the seed rebuilds it.
   */
  readonly baselineEngineRatings: SeasonEngineRatings | null;
  /**
   * Each engine as raced the year before in this run (`racedEngineRatings`),
   * which *Engine performance* from last year's engine walks off — or
   * null, as `walkedFrom` is for the chassis.
   */
  readonly engineWalkedFrom: SeasonEngineRatings | null;
  /**
   * Each car's development trend for this year under *In-season development*
   * — drawn under Random, every one zero under Off — or null for the authored
   * ones. **The year's baseline, not an edit**; the seed rebuilds it.
   */
  readonly baselineTrends: SeasonTrends | null;
  /**
   * The era's first year under *Keep the first season's teams*, whose
   * teams and seat counts every year keeps — else null. Recorded for the reason
   * `namesKeptFrom` is: one year cannot see where its era began.
   */
  readonly gridKeptFrom: number | null;
  /**
   * Under Keep, this year as `keptYear` built it — the first year's teams on
   * this year's cars, history's drivers, last year's carried back — before any
   * *Chassis performance* roll or signing; null otherwise, and in an era's first
   * year, which has nothing to keep. An input, like `walkedFrom`: every action
   * that rebuilds the year in place passes it on, and the recipe re-derives it
   * from the world before (`keptYearAfter`).
   */
  readonly kept: KeptYear | null;
  /**
   * Under Keep, every seat after `fillSeats` — an empty one `null`, left out of
   * the season — or null. **The year's baseline, not an edit**, as
   * `baselineChassis` is: derived from the inputs and kept so nothing re-derives
   * it on read (`enteredSeason`).
   */
  readonly keptSeats: LineupDraft | null;
  /**
   * Under *Who drives where*, the grid after the reseat — the year's last
   * baseline step, after the kept teams' signings — or null. **The year's
   * baseline, not an edit**, as `keptSeats` is: a hand edit sits on top of it,
   * and Restore returns to it (`enteredSeason`).
   */
  readonly reseated: SeasonLineup | null;
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
 * What a year's baseline is built from besides the year, the seed and the
 * settings: what one year of an era cannot see of the run around it.
 */
interface BaselineInputs {
  /** Each team's chassis as raced the year before, for a walk. */
  readonly lastRaced: SeasonChassis | null;
  /** Each engine as raced the year before, for a walk. */
  readonly lastRacedEngines: SeasonEngineRatings | null;
  /** The year as *Keep the first season's teams* built it. */
  readonly kept: KeptYear | null;
  /** The era's first year under *Engine supplier changes: No*, else null. */
  readonly enginesKeptFrom: number | null;
}

/**
 * A season as the run enters it — under Keep, the kept year rather than the
 * seed file — with the run's own cars in it (`withRunCars`): each team's first
 * engine under *Engine supplier changes: No*; its chassis, then its engines,
 * rolled from this seed (off last year's when they walk); and its development
 * trends. Under Keep its empty seats are then signed, best car first on those
 * cars. Last, under *Who drives where*, the grid is reseated (`reseat`).
 * Hands back the rolls, the signings and the reseat, for the world to keep.
 */
function baselineSeason(
  year: number,
  seed: number,
  settings: RunSettings,
  ratingMode: RatingMode,
  inputs: BaselineInputs,
): {
  season: SeasonSeed;
  baselineChassis: SeasonChassis | null;
  baselineEngineRatings: SeasonEngineRatings | null;
  baselineTrends: SeasonTrends | null;
  keptSeats: LineupDraft | null;
  reseated: SeasonLineup | null;
} {
  const rules = emptySeatRules(settings);
  const kept = rules === null ? null : inputs.kept;
  const entered = kept === null ? seasonSeed(year) : kept.season;
  const { enginesKeptFrom } = inputs;
  const supplied = withRunCars(entered, {
    enginesKeptFrom,
    baselineChassis: null,
    baselineEngineRatings: null,
    baselineTrends: null,
  });
  const rolls = {
    enginesKeptFrom,
    baselineChassis: rolledChassisOf(supplied, settings, seed, inputs.lastRaced),
    baselineEngineRatings: rolledEnginesOf(supplied, settings, seed, inputs.lastRacedEngines),
    baselineTrends: trendsOf(supplied, settings, seed),
  };
  const cars = withRunCars(entered, rolls);
  const keptSeats =
    kept === null || rules === null
      ? null
      : fillSeats(cars, kept.seats, rules, {
          pool: driverPoolOf(settings),
          mode: ERA_RATING_MODE,
        });
  const seated = keptSeats === null ? cars : seatedSeason(cars, keptSeats);
  const reseated = reseat(seated, seed, settings, ratingMode);
  return {
    ...rolls,
    season: reseated === null ? seated : applyLineup(seated, reseated),
    keptSeats,
    reseated,
  };
}

/**
 * The grid *Who drives where* seats a season with, or null under Historical:
 * the rule over the season's own grid, on the cars it races, ranking drivers on
 * the ratings the run races them on. The cast is the season's drivers, plus
 * the signing pool when drivers without a drive can take a seat.
 *
 * **The dice come from the season's own seed** (`createRng(seed)`), so a random
 * grid is reproducible from the number the season is, and a fresh seed is a
 * fresh grid. A separate generator from the races', discarded here, so the
 * reseat cannot change what a race does. Falls back to the season's grid if the
 * rule leaves a seat open, since only a filled grid can be raced.
 */
function reseat(
  season: SeasonSeed,
  seed: number,
  settings: RunSettings,
  ratingMode: RatingMode,
): SeasonLineup | null {
  const rule = seatingArrangement(settings);
  if (rule === null) {
    return null;
  }
  const authored = authoredLineup(season);
  const arranged = arrangeLineup(season, authored, rule, {
    mode: ratingMode,
    rng: createRng(seed),
    pool: driverPoolOf(settings),
  });
  return filledLineup(arranged) ?? authored;
}

/** The grid a world raced, by team, in seat order. */
export function racedLineup(world: World): SeasonLineup {
  const lineup: Record<string, string[]> = {};
  for (const entrant of world.field) {
    lineup[entrant.teamId] = [...(lineup[entrant.teamId] ?? []), entrant.driverId];
  }
  return lineup;
}

/**
 * Year `year` of a Keep era, built off the year before: the first year's teams
 * on `year`'s cars, the grid `last` raced carried into the seats history left
 * empty. Null when the run does not keep its grid. Continue, a jump and the
 * recipe's rebuild all build a year through this, so they cannot disagree.
 */
export function keptYearAfter(last: World, year: number): KeptYear | null {
  const rules = emptySeatRules(last.settings);
  if (rules === null || last.gridKeptFrom === null) {
    return null;
  }
  return keptYear(seasonSeed(last.gridKeptFrom), seasonSeed(year), racedLineup(last), rules, {
    pool: driverPoolOf(last.settings),
    mode: ERA_RATING_MODE,
  });
}

/**
 * What one year of an era cannot know about the run around it, for
 * `createWorld`. All optional: a standalone season, or an era's first year,
 * passes nothing.
 */
export interface EraInputs {
  /** The era's first year; the world's own year when absent. */
  readonly start?: number | null;
  /** Each team's chassis as raced the year before (`racedChassis`), for a walk. */
  readonly lastRaced?: SeasonChassis | null;
  /** Each engine as raced the year before (`racedEngineRatings`), for a walk. */
  readonly lastRacedEngines?: SeasonEngineRatings | null;
  /** The year as *Keep the first season's teams* built it (`keptYearAfter`). */
  readonly kept?: KeptYear | null;
}

/** The era's first year, when the world recorded it: under any setting that keeps something from it. */
export function eraStartOf(world: World): number | null {
  return (
    world.namesKeptFrom ?? world.liveriesKeptFrom ?? world.enginesKeptFrom ?? world.gridKeptFrom
  );
}

/** A world's own era inputs, for an action that rebuilds its year in place. */
function eraInputsOf(world: World): EraInputs {
  return {
    start: eraStartOf(world),
    lastRaced: world.walkedFrom,
    lastRacedEngines: world.engineWalkedFrom,
    kept: world.kept,
  };
}

/**
 * Each team's chassis as a world raced it: the reader's own, else the run's
 * roll, else the authored car. What a walk (*from last year's car*) moves the
 * next year off, so a reader's edit is carried by it: it is what raced.
 */
export function racedChassis(world: World): SeasonChassis {
  return world.chassis ?? world.baselineChassis ?? authoredChassis(enteredSeason(world));
}

/**
 * Each engine as a world raced it: the run's roll, else the values the year
 * entered with. What a walk (*from last year's engine*) moves the next
 * year off.
 */
export function racedEngineRatings(world: World): SeasonEngineRatings {
  return world.baselineEngineRatings ?? authoredEngineRatings(enteredSeason(world));
}

/**
 * The constants a season races on under a run's settings: its randomness level,
 * its cars on the retirement factor of the year Reliability names (its drivers
 * always on the year's own), and the Breakdowns multiplier. Derived copies of the constants, never edits — and
 * all-historical at the unscaled level, `RACE_CONSTANTS` itself.
 */
export function runConstants(
  season: SeasonSeed,
  randomness: RandomnessLevel,
  settings: RunSettings,
): RaceConstants {
  return seasonConstants(season, randomness, undefined, {
    mechanicalFactor:
      settings.reliability === null
        ? season.retirementFactor
        : seasonSeed(settings.reliability).retirementFactor,
    breakdowns: settings.breakdowns ?? "realistic",
  });
}

/**
 * Runs a season from a seed and returns the world it produced.
 *
 * Pure: same seed and year in, same world out, no store involved. The store is
 * a place to keep this, not the thing that computes it.
 *
 * `lineup`, `engines` and `chassis` are the reader's edits over the baseline
 * (`baselineSeason`), which under *Who drives where* is already reseated.
 *
 * `chosen` is kept as `settingsInForce`, so a world never records a setting
 * that changed nothing about it.
 *
 * Under *Chassis performance* the season's chassis are rolled first, from the seed,
 * and everything after is measured against that baseline: an edit that lands
 * on the rolled car is no edit, and a reader's own chassis are absolute ratings
 * over it.
 *
 * `era` is what one year cannot know about the run around it (`EraInputs`),
 * named fields rather than three more positional arguments. Its `start`
 * defaults to this year, the right answer for an era's first year, and is
 * recorded as `namesKeptFrom`, `liveriesKeptFrom`, `enginesKeptFrom` and
 * `gridKeptFrom` under the settings that keep each, null otherwise.
 * `lastRaced` and `lastRacedEngines` are read only when the chassis or the
 * engines walk from the previous year's, recorded as `walkedFrom` and
 * `engineWalkedFrom`; `kept` only under Keep.
 */
export function createWorld(
  seed: number,
  year: number,
  ratingMode: RatingMode = DEFAULT_RATING_MODE,
  lineup: SeasonLineup | null = null,
  engines: SeasonEngines | null = null,
  randomness: RandomnessLevel = DEFAULT_RANDOMNESS_LEVEL,
  chassis: SeasonChassis | null = null,
  chosen: RunSettings = HISTORICAL_SETTINGS,
  era: EraInputs = {},
): World {
  const settings = settingsInForce(chosen);
  const start = era.start ?? year;
  const namesKeptFrom = settings.teamNames === "first" ? start : null;
  const liveriesKeptFrom = settings.liveries === "first" ? start : null;
  const enginesKeptFrom = settings.engineSuppliers === "first" ? start : null;
  const gridKeptFrom = settings.teams === null ? null : start;
  const kept = settings.teams === null ? null : (era.kept ?? null);
  const walkedFrom = walksFromLastYear(settings) ? (era.lastRaced ?? null) : null;
  const engineWalkedFrom = enginesWalkFromLastYear(settings)
    ? (era.lastRacedEngines ?? null)
    : null;
  const {
    season: baseline,
    baselineChassis,
    baselineEngineRatings,
    baselineTrends,
    keptSeats,
    reseated,
  } = baselineSeason(year, seed, settings, ratingMode, {
    lastRaced: walkedFrom,
    lastRacedEngines: engineWalkedFrom,
    kept,
    enginesKeptFrom,
  });
  // An edit that puts everyone back where they started is not an edit, and a
  // season that claimed otherwise would carry a notice nobody could explain.
  const edited = lineup !== null && !isAuthoredLineup(baseline, lineup) ? lineup : null;
  const resupplied = engines !== null && !isAuthoredEngines(baseline, engines) ? engines : null;
  const withDrivers = edited === null ? baseline : applyLineup(baseline, edited);
  const rerated = chassis !== null && !isAuthoredChassis(baseline, chassis) ? chassis : null;
  const withEngines = resupplied === null ? withDrivers : applyEngines(withDrivers, resupplied);
  const entered = rerated === null ? withEngines : applyChassis(withEngines, rerated);
  const rng = createRng(seed);
  const field = buildField(
    entered,
    driverPoolOf(settings),
    ratingMode,
    undefined,
    undefined,
    namesKeptFrom,
  );
  // The calendar itself, not its length: the round's country is what gives the
  // drivers and teams from it their home advantage.
  const season = simulateSeason(
    field,
    entered.calendar,
    rng,
    runConstants(entered, randomness, settings),
  );

  return {
    seed,
    year: entered.year,
    ratingMode,
    randomness,
    settings,
    namesKeptFrom,
    liveriesKeptFrom,
    enginesKeptFrom,
    // Scoring only: the races above were run before any points were handed out.
    points: settings.points ?? entered.points,
    rngState: rng.getState(),
    field,
    lineup: edited,
    engines: resupplied,
    chassis: rerated,
    baselineChassis,
    walkedFrom,
    baselineEngineRatings,
    engineWalkedFrom,
    baselineTrends,
    gridKeptFrom,
    kept,
    keptSeats,
    reseated,
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
 * Whether leaving the run would lose nothing: the cursor is still on its first
 * grid, and that grid is as the season entered it.
 *
 * Every way out of a run asks first unless this is true, because until then
 * the run is still being set up — going back to change the randomness is not
 * abandoning anything. The ability toggle, the year switcher and the run
 * settings do not count: the first and last are remembered as preferences, the
 * second only draws a different season. A grid edit does, and so does anything
 * revealed or any later year — which is also when the run settings stop being
 * changeable (`setRunSettings`).
 */
export function isUntouched(run: Run): boolean {
  return (
    run.cursor.kind === "grid" &&
    (run.kind === "season" || run.run.seasons.length === 0) &&
    run.world.lineup === null &&
    run.world.engines === null &&
    run.world.chassis === null
  );
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
   * Whether the run saved before the last reload could not be rebuilt on this
   * build (`store/persist.ts`). Home says so until the reader dismisses it or
   * starts another run.
   */
  readonly resumeFailed: boolean;
  readonly dismissResumeFailed: () => void;
  /**
   * Simulates a fresh season of the given year and opens it at the grid, using
   * the remembered ability mode.
   *
   * The randomness level and the run settings come from the setup screen; the
   * untouched first grid can change them after (`setRunSettings`). Omitted, the remembered ones are used — the
   * setup screen seeds its controls from the same values, so the two cannot
   * disagree. The era-only settings are dropped (`seasonSettings`), here and in
   * `simulate`, so no standalone season records one.
   */
  readonly startSeason: (
    year: number,
    randomness?: RandomnessLevel,
    settings?: RunSettings,
  ) => void;
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
    settings?: RunSettings,
  ) => void;
  /**
   * Starts an era at the given year: its first season, opened at the grid, with
   * an empty run behind it.
   *
   * Always at `ERA_RATING_MODE`, and the reader is not offered the choice.
   *
   * The randomness level and the run settings, by contrast, *are* the reader's
   * — but only here. They are baked into the run at this point and carried by
   * every year that follows, so an era is one long championship run under one
   * set of rules rather than a dial the reader can turn the moment a season
   * goes against them.
   */
  readonly startEra: (year: number, randomness?: RandomnessLevel, settings?: RunSettings) => void;
  /** The same from a chosen seed, and for the same reason: tests need one. */
  readonly simulateEra: (
    seed: number,
    year: number,
    randomness?: RandomnessLevel,
    settings?: RunSettings,
  ) => void;
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
   * Re-runs the run's first season on a fresh seed under other run settings —
   * the randomness level and the what-ifs — and remembers them, as the setup
   * screen would have.
   *
   * **Only while the run is untouched** (`isUntouched`): its first grid, as
   * entered. Past it the reader has seen results, or edited a grid, that the
   * settings were fixed for.
   *
   * **A fresh seed, unlike `setRatingMode`**: on the same seed, flipping *Car
   * performance* away and back hands back the very same rolled cars, so the
   * pecking order never moves however often the reader tries. Settings that
   * leave the run as it was (a Done with nothing changed) rebuild nothing.
   */
  readonly setRunSettings: (randomness: RandomnessLevel, settings: RunSettings) => void;
  /**
   * Re-runs the season from the same seed with the reader's own grid: who
   * drives what, what is in the back of it, and how good the chassis is. `null`
   * for any part means that part as the season entered it.
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
    /** The reader's chassis ratings; null — the default — for the season's own. */
    chassis?: SeasonChassis | null,
  ) => void;
  /**
   * The grid of the season next door — the year before or the year after — on a
   * fresh seed.
   *
   * The shortcut off the grid screen, for the reader who has just finished 1980
   * and wants 1981. It is `startSeason` in every respect but where the settings
   * come from: the *world on screen* rather than the remembered preferences, so
   * stepping through a decade keeps the ability mode, the randomness level and
   * the run settings the reader chose for the first of them, and does not quietly hand them a
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
   * an edited grid alike — drivers, engines and chassis — because a reader who put
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
   * randomness level, the run settings, the ability mode — and **the first year's grid**,
   * edits, engines and chassis included. A reseat under *Who drives where* is
   * part of the settings, so it is thrown again on the new dice. Grids edited in
   * later years go with those years: each was a grid for a year this run no
   * longer has.
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
 * to play — the ability mode, the randomness level, the run settings (a reseat
 * under *Who drives where* among them) — carried. What they chose about one grid
 * does not carry, because it was a grid for a year now behind them. The cars
 * `last` raced go along, for a walk from last year's car to move off.
 *
 * The one step both Continue and a jump forward take, so the two cannot
 * produce different histories.
 */
function nextEraWorld(last: World, year: number): World {
  const seed = nextSeed(last.rngState);
  const kept = keptYearAfter(last, year);
  return createWorld(
    seed,
    year,
    last.ratingMode,
    null,
    null,
    // Baked in at the era's setup: every year of a run is raced under the
    // level its first year was started on.
    last.randomness,
    null,
    last.settings,
    {
      start: eraStartOf(last),
      lastRaced: racedChassis(last),
      lastRacedEngines: racedEngineRatings(last),
      kept,
    },
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
  resumeFailed: false,
  dismissResumeFailed: () => {
    set({ resumeFailed: false });
  },
  startSeason: (year, randomness = readRandomness(), settings = readRunSettings()) => {
    set({
      run: openSeason(
        createWorld(
          randomSeed(),
          year,
          readRatingMode(),
          null,
          null,
          randomness,
          null,
          seasonSettings(settings),
        ),
      ),
    });
  },
  simulate: (seed, year, ratingMode, randomness, settings = HISTORICAL_SETTINGS) => {
    set({
      run: openSeason(
        createWorld(seed, year, ratingMode, null, null, randomness, null, seasonSettings(settings)),
      ),
    });
  },
  startEra: (year, randomness = readRandomness(), settings = readRunSettings()) => {
    set({
      run: openEra(
        createWorld(randomSeed(), year, ERA_RATING_MODE, null, null, randomness, null, settings),
      ),
    });
  },
  simulateEra: (seed, year, randomness, settings) => {
    set({
      run: openEra(
        createWorld(seed, year, ERA_RATING_MODE, null, null, randomness, null, settings),
      ),
    });
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
                // A reseat is rebuilt on the new ratings, since who is
                // "fastest" is what the mode decides; the seed is the same, so
                // a random one is the same shuffle.
                state.run.world.lineup,
                state.run.world.engines,
                state.run.world.randomness,
                state.run.world.chassis,
                state.run.world.settings,
                eraInputsOf(state.run.world),
              ),
            ),
          }
        : state,
    );
  },
  setRunSettings: (randomness, settings) => {
    const run = get().run;
    if (run === null || !isUntouched(run)) {
      return;
    }
    const { world } = run;
    rememberRandomness(randomness);
    const raced = run.kind === "season" ? seasonSettings(settings) : settings;
    if (run.kind === "season") {
      rememberRunSettings(rememberedAfterSeason(readRunSettings(), raced));
    } else {
      rememberRunSettings(settings);
    }
    if (randomness === world.randomness && sameSettings(settingsInForce(raced), world.settings)) {
      return;
    }
    const seed = randomSeed();
    if (run.kind === "season") {
      set({
        run: openSeason(
          createWorld(seed, world.year, world.ratingMode, null, null, randomness, null, raced),
        ),
      });
      return;
    }
    // `startEra`'s own build: what the first year of an era records about the
    // run (`gridKeptFrom`, `namesKeptFrom`) follows the settings, and an
    // untouched run has nothing else to carry.
    set({
      run: openEra(
        createWorld(seed, world.year, ERA_RATING_MODE, null, null, randomness, null, settings),
      ),
    });
  },
  setGrid: (lineup, engines, chassis = null) => {
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
                chassis,
                state.run.world.settings,
                eraInputsOf(state.run.world),
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
            // entry list; nothing about it transfers. The settings do, a
            // reseat among them, rebuilt on the new year.
            null,
            null,
            state.run.world.randomness,
            null,
            state.run.world.settings,
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
            // A reseat is part of the baseline, so it is thrown again on the
            // new dice: another random grid, the same ranked one.
            world.lineup,
            world.engines,
            world.randomness,
            world.chassis,
            world.settings,
            eraInputsOf(world),
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
            // and a reseat is thrown again on the new dice.
            first.lineup,
            first.engines,
            first.randomness,
            first.chassis,

            first.settings,
          ),
        ),
      };
    });
  },
}));
