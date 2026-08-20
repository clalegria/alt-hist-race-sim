/**
 * The randomness seam for the whole engine.
 *
 * Everything in the sim depends on `Rng`, never on a concrete generator, so an
 * implementation can be swapped (a different algorithm) or stubbed (a canned
 * sequence in a test) without touching callers.
 */

/**
 * A generator's internal state as plain, serializable numbers.
 *
 * The length and meaning are implementation-defined — sfc32 uses four uint32s.
 * Treat it as an opaque token to hand back to `createRngFromState`.
 */
export type RngState = readonly number[];

/**
 * The minimum an implementation must provide. The helpers on `Rng` are all
 * derived from `next`, so a new generator only implements these two.
 */
export interface RngSource {
  /** A float in [0, 1). The primitive every helper is built on. */
  next(): number;
  /** A snapshot of the current state, safe to serialize. */
  getState(): RngState;
}

/**
 * A seeded pseudo-random generator.
 *
 * Mutable by design: each call advances the stream, so results depend on the
 * order calls are made. The sequence is fully determined by the seed, which is
 * what makes runs reproducible.
 *
 * An `Rng` holds a closure and must NOT be stored in the serializable world
 * state. Keep the numeric `getState()` snapshot there instead and rebuild the
 * generator with `createRngFromState`.
 */
export interface Rng extends RngSource {
  /**
   * An integer in [minInclusive, maxExclusive) — lower bound included, upper
   * bound excluded, matching array indices and `Math.random()` conventions.
   *
   * @throws RangeError if the bounds are not integers or the range is empty.
   */
  nextInt(minInclusive: number, maxExclusive: number): number;

  /**
   * One uniformly chosen element.
   *
   * @throws RangeError if `items` is empty.
   */
  pick<T>(items: readonly T[]): T;

  /**
   * A uniformly shuffled copy (Fisher–Yates). The input is never mutated.
   */
  shuffle<T>(items: readonly T[]): T[];

  /**
   * A normally distributed value. Defaults to the standard normal.
   *
   * This is the noise source for the race model: performance spread is roughly
   * bell-shaped, so uniform noise would make freak results as likely as typical
   * ones. Consumes two draws per call.
   */
  gaussian(mean?: number, standardDeviation?: number): number;
}
