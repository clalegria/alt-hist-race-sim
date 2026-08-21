/**
 * The standout accent, wherever it appears.
 *
 * Pole, the race winner and both champions are the same idea shown four ways.
 * These tests exist because "make it look coherent" is the sort of thing that
 * quietly stops being true: a fifth place gets the treatment, or one of the four
 * loses it, and nothing else notices.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { STANDOUT_ROW, STANDOUT_SURFACE, STANDOUT_TEXT } from "../lib/highlight.js";
import { createWorld } from "../store/season.js";
import { QualifyingResults } from "./QualifyingResults.js";
import { RaceClassification } from "./RaceClassification.js";
import { SeasonView } from "./SeasonView.js";

/** The background half of the surface accent — "bg-primary/5". */
const TINT = STANDOUT_SURFACE.split(" ")[1] ?? "";

const world = createWorld(3);
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

  it("marks both champions on the summary", () => {
    const html = renderToStaticMarkup(<SeasonView world={world} view={{ kind: "summary" }} />);
    const cards = occurrences(html, TINT);
    // Two champion cards, and nothing else on a page of three tables.
    expect(cards).toBe(2);
  });

  it("uses one definition, so the four cannot drift apart", () => {
    // If someone hand-writes the colour in one place instead of importing it,
    // the shared token stops being shared and this is what notices.
    expect(STANDOUT_SURFACE).toContain("primary");
    expect(STANDOUT_ROW).toContain("primary");
    expect(STANDOUT_TEXT).toContain("primary");

    const quali = renderToStaticMarkup(<QualifyingResults race={race} />);
    const summary = renderToStaticMarkup(<SeasonView world={world} view={{ kind: "summary" }} />);
    for (const html of [quali, summary]) {
      expect(html).toContain(TINT);
      expect(html).toContain(STANDOUT_TEXT);
    }
  });
});
