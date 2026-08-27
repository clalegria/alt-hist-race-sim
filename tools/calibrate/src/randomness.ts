/**
 * How much the dice decide, for the tools.
 *
 * The app picks a level on its setup screen; here it is a flag, so a run that
 * reproduces a bug report can be given the same level the report was made under.
 * Without it the tools would only ever print the default — which is the right
 * default, being the calibrated one, but not the only season anyone plays.
 *
 *   pnpm season 7 --randomness 5
 *
 * Throws on anything that is not a level, for the same reason `parseYear`
 * throws on an unauthored season: a silent fallback prints one run's numbers
 * under another run's heading. That matters most for `pnpm calibrate`, where
 * the heading is the only thing saying what was measured.
 */

import {
  DEFAULT_RANDOMNESS_LEVEL,
  RANDOMNESS_LEVELS,
  type RandomnessLevel,
} from "@alt-hist/engine";

/** The level named by `--randomness <n>` / `-r <n>`, or the calibrated default. */
export function parseRandomness(argv: readonly string[]): RandomnessLevel {
  const flag = argv.findIndex((arg) => arg === "--randomness" || arg === "-r");
  if (flag === -1) {
    return DEFAULT_RANDOMNESS_LEVEL;
  }

  const raw = argv[flag + 1];
  const parsed = raw === undefined ? Number.NaN : Number.parseInt(raw, 10);
  const level = RANDOMNESS_LEVELS.find((candidate) => candidate === parsed);
  if (level === undefined) {
    throw new Error(
      `--randomness needs one of ${RANDOMNESS_LEVELS.join(", ")}, received "${raw ?? ""}"`,
    );
  }
  return level;
}
