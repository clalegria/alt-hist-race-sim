/**
 * sfc32 ("Small Fast Counting"), a non-cryptographic 32-bit generator with
 * 128 bits of state.
 *
 * Chosen over mulberry32 because mulberry32's 32-bit state forms a single
 * cycle: every seed walks the same sequence from a different offset, so streams
 * from different seeds can overlap. sfc32's much larger state space gives
 * effectively independent streams per seed, which matters for the Monte Carlo
 * harness that runs the same grid many times over.
 *
 * All arithmetic is forced back into 32 bits with `| 0` and `>>> 0`, so the
 * sequence is exactly reproducible across engines.
 */

import type { RngSource, RngState } from "./types.js";

const UINT32_RANGE = 4294967296;
const STATE_WORDS = 4;

/**
 * splitmix32 — used only to expand one seed number into four well-mixed state
 * words. Seeding sfc32 with (seed, 0, 0, 0) would leave neighbouring seeds
 * producing suspiciously similar early output.
 */
function splitmix32(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x9e3779b9) | 0;
    let z = state ^ (state >>> 16);
    z = Math.imul(z, 0x21f0aaad);
    z = z ^ (z >>> 15);
    z = Math.imul(z, 0x735a2d97);
    z = z ^ (z >>> 15);
    return z >>> 0;
  };
}

function sfc32From(a: number, b: number, c: number, d: number): RngSource {
  let w = a | 0;
  let x = b | 0;
  let y = c | 0;
  let z = d | 0;

  return {
    next(): number {
      const t = (((w + x) | 0) + z) | 0;
      z = (z + 1) | 0;
      w = x ^ (x >>> 9);
      x = (y + (y << 3)) | 0;
      y = (y << 21) | (y >>> 11);
      y = (y + t) | 0;
      return (t >>> 0) / UINT32_RANGE;
    },
    getState(): RngState {
      return [w >>> 0, x >>> 0, y >>> 0, z >>> 0];
    },
  };
}

/**
 * Builds an sfc32 source from a single seed.
 *
 * Any finite number is accepted and reduced to 32 bits, so seeds that differ
 * only above bit 32 collide. Prefer integer seeds.
 */
export function createSfc32(seed: number): RngSource {
  if (!Number.isFinite(seed)) {
    throw new RangeError(`Seed must be a finite number, received ${seed}`);
  }
  const mix = splitmix32(Math.trunc(seed) | 0);
  const source = sfc32From(mix(), mix(), mix(), mix());

  // sfc32's reference implementation discards the first few outputs so the
  // stream is well mixed before the caller sees it.
  for (let i = 0; i < 12; i += 1) {
    source.next();
  }
  return source;
}

/** Rebuilds an sfc32 source from a snapshot taken by `getState`. */
export function restoreSfc32(state: RngState): RngSource {
  if (state.length !== STATE_WORDS) {
    throw new RangeError(`sfc32 state must have ${STATE_WORDS} words, received ${state.length}`);
  }
  const [w, x, y, z] = state;
  if (w === undefined || x === undefined || y === undefined || z === undefined) {
    throw new RangeError("sfc32 state contains a missing word");
  }
  if (![w, x, y, z].every((word) => Number.isFinite(word))) {
    throw new RangeError("sfc32 state words must all be finite numbers");
  }
  return sfc32From(w, x, y, z);
}
