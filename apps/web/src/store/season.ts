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

import { buildField } from "@alt-hist/data";
import {
  createRng,
  type RaceEntrant,
  type RngState,
  type SeasonResult,
  simulateSeason,
} from "@alt-hist/engine";
import { create } from "zustand";
import { seasonSeed } from "../lib/seasons.js";
import { randomSeed } from "../lib/seed.js";

/** The serializable world. Add to this and it must stay plain data. */
export interface World {
  readonly seed: number;
  readonly year: number;
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
  readonly season: SeasonResult;
}

/**
 * Runs a season from a seed and returns the world it produced.
 *
 * Pure: same seed and year in, same world out, no store involved. The store is
 * a place to keep this, not the thing that computes it.
 */
export function createWorld(seed: number, year: number): World {
  const authored = seasonSeed(year);
  const rng = createRng(seed);
  const field = buildField(authored);
  const season = simulateSeason(field, authored.calendar.length, rng);

  return {
    seed,
    year: authored.year,
    rngState: rng.getState(),
    field,
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
  /** Simulates a fresh season of the given year and opens it at the grid. */
  readonly startSeason: (year: number) => void;
  /** The same, from a chosen seed — the reproducible entry point tests use. */
  readonly simulate: (seed: number, year: number) => void;
  /** Reveals the next session. */
  readonly nextSession: () => void;
  /** Jumps straight to the finished season. */
  readonly skipToEnd: () => void;
  /**
   * Back to the grid of the same *year*, on a fresh seed.
   *
   * A new draw rather than a rewind: replaying results the reader has already
   * seen is a re-read, and what "start again" has always meant here is another
   * go at the season. The menu is for changing mode or year, not for this.
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
    set({ screen: openSeason(createWorld(randomSeed(), year)) });
  },
  simulate: (seed, year) => {
    set({ screen: openSeason(createWorld(seed, year)) });
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
        ? { screen: openSeason(createWorld(randomSeed(), state.screen.world.year)) }
        : state,
    );
  },
}));
