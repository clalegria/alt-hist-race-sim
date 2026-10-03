/**
 * The links around a session page, for every cursor against every session of
 * a season: they move between places the reader has reached and never past
 * the cursor. Counts come off the world.
 */

import { describe, expect, it } from "vitest";
import { seededWorld, YEAR } from "../test-support.js";
import { linkTo, type RunLink } from "./run-places.js";
import { sessionNav } from "./session-nav.js";
import { type Beat, isReached, type Place } from "./timeline.js";

const ROUNDS = seededWorld(3, "aged", YEAR).season.races.length;

/** Every beat of a season with `rounds` rounds, grid to summary. */
function beatsOf(rounds: number): Beat[] {
  const beats: Beat[] = [{ kind: "grid" }];
  for (let round = 0; round < rounds; round += 1) {
    beats.push({ kind: "qualifying", round }, { kind: "race", round });
  }
  beats.push({ kind: "summary" });
  return beats;
}

const at = (beat: Beat): Place => ({ year: YEAR, beat });

/** The place a session link names, read back off its params. */
function placeOf(link: RunLink): Place {
  const params = "params" in link ? (link.params as Record<string, string>) : {};
  const round = Number(params.round) - 1;
  const kind = link.to.endsWith("qualifying") ? "qualifying" : "race";
  return { year: Number(params.year), beat: { kind, round } };
}

/** Every reached cursor × reached session, as pairs. */
function everyPair(): { cursor: Place; place: Place }[] {
  const pairs: { cursor: Place; place: Place }[] = [];
  for (const cursorBeat of beatsOf(ROUNDS)) {
    const cursor = at(cursorBeat);
    for (const beat of beatsOf(ROUNDS)) {
      if ((beat.kind === "qualifying" || beat.kind === "race") && isReached(cursor, at(beat))) {
        pairs.push({ cursor, place: at(beat) });
      }
    }
  }
  return pairs;
}

describe("the links around a session", () => {
  it("never link past the cursor, from any session the reader has reached", () => {
    for (const { cursor, place } of everyPair()) {
      const nav = sessionNav(cursor, place, ROUNDS);
      const label = `${JSON.stringify(cursor.beat)} → ${JSON.stringify(place.beat)}`;
      expect(nav, label).not.toBeNull();
      for (const link of [nav?.qualifying, nav?.race, nav?.previous?.link, nav?.next?.link]) {
        if (link !== null && link !== undefined) {
          expect(isReached(cursor, placeOf(link)), label).toBe(true);
        }
      }
    }
  });

  it("offer this round's race only once it is reached, and its qualifying always", () => {
    for (const { cursor, place } of everyPair()) {
      const nav = sessionNav(cursor, place, ROUNDS);
      const round =
        place.beat.kind === "race" || place.beat.kind === "qualifying" ? place.beat.round : -1;
      expect(nav?.qualifying).toEqual(linkTo(at({ kind: "qualifying", round })));
      const raceReached = isReached(cursor, at({ kind: "race", round }));
      expect(nav?.race ?? null).toEqual(raceReached ? linkTo(at({ kind: "race", round })) : null);
    }
  });

  it("keep to the session on screen, or the next round's qualifying while its race is ahead", () => {
    for (const { cursor, place } of everyPair()) {
      const beat = place.beat;
      if (beat.kind !== "qualifying" && beat.kind !== "race") {
        continue;
      }
      const nav = sessionNav(cursor, place, ROUNDS);
      if (beat.round > 0) {
        expect(nav?.previous?.link).toEqual(linkTo(at({ kind: beat.kind, round: beat.round - 1 })));
      }
      const next = beat.round + 1;
      if (next >= ROUNDS) {
        continue;
      }
      const same = at({ kind: beat.kind, round: next });
      const qualifying = at({ kind: "qualifying", round: next });
      const expected = isReached(cursor, same)
        ? linkTo(same)
        : isReached(cursor, qualifying)
          ? linkTo(qualifying)
          : null;
      expect(nav?.next?.link ?? null).toEqual(expected);
      expect(nav?.next?.label).toBe(`Round ${next + 1}`);
    }
  });

  it("have no round before the first or after the last", () => {
    const summary = at({ kind: "summary" });
    expect(sessionNav(summary, at({ kind: "race", round: 0 }), ROUNDS)?.previous).toBeNull();
    expect(sessionNav(summary, at({ kind: "race", round: ROUNDS - 1 }), ROUNDS)?.next).toBeNull();
  });

  it("are not drawn on a page that is not a session", () => {
    const summary = at({ kind: "summary" });
    expect(sessionNav(summary, at({ kind: "grid" }), ROUNDS)).toBeNull();
    expect(sessionNav(summary, summary, ROUNDS)).toBeNull();
  });
});
