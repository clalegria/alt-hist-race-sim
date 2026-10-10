/**
 * The links around a session page: the switch between the round's qualifying
 * and its race, and the rounds either side.
 *
 * **They move between places and never reveal.** A link is offered only to a
 * place the reader has reached; anything ahead is drawn disabled, and the way
 * there is Continue, in the run bar. Pure, so every rule is tested without a
 * router or a store.
 */

import { linkTo, type RunLink } from "./run-places.js";
import { isReached, type Place } from "./timeline.js";

/** A round either side of the one on screen; `link` is null while it is ahead. */
export interface RoundLink {
  readonly label: string;
  readonly link: RunLink | null;
}

export interface SessionNav {
  /** This round's qualifying and race; null for one not reached. */
  readonly qualifying: RunLink | null;
  readonly race: RunLink | null;
  /** The round before, or null on the first. */
  readonly previous: RoundLink | null;
  /** The round after, or null on the last. */
  readonly next: RoundLink | null;
}

/** The link to `at` if the reader at `cursor` has reached it, else null. */
function reached(cursor: Place, at: Place): RunLink | null {
  return isReached(cursor, at) ? linkTo(at) : null;
}

/**
 * The link to another round of `year`, keeping the session on screen: that
 * round's `kind` if reached, else its qualifying — the furthest the reader can
 * go in a round whose race is still ahead — else null, a round not reached.
 *
 * The one rule for moving between rounds, so the round links and the
 * breadcrumb's round menu cannot disagree about where a round leads.
 */
export function roundLink(
  cursor: Place,
  year: number,
  kind: "qualifying" | "race",
  round: number,
): RunLink | null {
  return (
    reached(cursor, { year, beat: { kind, round } }) ??
    reached(cursor, { year, beat: { kind: "qualifying", round } })
  );
}

/**
 * The links around the session at `place`, for a reader at `cursor`, in a
 * season of `rounds` rounds. Null when `place` is not a session.
 *
 * The rounds either side go where `roundLink` says: the same session, or the
 * next round's qualifying while its race is ahead.
 */
export function sessionNav(cursor: Place, place: Place, rounds: number): SessionNav | null {
  const beat = place.beat;
  if (beat.kind !== "qualifying" && beat.kind !== "race") {
    return null;
  }
  const { year } = place;
  const label = (round: number) => `Round ${round + 1}`;
  const after = beat.round + 1;
  return {
    qualifying: reached(cursor, { year, beat: { kind: "qualifying", round: beat.round } }),
    race: reached(cursor, { year, beat: { kind: "race", round: beat.round } }),
    previous:
      beat.round === 0
        ? null
        : {
            label: label(beat.round - 1),
            link: linkTo({ year, beat: { kind: beat.kind, round: beat.round - 1 } }),
          },
    next:
      after >= rounds
        ? null
        : {
            label: label(after),
            link: roundLink(cursor, year, beat.kind, after),
          },
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
