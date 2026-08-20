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
 */

import { buildField, season1980 } from "@alt-hist/data";
import {
  createRng,
  type RaceEntrant,
  type RngState,
  type SeasonResult,
  simulateSeason,
} from "@alt-hist/engine";
import { create } from "zustand";
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
 * Pure: same seed in, same world out, no store involved. The store is a place
 * to keep this, not the thing that computes it.
 */
export function createWorld(seed: number): World {
  const rng = createRng(seed);
  const field = buildField();
  const season = simulateSeason(field, season1980.calendar.length, rng);

  return {
    seed,
    year: season1980.year,
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
  readonly world: World;
  readonly view: View;
  /** Re-runs the season from a seed, replacing the world and starting over. */
  readonly simulate: (seed: number) => void;
  /** Reveals the next session. */
  readonly nextSession: () => void;
  /** Jumps straight to the finished season. */
  readonly skipToEnd: () => void;
  /** A brand new season, back at the grid. */
  readonly startAgain: () => void;
}

export const useSeasonStore = create<SeasonStore>((set) => ({
  // A fresh seed per page load, so opening the app is opening a season nobody
  // has seen rather than the same one every time.
  world: createWorld(randomSeed()),
  view: { kind: "grid" },
  simulate: (seed) => {
    set({ world: createWorld(seed), view: { kind: "grid" } });
  },
  nextSession: () => {
    set((state) => ({ view: advance(state.view, state.world.season.races.length) }));
  },
  skipToEnd: () => {
    set({ view: { kind: "summary" } });
  },
  startAgain: () => {
    set({ world: createWorld(randomSeed()), view: { kind: "grid" } });
  },
}));
