/**
 * The standout accent, wherever it appears.
 *
 * Pole, the race winner and both champions are the same idea shown four ways,
 * and the rest of the podium is the same idea again at half strength. These
 * tests exist because "make it look coherent" is the sort of thing that quietly
 * stops being true: a fifth place gets the treatment, or one of the four loses
 * it, and nothing else notices.
 */

import { championshipStandings } from "@alt-hist/engine";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PODIUM_ROW, STANDOUT_ROW, STANDOUT_SURFACE, STANDOUT_TEXT } from "../lib/highlight.js";
import { driverRounds } from "../lib/results.js";
import type { World } from "../store/season.js";
import { findWorld, SEED, seededWorld } from "../test-support.js";
import { QualifyingResults } from "./QualifyingResults.js";
import { RaceByRace } from "./RaceByRace.js";
import { RaceClassification } from "./RaceClassification.js";
import { SeasonView } from "./SeasonView.js";

/** The background half of the surface accent — "bg-primary/5". */
const TINT = STANDOUT_SURFACE.split(" ")[1] ?? "";

const world = seededWorld();
const race = world.season.races[0];
if (race === undefined) {
  throw new Error("seeded world has no races");
}

/** How many times a class string appears. No regex: these contain slashes. */
function occurrences(html: string, marker: string): number {
  return html.split(marker).length - 1;
}

describe("the standout accent", () => {
  it("marks pole, and nobody else on the grid", () => {
    const html = renderToStaticMarkup(<QualifyingResults race={race} />);
    expect(occurrences(html, TINT)).toBe(1);
  });

  it("marks the race winner, and nobody else in the classification", () => {
    const html = renderToStaticMarkup(<RaceClassification race={race} />);
    expect(occurrences(html, STANDOUT_ROW)).toBe(1);
    // The winner's row, not the fastest qualifier's.
    const winnerRow = html.split("<tr").find((row) => row.includes(STANDOUT_ROW));
    expect(winnerRow).toContain("winner");
  });

  it("marks the rest of the podium a step below the winner, and stops at third", () => {
    // Rows in classification order, past the prefix and the header row: the
    // winner, then second, third, fourth.
    const rows = renderToStaticMarkup(<RaceClassification race={race} />)
      .split("<tr")
      .slice(2);
    const [first, second, third, fourth] = rows;
    if (fourth === undefined) {
      throw new Error("the race classified fewer than four cars");
    }

    // The two accents are separate strings, so neither can be mistaken for the
    // other by a substring match.
    expect(PODIUM_ROW).not.toContain(STANDOUT_ROW);
    expect(STANDOUT_ROW).not.toContain(PODIUM_ROW);

    expect(first).toContain(STANDOUT_ROW);
    expect(first).not.toContain(PODIUM_ROW);
    for (const row of [second, third]) {
      expect(row).toContain(PODIUM_ROW);
      expect(row).not.toContain(STANDOUT_ROW);
    }
    expect(fourth).not.toContain(PODIUM_ROW);
    expect(fourth).not.toContain(STANDOUT_ROW);
    // And nowhere else down the sheet, retirements included.
    expect(occurrences(rows.join("<tr"), PODIUM_ROW)).toBe(2);
  });

  it("keeps the podium off every other view", () => {
    // A front row is not a podium, and a championship table has no podium at
    // all — borrowing the mark there would say something the sim never claimed.
    const quali = renderToStaticMarkup(<QualifyingResults race={race} />);
    const summary = renderToStaticMarkup(<SeasonView world={world} view={{ kind: "summary" }} />);
    for (const html of [quali, summary]) {
      expect(html).not.toContain(PODIUM_ROW);
    }
  });

  it("leaves a driver's own season unaccented, wins and all", () => {
    // The expansion under a championship row is a season, not a race. Accenting
    // its wins would put four or five of them on a page whose accent means "won
    // the championship", and the podium tint belongs to the race that was run.
    //
    // The season is *searched* for a driver holding both a win and a podium,
    // rather than assumed: on a season with neither, this would pass by having
    // nothing to accent in the first place.
    const leader = (candidate: World) => championshipStandings(candidate.season)[0];
    const won = findWorld((candidate) => {
      const standing = leader(candidate);
      return standing !== undefined && standing.wins > 0 && standing.podiums > standing.wins;
    });
    const driverId = leader(won)?.driverId ?? "";
    const rounds = driverRounds(won.season, driverId);

    const html = renderToStaticMarkup(<RaceByRace rounds={rounds} calendar={SEED.calendar} />);
    // The row fills only. `STANDOUT_TEXT` is "text-primary", which is a
    // substring of the `text-primary/80` a retirement's status line carries in
    // the classification and here — the same trap the note on `PODIUM_TEXT`
    // describes, so the fills are what this can honestly assert.
    for (const accent of [STANDOUT_ROW, PODIUM_ROW]) {
      expect(html, accent).not.toContain(accent);
    }
  });

  it("marks both champions on the summary", () => {
    const html = renderToStaticMarkup(<SeasonView world={world} view={{ kind: "summary" }} />);
    const cards = occurrences(html, TINT);
    // Two champion cards, and nothing else on a page of three tables.
    expect(cards).toBe(2);
  });

  // Removed: a test that pinned seed 302280 for ending with Piquet and Jones
  // level on points. It went red the first time the 1980 ratings were tweaked,
  // which is exactly the failure the testing rule in `CLAUDE.md` exists to stop.
  // What it was really covering — that a challenger who can only *equal* the
  // leader is not a live threat once the last round is run — is a rule, and is
  // unit-tested against synthetic standings in `engine/src/season/titles.test.ts`.

  it("uses one definition, so the four cannot drift apart", () => {
    // If someone hand-writes the colour in one place instead of importing it,
    // the shared token stops being shared and this is what notices.
    expect(STANDOUT_SURFACE).toContain("primary");
    expect(STANDOUT_ROW).toContain("primary");
    expect(STANDOUT_TEXT).toContain("primary");
    expect(PODIUM_ROW).toContain("primary");

    const quali = renderToStaticMarkup(<QualifyingResults race={race} />);
    const summary = renderToStaticMarkup(<SeasonView world={world} view={{ kind: "summary" }} />);
    for (const html of [quali, summary]) {
      expect(html).toContain(TINT);
      expect(html).toContain(STANDOUT_TEXT);
    }
  });
});
