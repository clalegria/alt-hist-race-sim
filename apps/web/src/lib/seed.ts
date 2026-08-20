/**
 * Seed handling for the UI.
 *
 * `Math.random()` is banned inside the engine — every simulated outcome has to
 * come from the injected seeded PRNG, or nothing is reproducible. Picking
 * *which* seed to run is the opposite case: it is a user action, not part of the
 * simulation, and it happens before any generator exists. So it belongs here, in
 * the app, and never in `packages/engine`.
 */

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
