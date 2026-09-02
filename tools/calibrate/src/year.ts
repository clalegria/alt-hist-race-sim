/**
 * Which season a tool runs.
 *
 * Every tool here used to be pinned to 1980 because 1980 was all there was.
 * Now that seasons are authored one file at a time, each takes an optional
 * `--year`, defaulting to the earliest authored season so every existing
 * invocation means what it always meant.
 *
 *   pnpm season 7 --year 1981
 *
 * An unauthored year throws by name rather than falling back, for the same
 * reason the app does: a silent substitution prints someone else's grid under
 * the wrong heading.
 */

import { authoredSeasons, FIRST_AUTHORED_SEASON, hasSeason } from "@alt-hist/data";

/** The year named by `--year <n>` / `-y <n>`, or the earliest authored one. */
export function parseYear(argv: readonly string[]): number {
  const flag = argv.findIndex((arg) => arg === "--year" || arg === "-y");
  if (flag === -1) {
    return FIRST_AUTHORED_SEASON;
  }

  const raw = argv[flag + 1];
  const parsed = raw === undefined ? Number.NaN : Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`--year needs a season, received "${raw ?? ""}"`);
  }
  if (!hasSeason(parsed)) {
    throw new Error(
      `Season ${parsed} has not been authored. Available: ${authoredSeasons.join(", ")}`,
    );
  }
  return parsed;
}

/** Every flag these tools take, with the value each one swallows after it. */
const FLAGS = new Set(["--year", "-y", "--randomness", "-r", "--phase", "-p", "--wet", "-w"]);

/**
 * Positional arguments, with any flag-and-value pair removed.
 *
 * The tools read their seed and race count by position, so a flag has to come
 * out before they count. Named rather than "anything starting with `-`" because
 * a seed may legitimately be negative — `pnpm race -12` is a seed, not a flag.
 */
export function withoutFlags(argv: readonly string[]): string[] {
  const kept: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg !== undefined && FLAGS.has(arg)) {
      index += 1;
      continue;
    }
    if (arg !== undefined) {
      kept.push(arg);
    }
  }
  return kept;
}
