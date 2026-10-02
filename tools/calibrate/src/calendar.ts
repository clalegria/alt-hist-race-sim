/**
 * The round a single-race harness runs its i-th race at.
 *
 * `pnpm calibrate` and the tuner race one grid thousands of times. Raced with
 * no `RoundContext`, every one of those afternoons is a neutral, mid-season
 * race: home advantage pays nothing and every development trend is worth zero,
 * so the harness measures a race the season never runs. Rotating through the
 * season's own calendar instead puts each race at a real venue and a real point
 * in the year, so both are in what the harness prints, averaged as a season
 * averages them.
 *
 * Race `index` (0-based) is round `index mod n`, and the round depends on
 * nothing but the index. A harness seeding race i with seed i therefore races
 * the same afternoon at the same venue every time, which is what lets the tuner
 * compare two candidate ratings on identical dice. A run whose length is not a
 * multiple of the calendar races its first few rounds once more than the rest,
 * which thousands of races make negligible.
 *
 * The progress is the stamp `simulateSeason` puts on the same round, from the
 * same function, so a harness and a season agree on when round 3 is.
 */

import type { SeasonSeed } from "@alt-hist/data";
import { type RoundContext, seasonProgress } from "@alt-hist/engine";

/** The venue and time of year for race `index` of a run over `season`. */
export function calendarRound(season: SeasonSeed, index: number): RoundContext {
  const rounds = season.calendar.length;
  const position = index % rounds;
  const round = season.calendar[position];
  if (round === undefined) {
    throw new Error(`Season ${season.year} has no calendar to race`);
  }
  return {
    country: round.country,
    seasonProgress: seasonProgress(position, rounds),
  };
}
