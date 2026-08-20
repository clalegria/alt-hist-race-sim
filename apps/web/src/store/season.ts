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
import { createRng, type RngState, type SeasonResult, simulateSeason } from "@alt-hist/engine";
import { create } from "zustand";

/** The serializable world. Add to this and it must stay plain data. */
export interface World {
  readonly seed: number;
  readonly year: number;
  /**
   * The generator's position after the last race simulated. Rebuild with
   * `createRngFromState` to continue the same stream into the next season.
   */
  readonly rngState: RngState;
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
    season,
  };
}

interface SeasonStore {
  readonly world: World;
  /** Re-runs the season from a seed, replacing the world. */
  readonly simulate: (seed: number) => void;
}

const DEFAULT_SEED = 1;

export const useSeasonStore = create<SeasonStore>((set) => ({
  world: createWorld(DEFAULT_SEED),
  simulate: (seed) => {
    set({ world: createWorld(seed) });
  },
}));
