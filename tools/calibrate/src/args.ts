/**
 * The positional arguments every tool here takes.
 *
 * Each tool reads at most one number off the command line — a seed, or a count
 * of runs — and each had written its own parser for it. The flags they take are
 * in `year.ts` (`--year`) and, for the season harness, beside its own `--mode`.
 *
 * Both throw on nonsense rather than falling back to the default, for the same
 * reason `parseYear` throws on an unauthored season: a silent substitution
 * prints one run's numbers under another run's heading.
 */

/**
 * The seed at `argv[2]`, or 1.
 *
 * Negative and zero seeds are allowed — the generator takes any integer, and a
 * tool is where you go to reproduce whatever a bug report quoted.
 */
export function parseSeed(argv: readonly string[], fallback = 1): number {
  const raw = argv[2];
  if (raw === undefined) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Seed must be an integer, received "${raw}"`);
  }
  return parsed;
}

/**
 * How many times to run, or the tool's default.
 *
 * `noun` names the thing being counted so the error reads in the tool's own
 * terms — "Race count", "Season count" — rather than in this module's.
 */
export function parseCount(raw: string | undefined, fallback: number, noun: string): number {
  if (raw === undefined) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`${noun} must be a positive integer, received "${raw}"`);
  }
  return parsed;
}
