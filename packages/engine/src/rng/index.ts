import { createSfc32, restoreSfc32 } from "./sfc32.js";
import type { Rng, RngSource, RngState } from "./types.js";

export type { Rng, RngSource, RngState } from "./types.js";

const TWO_PI = Math.PI * 2;

/**
 * Reads an element, converting the `T | undefined` that `noUncheckedIndexedAccess`
 * produces into a checked access. The guard is what makes the cast safe.
 */
function elementAt<T>(items: readonly T[], index: number): T {
  if (index < 0 || index >= items.length) {
    throw new RangeError(`Index ${index} is outside [0, ${items.length})`);
  }
  return items[index] as T;
}

/**
 * Wraps a minimal source in the full helper set.
 *
 * Every helper draws from `next` and nothing else, so a stub source is a
 * complete `Rng` — useful for pinning a test to an exact sequence.
 */
export function createRngFromSource(source: RngSource): Rng {
  const rng: Rng = {
    next(): number {
      return source.next();
    },

    getState(): RngState {
      return source.getState();
    },

    nextInt(minInclusive: number, maxExclusive: number): number {
      if (!Number.isInteger(minInclusive) || !Number.isInteger(maxExclusive)) {
        throw new RangeError(
          `nextInt bounds must be integers, received [${minInclusive}, ${maxExclusive})`,
        );
      }
      if (maxExclusive <= minInclusive) {
        throw new RangeError(
          `nextInt range must contain at least one value, received [${minInclusive}, ${maxExclusive})`,
        );
      }
      const span = maxExclusive - minInclusive;
      return minInclusive + Math.floor(source.next() * span);
    },

    pick<T>(items: readonly T[]): T {
      if (items.length === 0) {
        throw new RangeError("Cannot pick from an empty array");
      }
      return elementAt(items, Math.floor(source.next() * items.length));
    },

    shuffle<T>(items: readonly T[]): T[] {
      const result = [...items];
      // Fisher-Yates, walking down so each position draws from the unshuffled head.
      for (let i = result.length - 1; i > 0; i -= 1) {
        const j = Math.floor(source.next() * (i + 1));
        const atI = elementAt(result, i);
        result[i] = elementAt(result, j);
        result[j] = atI;
      }
      return result;
    },

    gaussian(mean = 0, standardDeviation = 1): number {
      // Box-Muller. The second variate it produces is deliberately discarded
      // rather than cached: caching would make the stream position depend on
      // how many gaussians were drawn earlier, and would have to be carried in
      // `getState` for snapshots to resume correctly.
      let u1 = source.next();
      while (u1 === 0) {
        // log(0) is -Infinity; next() can legitimately return exactly 0.
        u1 = source.next();
      }
      const u2 = source.next();
      const magnitude = Math.sqrt(-2 * Math.log(u1));
      return mean + standardDeviation * magnitude * Math.cos(TWO_PI * u2);
    },
  };

  return rng;
}

/**
 * The engine's standard generator: sfc32 seeded from a single number.
 *
 * The same seed always yields the same sequence, which is what makes runs
 * reproducible from a bug report and lets Monte Carlo results be re-derived.
 */
export function createRng(seed: number): Rng {
  return createRngFromSource(createSfc32(seed));
}

/**
 * Resumes a generator from a `getState()` snapshot, continuing the sequence
 * exactly where it left off. This is how randomness survives a save/load.
 */
export function createRngFromState(state: RngState): Rng {
  return createRngFromSource(restoreSfc32(state));
}

/**
 * A seed for a stream of its own, derived from a run's seed and a fixed key.
 *
 * Draws that are not the races — a run setting's roll, later the market's —
 * take their dice from here rather than from the race stream, so adding one
 * never shifts what a race does, and a run with none of them draws nothing.
 * The same seed and key always give the same stream; another key gives an
 * unrelated one.
 *
 * FNV-1a over the key, folded into the seed and mixed through splitmix32's
 * finaliser so neighbouring seeds land far apart. A uint32, which
 * `createRng` takes as is.
 */
export function deriveSeed(seed: number, key: string): number {
  if (!Number.isFinite(seed)) {
    throw new RangeError(`Seed must be a finite number, received ${seed}`);
  }
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  let z = ((Math.trunc(seed) | 0) ^ hash) + 0x9e3779b9;
  z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
  z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
  return (z ^ (z >>> 15)) >>> 0;
}
