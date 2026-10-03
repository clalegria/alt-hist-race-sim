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

/**
 * The links around the session at `place`, for a reader at `cursor`, in a
 * season of `rounds` rounds. Null when `place` is not a session.
 *
 * The rounds either side keep the session on screen — race to race, qualifying
 * to qualifying — except where the next round's race is still ahead and its
 * qualifying is not: that link goes to the qualifying, the furthest the reader
 * can go in that round.
 */
export function sessionNav(cursor: Place, place: Place, rounds: number): SessionNav | null {
  const beat = place.beat;
  if (beat.kind !== "qualifying" && beat.kind !== "race") {
    return null;
  }
  const { year } = place;
  const reached = (at: Place): RunLink | null => (isReached(cursor, at) ? linkTo(at) : null);
  const label = (round: number) => `Round ${round + 1}`;
  const after = beat.round + 1;
  return {
    qualifying: reached({ year, beat: { kind: "qualifying", round: beat.round } }),
    race: reached({ year, beat: { kind: "race", round: beat.round } }),
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
            link:
              reached({ year, beat: { kind: beat.kind, round: after } }) ??
              reached({ year, beat: { kind: "qualifying", round: after } }),
          },
  };
}
