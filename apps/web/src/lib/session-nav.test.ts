/**
 * The links around a session page, for every cursor against every session of
 * a season: they move between places the reader has reached and never past
 * the cursor. Counts come off the world.
 */

import { describe, expect, it } from "vitest";
import { seededWorld, YEAR } from "../test-support.js";
import { linkTo, type RunLink } from "./run-places.js";
import { roundLink, roundPlace, sessionNav } from "./session-nav.js";
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
      const nav = sessionNav(cursor, place);
      const label = `${JSON.stringify(cursor.beat)} → ${JSON.stringify(place.beat)}`;
      expect(nav, label).not.toBeNull();
      for (const link of [nav?.qualifying, nav?.race]) {
        if (link !== null && link !== undefined) {
          expect(isReached(cursor, placeOf(link)), label).toBe(true);
        }
      }
    }
  });

  it("offer this round's race only once it is reached, and its qualifying always", () => {
    for (const { cursor, place } of everyPair()) {
      const nav = sessionNav(cursor, place);
      const round =
        place.beat.kind === "race" || place.beat.kind === "qualifying" ? place.beat.round : -1;
      expect(nav?.qualifying).toEqual(linkTo(at({ kind: "qualifying", round })));
      const raceReached = isReached(cursor, at({ kind: "race", round }));
      expect(nav?.race ?? null).toEqual(raceReached ? linkTo(at({ kind: "race", round })) : null);
    }
  });

  it("are not drawn on a page that is not a session", () => {
    const summary = at({ kind: "summary" });
    expect(sessionNav(summary, at({ kind: "grid" }))).toBeNull();
    expect(sessionNav(summary, summary)).toBeNull();
  });
});

describe("moving to another round", () => {
  it("keeps the session where it is reached, falls back to qualifying, else goes nowhere", () => {
    for (const cursorBeat of beatsOf(ROUNDS)) {
      const cursor = at(cursorBeat);
      for (let round = 0; round < ROUNDS; round += 1) {
        for (const kind of ["qualifying", "race"] as const) {
          const label = `${JSON.stringify(cursorBeat)} → ${kind} ${round}`;
          const same = at({ kind, round });
          const qualifying = at({ kind: "qualifying", round });
          const place = roundPlace(cursor, YEAR, kind, round);
          if (isReached(cursor, same)) {
            expect(place, label).toEqual(same);
          } else if (isReached(cursor, qualifying)) {
            expect(place, label).toEqual(qualifying);
          } else {
            expect(place, label).toBeNull();
          }
          expect(roundLink(cursor, YEAR, kind, round), label).toEqual(
            place === null ? null : linkTo(place),
          );
        }
      }
    }
  });

  it("reaches all three outcomes across a season's cursors", () => {
    const outcomes = new Set<string>();
    for (const cursorBeat of beatsOf(ROUNDS)) {
      const place = roundPlace(at(cursorBeat), YEAR, "race", ROUNDS - 1);
      outcomes.add(place === null ? "none" : place.beat.kind);
    }
    expect([...outcomes].sort()).toEqual(["none", "qualifying", "race"]);
  });
});
