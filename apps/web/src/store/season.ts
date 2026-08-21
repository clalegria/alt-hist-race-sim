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
  applyLineup,
  buildField,
  DEFAULT_RATING_MODE,
  isAuthoredLineup,
  type RatingMode,
  type SeasonLineup,
} from "@alt-hist/data";
import {
  createRng,
  type RaceEntrant,
  type RngState,
  type SeasonResult,
  simulateSeason,
} from "@alt-hist/engine";
import { create } from "zustand";
import { readRatingMode, rememberRatingMode } from "../lib/preferences.js";
import { seasonSeed } from "../lib/seasons.js";
import { randomSeed } from "../lib/seed.js";

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
): World {
  const authored = seasonSeed(year);
  // An edit that puts everyone back where they started is not an edit, and a
  // season that claimed otherwise would carry a notice nobody could explain.
  const edited = lineup !== null && !isAuthoredLineup(authored, lineup) ? lineup : null;
  const entered = edited === null ? authored : applyLineup(authored, edited);
  const rng = createRng(seed);
  const field = buildField(entered, undefined, ratingMode);
  const season = simulateSeason(field, entered.calendar.length, rng);

  return {
    seed,
    year: entered.year,
    ratingMode,
    rngState: rng.getState(),
    field,
    lineup: edited,
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
 * Which page the app is on.
 *
 * Three today; the menu is the seam every future mode arrives through, so a new
 * one is a new variant here rather than a branch inside the season screen.
 */
export type Screen =
  /** The opening screen: what this is, and which mode to run. */
  | { readonly kind: "menu" }
  /** Choosing the year to start from. */
  | { readonly kind: "season-setup" }
  /** A season, simulated and being revealed. */
  | { readonly kind: "season"; readonly world: World; readonly view: View };

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
  /** The year picker. */
  readonly openSeasonSetup: () => void;
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
   * Re-runs the season from the same seed with the other ability model.
   *
   * Only on the grid: past it, the reader has seen results that the new field
   * would not have produced. Keeping the seed makes the two modes comparable —
   * same dice, different drivers.
   */
  readonly setRatingMode: (mode: RatingMode) => void;
  /**
   * Re-runs the season from the same seed with the reader's own driver
   * allocation, or with `null` for the grid as it was entered.
   *
   * Grid-only for the same reason as `setRatingMode`: past it, the results on
   * screen were driven by a field that no longer exists. The seed is kept, so
   * an alternate grid is the same dice thrown at different people — which is
   * the comparison the feature is for.
   */
  readonly setLineup: (lineup: SeasonLineup | null) => void;
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
   * an edited grid alike, because a reader who put Mansell in the Williams
   * asked for that grid, not for one season of it. Only the dice change. The
   * menu is where a different year comes from.
   */
  readonly restartSeason: () => void;
}

/** A season screen at its opening grid. */
function openSeason(world: World): Screen {
  return { kind: "season", world, view: { kind: "grid" } };
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
  startSeason: (year) => {
    set({ screen: openSeason(createWorld(randomSeed(), year, readRatingMode())) });
  },
  simulate: (seed, year, ratingMode) => {
    set({ screen: openSeason(createWorld(seed, year, ratingMode)) });
  },
  setRatingMode: (mode) => {
    // Remembered even if the switch itself is a no-op, so the choice survives
    // whatever the reader does next.
    rememberRatingMode(mode);
    set((state) =>
      state.screen.kind === "season" && state.screen.view.kind === "grid"
        ? {
            screen: openSeason(
              createWorld(
                state.screen.world.seed,
                state.screen.world.year,
                mode,
                state.screen.world.lineup,
              ),
            ),
          }
        : state,
    );
  },
  setLineup: (lineup) => {
    set((state) =>
      state.screen.kind === "season" && state.screen.view.kind === "grid"
        ? {
            screen: openSeason(
              createWorld(
                state.screen.world.seed,
                state.screen.world.year,
                state.screen.world.ratingMode,
                lineup,
              ),
            ),
          }
        : state,
    );
  },
  nextSession: () => {
    set((state) =>
      state.screen.kind === "season"
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
      state.screen.kind === "season"
        ? { screen: { ...state.screen, view: { kind: "summary" } } }
        : state,
    );
  },
  restartSeason: () => {
    set((state) =>
      state.screen.kind === "season"
        ? {
            screen: openSeason(
              createWorld(
                randomSeed(),
                state.screen.world.year,
                state.screen.world.ratingMode,
                state.screen.world.lineup,
              ),
            ),
          }
        : state,
    );
  },
}));
