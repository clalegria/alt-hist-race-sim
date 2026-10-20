/**
 * The links around a session page: the switch between the round's qualifying
 * and its race, and where moving to another round leads.
 *
 * **They move between places and never reveal.** A link is offered only to a
 * place the reader has reached; anything ahead is drawn disabled, and the way
 * there is Continue, in the run bar. Pure, so every rule is tested without a
 * router or a store.
 */

import { linkTo, type RunLink } from "./run-places.js";
import { isReached, type Place } from "./timeline.js";

export interface SessionNav {
  /** This round's qualifying and race; null for one not reached. */
  readonly qualifying: RunLink | null;
  readonly race: RunLink | null;
}

/** The link to `at` if the reader at `cursor` has reached it, else null. */
function reached(cursor: Place, at: Place): RunLink | null {
  return isReached(cursor, at) ? linkTo(at) : null;
}

/**
 * Where moving to another round of `year` lands, keeping the session on
 * screen: that round's `kind` if reached, else its qualifying — the furthest
 * the reader can go in a round whose race is still ahead — else null, a round
 * not reached.
 *
 * The one rule for moving between rounds, so the breadcrumb's round menu and
 * the steps either side (`page-steps.ts`) cannot disagree about where a round
 * leads.
 */
export function roundPlace(
  cursor: Place,
  year: number,
  kind: "qualifying" | "race",
  round: number,
): Place | null {
  const same: Place = { year, beat: { kind, round } };
  const qualifying: Place = { year, beat: { kind: "qualifying", round } };
  return isReached(cursor, same) ? same : isReached(cursor, qualifying) ? qualifying : null;
}

/** The link to where `roundPlace` lands, or null for a round not reached. */
export function roundLink(
  cursor: Place,
  year: number,
  kind: "qualifying" | "race",
  round: number,
): RunLink | null {
  const place = roundPlace(cursor, year, kind, round);
  return place === null ? null : linkTo(place);
}

/**
 * The switch between the qualifying and the race of the session at `place`,
 * for a reader at `cursor`. Null when `place` is not a session.
 */
export function sessionNav(cursor: Place, place: Place): SessionNav | null {
  const beat = place.beat;
  if (beat.kind !== "qualifying" && beat.kind !== "race") {
    return null;
  }
  const { year } = place;
  return {
    qualifying: reached(cursor, { year, beat: { kind: "qualifying", round: beat.round } }),
    race: reached(cursor, { year, beat: { kind: "race", round: beat.round } }),
  };
}

/** A round's two pages: where the calendar's expansion of a round raced leads. */
export interface RoundPages {
  readonly qualifying: RunLink;
  readonly race: RunLink;
}

/** The pages of `round` (zero-based) of `year`. Only for a round whose race is reached. */
export function roundPages(year: number, round: number): RoundPages {
  return {
    qualifying: linkTo({ year, beat: { kind: "qualifying", round } }),
    race: linkTo({ year, beat: { kind: "race", round } }),
  };
}

/** The race page of `round` (zero-based) of `year`: where a race by race's round leads. */
export function racePage(year: number, round: number): RunLink {
  return roundPages(year, round).race;
}
