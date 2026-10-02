/**
 * The two screens before a wheel turns.
 *
 * Both take their callbacks as props, so they render through
 * `renderToStaticMarkup` without a DOM — which is the only level at which the
 * unfinished modes and an unavailable year can be checked at all. What a click
 * does is covered by the store's own tests.
 *
 * Every season from 1950 to 2026 is authored, so "unavailable" is currently a
 * branch the seed data cannot reach. `YearPicker` therefore takes its notion of
 * playable as a prop, and the two tests that care hand it a range with a gap in
 * it — otherwise those assertions pass just as happily with the disabling taken
 * out, which is exactly how the test they replaced was passing.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MODES } from "../lib/modes.js";
import {
  DEFAULT_SEASON_YEAR,
  decadeOf,
  isPlayable,
  playableSummary,
  SEASON_DECADES,
  yearsInDecade,
} from "../lib/seasons.js";
import { MainMenu } from "./MainMenu.js";
import { SeasonPicker } from "./SeasonPicker.js";
import { YearPicker } from "./YearPicker.js";

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

  it("shows the whole range as a rail of decades", () => {
    // The range is what says what the app is for, and after the split it is the
    // decades that carry it rather than seventy-seven year buttons. Every
    // decade, derived — the range is going to grow at both ends.
    for (const decade of SEASON_DECADES) {
      expect(html, `${decade}s`).toContain(`>${decade}s<`);
    }
  });

  it("opens on a playable year, with that year's own decade showing", () => {
    // The open decade is `decadeOf` the selection rather than state beside it,
    // so these two cannot disagree — this checks the screen a reader actually
    // lands on, not the invariant.
    expect(isPlayable(DEFAULT_SEASON_YEAR)).toBe(true);
    expect(html).toContain(`aria-label="Simulate the ${DEFAULT_SEASON_YEAR} season"`);
    expect(html).toContain(`Season in the ${decadeOf(DEFAULT_SEASON_YEAR)}s`);
  });

  it("draws every year of the open decade, and only that decade", () => {
    const open = yearsInDecade(decadeOf(DEFAULT_SEASON_YEAR));
    for (const year of open) {
      expect(html, `${year}`).toContain(`>${year}<`);
    }
    // A year from another decade is reachable, but not drawn until its decade
    // is. Picked off the data rather than written down.
    const elsewhere = SEASON_DECADES.filter((decade) => decade !== decadeOf(DEFAULT_SEASON_YEAR))
      .flatMap(yearsInDecade)
      .at(-1);
    expect(elsewhere).toBeDefined();
    expect(html).not.toContain(`>${elsewhere}<`);
  });

  it("offers exactly the seasons of that decade that have been authored", () => {
    // Counted off `isPlayable`, so authoring a season does not mean editing
    // this. Only the year buttons are weighed: the decade rail and the button
    // at the foot are also buttons, and both are enabled.
    const open = yearsInDecade(decadeOf(DEFAULT_SEASON_YEAR));
    const years = buttons(html).filter((button) =>
      open.some((year) => button.includes(`>${year}<`)),
    );
    expect(years).toHaveLength(open.length);
    for (const year of open) {
      const drawn = years.find((button) => button.includes(`>${year}<`));
      expect(drawn, `${year} should be drawn`).toBeDefined();
      expect(isDisabled(drawn ?? ""), `${year} enabled state`).toBe(!isPlayable(year));
    }
  });

  it("draws an unavailable year, disabled, rather than hiding it", () => {
    // Against the seed data this cannot happen — every season from 1950 to 2026
    // is authored — so the rule is checked against a synthetic range with a gap
    // in it. A test that only ever saw the real data would assert nothing here
    // and pass just as happily with the disabling removed.
    const open = yearsInDecade(decadeOf(DEFAULT_SEASON_YEAR));
    const missing = open.at(-1) ?? 0;
    const gappy = renderToStaticMarkup(
      <YearPicker
        year={DEFAULT_SEASON_YEAR}
        title="Season"
        lead=""
        describeYear={(year) => `Simulate the ${year} season`}
        playable={(year) => year !== missing}
      />,
    );
    const drawn = buttons(gappy).find((button) => button.includes(`>${missing}<`));
    expect(drawn, `${missing} should still be drawn`).toBeDefined();
    expect(isDisabled(drawn ?? "")).toBe(true);
    expect(gappy).toContain(`${missing} is not available yet`);
  });

  it("makes a decade with no authored season unpickable", () => {
    // Same reason as above, and the other half of the rule: picking a decade
    // has to land on a year, so one holding none cannot be picked at all.
    const dead = SEASON_DECADES.at(-1) ?? 0;
    const gappy = renderToStaticMarkup(
      <YearPicker
        year={DEFAULT_SEASON_YEAR}
        title="Season"
        lead=""
        describeYear={(year) => `Simulate the ${year} season`}
        playable={(year) => decadeOf(year) !== dead}
      />,
    );
    const rail = buttons(gappy).find((button) => button.includes(`>${dead}s<`));
    expect(rail, `${dead}s should still be drawn`).toBeDefined();
    expect(isDisabled(rail ?? "")).toBe(true);
  });

  it("picks a year rather than starting one", () => {
    // The whole point of the commit button: a reader who reaches for a year
    // first — as most will — used to be into the season before they had seen
    // that the preferences above it were theirs to choose.
    expect(html).toContain(`Begin the ${DEFAULT_SEASON_YEAR} season`);
    expect(html).toContain("Preferences");
  });

  it("says why the rest are dark", () => {
    expect(html).toContain(playableSummary());
  });
});
