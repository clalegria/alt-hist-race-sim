/**
 * Seed handling for the UI.
 *
 * `Math.random()` is banned inside the engine — every simulated outcome has to
 * come from the injected seeded PRNG, or nothing is reproducible. Picking
 * *which* seed to run is the opposite case: it is a user action, not part of the
 * simulation, and it happens before any generator exists. So it belongs here, in
 * the app, and never in `packages/engine`.
 */

import { createRngFromState, type RngState } from "@alt-hist/engine";

/** The largest seed we generate. Keeps it short enough to read aloud or retype. */
const MAX_SEED = 1_000_000;

export function randomSeed(): number {
  return Math.floor(Math.random() * MAX_SEED) + 1;
}

/** Reads a seed box that may be empty or half-typed, falling back when it is. */
export function parseSeed(raw: string, fallback: number): number {
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * The seed for the season after this one, drawn from where the last one's
 * generator stopped.
 *
 * An era has to keep going without asking the reader for another number, and
 * `Math.random()` would make the whole run unrepeatable from its first seed. So
 * the next year's dice come out of the *current* year's stream, resumed from the
 * snapshot the world carries: an era is reproducible end to end from the seed it
 * started on, and the years still differ from each other.
 */
export function nextSeed(state: RngState): number {
  return createRngFromState(state).nextInt(1, MAX_SEED + 1);
}
