import { RACE_CONSTANTS, type RaceConstants } from "../race/constants.js";
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

  const races = calendar.map((round) => model.simulate(field, rng, constants, round));
  return { races };
}
