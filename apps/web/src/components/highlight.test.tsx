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
import {
  PODIUM_POSITION,
  STANDOUT_POSITION,
  STANDOUT_ROW,
  STANDOUT_SURFACE,
  STANDOUT_TEXT,
} from "../lib/highlight.js";
import { driverRounds } from "../lib/results.js";
import type { World } from "../store/season.js";
import { findWorld, SEED, seededWorld, shownAt } from "../test-support.js";
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

/** Every body row on the page: the rows with cells rather than column heads. */
function bodyRows(html: string): string[] {
  return html
    .split("<tr")
    .slice(1)
    .filter((row) => row.includes("<td"));
}

/** A row's first cell, the position block, open tag to close. */
function positionCell(row: string): string {
  const start = row.indexOf("<td");
  return row.slice(start, row.indexOf("</td>", start));
}

describe("the standout accent", () => {
  it("marks pole, and nobody else on the grid", () => {
    const html = renderToStaticMarkup(<QualifyingResults race={race} />);
    expect(occurrences(html, TINT)).toBe(1);
  });

  it("marks the race winner, and nobody else in the classification", () => {
    const html = renderToStaticMarkup(<RaceClassification race={race} points={world.points} />);
    expect(occurrences(html, STANDOUT_POSITION)).toBe(1);
    // On the winner's position block, not the fastest qualifier's, and no row
    // carries a tint as well: the block is the whole accent.
    const winnerRow = bodyRows(html).find((row) => row.includes(STANDOUT_POSITION));
    expect(winnerRow).toContain("winner");
    expect(positionCell(winnerRow ?? "")).toContain(STANDOUT_POSITION);
    expect(html).not.toContain(STANDOUT_ROW);
  });

  it("marks the rest of the podium a step below the winner, and stops at third", () => {
    // Position blocks in classification order: the winner, then second, third,
    // fourth and the rest, retirements included.
    const cells = bodyRows(
      renderToStaticMarkup(<RaceClassification race={race} points={world.points} />),
    ).map(positionCell);
    const [first, second, third, ...rest] = cells;
    if (first === undefined || second === undefined || third === undefined || rest.length === 0) {
      throw new Error("the race classified fewer than four cars");
    }

    // The winner's fill contains the podium's text colour, so a podium block is
    // one with the podium's string and without the winner's.
    expect(PODIUM_POSITION).not.toContain(STANDOUT_POSITION);
    expect(STANDOUT_POSITION).toContain(PODIUM_POSITION);

    expect(first).toContain(STANDOUT_POSITION);
    for (const cell of [second, third]) {
      expect(cell).toContain(PODIUM_POSITION);
      expect(cell).not.toContain(STANDOUT_POSITION);
    }
    for (const cell of rest) {
      expect(cell).not.toContain(PODIUM_POSITION);
    }
  });

  it("keeps the podium off every other view", () => {
    // A front row is not a podium, and a championship table has no podium at
    // all — borrowing the mark there would say something the sim never claimed.
    const quali = renderToStaticMarkup(<QualifyingResults race={race} />);
    const summary = renderToStaticMarkup(<SeasonView {...shownAt(world, { kind: "summary" })} />);
    expect(quali).not.toContain(STANDOUT_POSITION);
    // The summary spends its accent on the champions' cards, not the tables.
    const blocks = bodyRows(summary).map(positionCell);
    expect(blocks.length).toBeGreaterThan(0);
    for (const cell of blocks) {
      expect(cell).not.toContain(PODIUM_POSITION);
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
    const leader = (candidate: World) =>
      championshipStandings(candidate.season, candidate.points)[0];
    const won = findWorld((candidate) => {
      const standing = leader(candidate);
      return standing !== undefined && standing.wins > 0 && standing.podiums > standing.wins;
    });
    const driverId = leader(won)?.driverId ?? "";
    const rounds = driverRounds(won.season, won.points, driverId);

    const html = renderToStaticMarkup(<RaceByRace rounds={rounds} calendar={SEED.calendar} />);
    // `STANDOUT_TEXT` is the podium's string and a substring of the winner's
    // block, so its absence covers all three.
    for (const accent of [STANDOUT_ROW, STANDOUT_TEXT]) {
      expect(html, accent).not.toContain(accent);
    }
  });

  it("marks both champions on the summary", () => {
    const html = renderToStaticMarkup(<SeasonView {...shownAt(world, { kind: "summary" })} />);
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
    expect(STANDOUT_POSITION).toContain("primary");
    expect(PODIUM_POSITION).toContain("primary");

    const quali = renderToStaticMarkup(<QualifyingResults race={race} />);
    const summary = renderToStaticMarkup(<SeasonView {...shownAt(world, { kind: "summary" })} />);
    for (const html of [quali, summary]) {
      expect(html).toContain(TINT);
      expect(html).toContain(STANDOUT_TEXT);
    }
  });
});
