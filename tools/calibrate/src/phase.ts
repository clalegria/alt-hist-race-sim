/**
 * Which part of the season `pnpm race` runs its one afternoon at.
 *
 * A lone race has no year around it, so a car's
 * `developmentTrend` has nothing to read: `simulateRace` with no
 * `seasonProgress` is mid-season, where every trend is worth exactly nothing.
 * That is the right default — a harness that silently ran the opener would
 * answer a different question under the same heading.
 *
 * But "what is this grid worth in April, and in October?" is precisely the
 * question development exists to raise, and a season harness answers it only in
 * aggregate. So it is a flag:
 *
 *   pnpm race 7 --phase start   # round one: +ve trends at their worst
 *   pnpm race 7 --phase end     # the same afternoon as the finale
 *
 * Throws on anything else, for the reason `parseYear` and `parseRandomness` do:
 * a silent fallback prints one run's numbers under another run's heading.
 *
 * Nothing else takes it. The season harnesses, `pnpm calibrate` and the tuner
 * all race the real calendar (`calendar.ts`), so every round already knows
 * where it sits and development is on throughout.
 */

import { MID_SEASON_PROGRESS, type RoundContext } from "@alt-hist/engine";

/** The opener, the middle of the year, or the finale. */
export type SeasonPhase = "start" | "mid" | "end";

export const SEASON_PHASES: readonly SeasonPhase[] = ["start", "mid", "end"];

/** Mid-season: no trend applies, and the race is scored as it always was. */
export const DEFAULT_SEASON_PHASE: SeasonPhase = "mid";

/** The phase named by `--phase <name>` / `-p <name>`, or mid-season. */
export function parsePhase(argv: readonly string[]): SeasonPhase {
  const flag = argv.findIndex((arg) => arg === "--phase" || arg === "-p");
  if (flag === -1) {
    return DEFAULT_SEASON_PHASE;
  }

  const raw = argv[flag + 1];
  const phase = SEASON_PHASES.find((candidate) => candidate === raw);
  if (phase === undefined) {
    throw new Error(`--phase needs one of ${SEASON_PHASES.join(", ")}, received "${raw ?? ""}"`);
  }
  return phase;
}

/**
 * The round to hand `simulateRace`.
 *
 * Mid-season is an *empty* round rather than one carrying
 * `MID_SEASON_PROGRESS`, even though the two score identically. The empty object
 * is what every caller passed before development existed, and keeping the
 * default byte-for-byte what it was is what stops the feature moving a run that
 * did not ask for it.
 *
 * No `country` either way: `pnpm race` has no venue, so home advantage pays
 * nothing there.
 */
export function phaseRound(phase: SeasonPhase): RoundContext {
  switch (phase) {
    case "start":
      return { seasonProgress: 0 };
    case "end":
      return { seasonProgress: 1 };
    default:
      return {};
  }
}

/** How a run says which phase it measured, in its own heading. */
export function phaseLabel(phase: SeasonPhase): string {
  switch (phase) {
    case "start":
      return "season opener";
    case "end":
      return "season finale";
    default:
      return `mid-season (progress ${MID_SEASON_PROGRESS})`;
  }
}
