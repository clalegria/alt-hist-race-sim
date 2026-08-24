/**
 * The two screens before a wheel turns.
 *
 * Both take their callbacks as props, so they render through
 * `renderToStaticMarkup` without a DOM — which is the only level at which the
 * unfinished mode and the 46 unauthored years can be checked at all. What a
 * click does is covered by the store's own tests.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BackBar } from "../App.js";
import { MODES } from "../lib/modes.js";
import { LAST_SEASON, PLAYABLE_SEASONS, playableSummary, SEASON_YEARS } from "../lib/seasons.js";
import { MainMenu } from "./MainMenu.js";
import { SeasonPicker } from "./SeasonPicker.js";

const noop = () => {};

/** Every `<button>` in the markup, so enabled and disabled can be counted apart. */
function buttons(html: string): string[] {
  return html.split("<button").slice(1);
}

/**
 * Whether a button is actually disabled — the rendered attribute, not the word.
 * Several of these carry `disabled:opacity-50` in their class list and are
 * perfectly clickable.
 */
function isDisabled(button: string): boolean {
  return button.slice(0, button.indexOf(">")).includes('disabled=""');
}

describe("the main menu", () => {
  const html = renderToStaticMarkup(<MainMenu onChoose={noop} />);

  it("says what the app is before offering to run anything", () => {
    expect(html).toContain("Alternate history motorsport simulator");
    expect(html).toContain("Rewrite motorsport history");
  });

  it("lists every mode, finished or not", () => {
    // Titles come from `MODES` rather than being written out here: they are
    // copy, and a test that pins them fails for a reason that is not a bug.
    expect(MODES.length).toBeGreaterThan(0);
    for (const mode of MODES) {
      expect(html, mode.id).toContain(mode.title);
    }
  });

  it("greys out the modes that do not exist yet, and only those", () => {
    const unfinished = MODES.filter((mode) => !mode.available);
    const disabled = buttons(html).filter(isDisabled);
    expect(disabled).toHaveLength(unfinished.length);
    // Named on the card rather than left as a button that silently does
    // nothing when pressed.
    for (const [index, mode] of unfinished.entries()) {
      expect(disabled[index], mode.id).toContain("Not yet");
      expect(disabled[index], mode.id).toContain(mode.title);
    }
  });

  it("reveals nothing about a season nobody has started", () => {
    expect(html).not.toContain("Williams");
    expect(html).not.toContain("Championship");
  });
});

describe("the season picker", () => {
  const html = renderToStaticMarkup(<SeasonPicker onStart={noop} />);

  it("lists the whole range, so the shape of the thing is visible", () => {
    for (const year of [1980, 1990, 2005, LAST_SEASON]) {
      expect(html, `${year}`).toContain(`>${year}<`);
    }
  });

  it("offers exactly the seasons that have been authored", () => {
    // The authored years are live and every other year is disabled — and the
    // picker draws nothing else, the way back being in the bar above it.
    // Counted off `PLAYABLE_SEASONS`, so authoring a season does not mean
    // editing this.
    const enabled = buttons(html).filter((button) => !isDisabled(button));
    expect(enabled).toHaveLength(PLAYABLE_SEASONS.length);
    for (const year of PLAYABLE_SEASONS) {
      expect(
        enabled.some((button) => button.includes(`>${year}<`)),
        `${year} should be selectable`,
      ).toBe(true);
    }
    expect(buttons(html).filter(isDisabled)).toHaveLength(
      SEASON_YEARS.length - PLAYABLE_SEASONS.length,
    );
  });

  it("says why the rest are dark", () => {
    expect(html).toContain(playableSummary());
  });

  it("leaves a way back to the menu, in the bar rather than in the page", () => {
    // Same place the season screen keeps its buttons, so the reader is not
    // hunting for this one below six rows of years.
    expect(html).not.toContain(">Back<");
    expect(renderToStaticMarkup(<BackBar onBack={noop} />)).toContain(">Back<");
  });
});
