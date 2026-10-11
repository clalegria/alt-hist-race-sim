/**
 * The Keep the first season's teams setting, and what the grid says about a kept year.
 * Rendered without a DOM, like the rest of the setup screen; what it records on
 * a run is the era's store tests.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { KeptNotes } from "../lib/kept.js";
import { HISTORICAL_SETTINGS, OPENING_SEAT_RULES, type RunSettings } from "../lib/run-settings.js";
import { useSeasonStore } from "../store/season.js";
import { FOLDING_YEAR, settingsForm, shownAt } from "../test-support.js";
import { keptSentences } from "./LineupChanges.js";
import { SeasonView } from "./SeasonView.js";
import { TeamsAndSeatsSetting } from "./TeamsAndSeatsSetting.js";

/** An input's attribute, read off the markup rather than matched as one string. */
function inputValue(html: string, label: string): string | undefined {
  const input = html.match(new RegExp(`<input[^>]*aria-label="${label}"[^>]*>`))?.[0];
  return input?.match(/value="([^"]*)"/)?.[1];
}

describe("the teams and seats setting", () => {
  it("presses No while historical, with nothing below it", () => {
    const html = renderToStaticMarkup(<TeamsAndSeatsSetting teamsAndSeats={null} />);
    expect(html).toMatch(/aria-pressed="true"[^>]*>No</);
    expect(html).not.toContain("Only sign drivers aged");
    expect(html).not.toContain("The best available driver");
  });

  it("draws the fill, the ages and the real-grid box under Yes", () => {
    const html = renderToStaticMarkup(<TeamsAndSeatsSetting teamsAndSeats={OPENING_SEAT_RULES} />);
    expect(html).toMatch(/aria-pressed="true"[^>]*>Yes</);
    expect(html).toMatch(/aria-pressed="true"[^>]*>Last year&#x27;s driver, if possible</);
    expect(html).toContain("Only sign drivers aged");
    expect(inputValue(html, "Youngest driver age")).toBe(String(OPENING_SEAT_RULES.minAge));
    expect(inputValue(html, "Oldest driver age")).toBe(String(OPENING_SEAT_RULES.maxAge));
    expect(html).toMatch(/<input[^>]*type="checkbox"[^>]*checked=""/);
  });

  it("shows the other fill and an unticked box when that is the answer", () => {
    const html = renderToStaticMarkup(
      <TeamsAndSeatsSetting
        teamsAndSeats={{ ...OPENING_SEAT_RULES, fill: "best", activeOnly: false }}
      />,
    );
    expect(html).toMatch(/aria-pressed="true"[^>]*>The best available driver</);
    expect(html).not.toMatch(/<input[^>]*type="checkbox"[^>]*checked=""/);
  });

  it("is offered on the era's screen and not a season's", () => {
    const name = 'aria-label="Keep the first season&#x27;s teams"';
    expect(settingsForm("era")).toContain(name);
    expect(settingsForm("season")).not.toContain(name);
  });
});

describe("what the grid says about a kept year", () => {
  /** The grid of the year after a team folds, in an era from the year before. */
  function ghostYear(
    settings: RunSettings = { ...HISTORICAL_SETTINGS, teamsAndSeats: OPENING_SEAT_RULES },
  ) {
    useSeasonStore.getState().simulateEra(9, FOLDING_YEAR.year, undefined, settings);
    useSeasonStore.getState().jumpTo({ year: FOLDING_YEAR.year + 1, beat: { kind: "grid" } });
    const run = useSeasonStore.getState().run;
    if (run === null) {
      throw new Error("expected a run");
    }
    return renderToStaticMarkup(
      <SeasonView {...shownAt(run.world, { kind: "grid" })} inEra tab="grid" />,
    );
  }

  it("marks the ghost and says what Keep did", () => {
    const html = ghostYear();
    expect(html).toContain(`Gone by ${FOLDING_YEAR.year + 1} in real life`);
    expect(html).toContain(`Kept from ${FOLDING_YEAR.year}`);
  });

  it("says nothing of the kind when the teams are as they happened", () => {
    const html = ghostYear(HISTORICAL_SETTINGS);
    expect(html).not.toContain("field: its");
    expect(html).not.toContain("Kept from");
  });
});

describe("the kept year's sentences", () => {
  const none: KeptNotes = {
    from: 2000,
    ghosts: {},
    carried: new Set(),
    signed: new Set(),
    short: [],
  };
  const name = (teamId: string) => teamId.toUpperCase();

  it("says nothing for a year Keep left as history had it", () => {
    expect(keptSentences(none, 2001, name)).toEqual([]);
  });

  it("names the ghosts and their cars, counts the seats, and names who is short", () => {
    const notes: KeptNotes = {
      ...none,
      ghosts: { red: 2000, blue: 1999 },
      carried: new Set(["a", "b"]),
      signed: new Set(["c"]),
      short: [
        { teamId: "red", cars: 1 },
        { teamId: "green", cars: 0 },
      ],
    };
    expect(keptSentences(notes, 2001, name)).toEqual([
      "Gone by 2001 in real life, still racing their last real car: RED (2000) and BLUE (1999).",
      "Seats that were empty in real life: 2 kept last year's driver, 1 new signing.",
      "No free driver to sign, so RED runs one car and GREEN sits the year out.",
    ]);
  });
});
