/**
 * The Teams and seats setting, and what the grid says about a kept year.
 * Rendered without a DOM, like the rest of the setup screen; what it records on
 * a run is the era's store tests.
 */

import { emptySeats } from "@alt-hist/data";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { KeptNotes } from "../lib/kept.js";
import { pendingReason } from "../lib/run-bar.js";
import { HISTORICAL_SETTINGS, OPENING_SEAT_RULES, type RunSettings } from "../lib/run-settings.js";
import { useSeasonStore } from "../store/season.js";
import { built, FOLDING_YEAR, pendingRun, shownAt } from "../test-support.js";
import { keptSentences } from "./LineupChanges.js";
import { PendingGrid } from "./PendingGrid.js";
import { EraPicker, SeasonPicker } from "./SeasonPicker.js";
import { SeasonView } from "./SeasonView.js";
import { TeamsAndSeatsSetting } from "./TeamsAndSeatsSetting.js";

const noop = () => {};

/** An input's attribute, read off the markup rather than matched as one string. */
function inputValue(html: string, label: string): string | undefined {
  const input = html.match(new RegExp(`<input[^>]*aria-label="${label}"[^>]*>`))?.[0];
  return input?.match(/value="([^"]*)"/)?.[1];
}

describe("the teams and seats setting", () => {
  it("presses As they happened while historical, with nothing below it", () => {
    const html = renderToStaticMarkup(<TeamsAndSeatsSetting teamsAndSeats={null} />);
    expect(html).toMatch(/aria-pressed="true"[^>]*>As they happened</);
    expect(html).not.toContain("Driver ages");
    expect(html).not.toContain("Best available");
  });

  it("draws the fill, the ages and the active-only box under Keep", () => {
    const html = renderToStaticMarkup(<TeamsAndSeatsSetting teamsAndSeats={OPENING_SEAT_RULES} />);
    expect(html).toMatch(/aria-pressed="true"[^>]*>Keep the starting grid</);
    expect(html).toMatch(/aria-pressed="true"[^>]*>Filled automatically</);
    expect(html).toMatch(/aria-pressed="false"[^>]*>I fill them</);
    expect(html).toMatch(/aria-pressed="true"[^>]*>Previous year&#x27;s drivers first</);
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
    expect(html).toMatch(/aria-pressed="true"[^>]*>Best available</);
    expect(html).not.toMatch(/<input[^>]*type="checkbox"[^>]*checked=""/);
  });

  it("keeps only the ages under I fill them, which signs nobody", () => {
    const html = renderToStaticMarkup(
      <TeamsAndSeatsSetting teamsAndSeats={{ ...OPENING_SEAT_RULES, fill: "reader" }} />,
    );
    expect(html).toMatch(/aria-pressed="true"[^>]*>I fill them</);
    expect(html).toMatch(/aria-pressed="false"[^>]*>Filled automatically</);
    expect(html).not.toContain("Empty seats filled with");
    expect(html).not.toContain("Best available");
    expect(html).not.toContain('type="checkbox"');
    expect(inputValue(html, "Youngest driver age")).toBe(String(OPENING_SEAT_RULES.minAge));
    expect(html).toContain("the run stops at that year&#x27;s grid");
  });

  it("is offered on the era's screen and not a season's", () => {
    expect(renderToStaticMarkup(<EraPicker onStart={noop} />)).toContain("Teams and seats");
    expect(renderToStaticMarkup(<SeasonPicker onStart={noop} />)).not.toContain("Teams and seats");
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
      <SeasonView {...shownAt(built(run).world, { kind: "grid" })} inEra tab="grid" />,
    );
  }

  it("marks the ghost and says what Keep did", () => {
    const html = ghostYear();
    expect(html).toContain(`Not in the ${FOLDING_YEAR.year + 1} field`);
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
      "Not in the 2001 field, racing their last real car: RED (2000) and BLUE (1999).",
      "Seats history left empty: 2 kept from last year, 1 signed.",
      "Nobody free to sign: RED runs one car and GREEN sits the year out.",
    ]);
  });
});

describe("a year waiting on the reader", () => {
  const run = pendingRun();
  const html = renderToStaticMarkup(<PendingGrid run={run} />);
  const empty = emptySeats(run.pending.kept.seats).length;

  it("opens the editor on its seats, which cannot be put away until they are filled", () => {
    expect(html).toContain(pendingReason(run));
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Apply grid</);
    expect(html).not.toContain(">Cancel<");
    expect(html).not.toContain(">Edit grid<");
    expect((html.match(/>Empty seat</g) ?? []).length).toBe(empty);
  });

  it("says what Keep did to the year, as a kept year's grid does", () => {
    expect(html).toContain(`Kept from ${run.run.startYear}`);
    // Its empty seats are the reader's to fill, not a signing nobody was free for.
    expect(html).not.toContain("Nobody free to sign");
  });
});
