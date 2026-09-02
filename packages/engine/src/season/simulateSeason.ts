import { RACE_CONSTANTS, type RaceConstants } from "../race/constants.js";
import { seasonProgress } from "../race/development.js";
import { scoreAndSortRaceModel } from "../race/simulateRace.js";
import type { RaceEntrant, RaceModel, RoundContext } from "../race/types.js";
import type { Rng } from "../rng/types.js";
import type { SeasonResult } from "./types.js";

/**
 * Runs a season: the same field, once per round of the calendar, through the
 * race model.
 *
 * The calendar rather than a round count, because a round is now a *place* and
 * not just a slot — its host country is what turns home advantage on, and every
 * circuit feature after it hangs off the same `RoundContext`. Its length is the
 * number of races, so a season of `n` unremarkable rounds is `n` empty objects
 * and reads as one.
 *
 * Pure and deterministic. One RNG is threaded through every round rather than
 * re-seeding per race, so a season is a single continuous stream — round 7
 * depends on everything drawn before it. That means changing an early round
 * changes the rest of the year, which is the honest behaviour for a season and
 * the reason a bug report only needs one seed.
 *
 * The field is fixed for the whole season. Mid-season driver changes belong to
 * the market, which does not exist yet; when it does, this loop takes a field
 * per round instead of one for the year.
 *
 * Each round is handed its `seasonProgress` — 0 at the opener, 1 at the finale —
 * which is what makes a car's `developmentTrend` mean anything: a team that
 * improved through the year is slow in the early rounds of *this* loop and quick
 * in the late ones. A lone `simulateRace` has no season around it and so feels
 * no trend at all; running a season is what turns them on.
 *
 * Results only — no standings. Points are derived from these by
 * `championshipStandings`, never accumulated here.
 *
 * @throws RangeError if the calendar is empty, or the field is invalid (which
 * the race model decides).
 */
export function simulateSeason(
  field: readonly RaceEntrant[],
  calendar: readonly RoundContext[],
  rng: Rng,
  constants: RaceConstants = RACE_CONSTANTS,
  model: RaceModel = scoreAndSortRaceModel,
): SeasonResult {
  if (calendar.length < 1) {
    throw new RangeError("A season needs at least one round, received an empty calendar");
  }

  const races = calendar.map((round, index) =>
    // Where in the year each round sits, stamped on from the calendar rather
    // than authored per round: the position in this array *is* the answer, and
    // a second authored copy of it would be a second answer. It is what an
    // entrant's `developmentTrend` reads, and it is written over anything the
    // caller happened to put there — a round is at the point of the season the
    // season puts it at.
    model.simulate(field, rng, constants, {
      ...round,
      seasonProgress: seasonProgress(index, calendar.length),
    }),
  );
  return { races };
}
