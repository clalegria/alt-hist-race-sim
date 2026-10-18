/**
 * The Teams setting, and what the grid says about a kept year. Rendered without
 * a DOM, like the rest of the setup screen; what it records on a run is the
 * era's store tests.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { KeptNotes } from "../lib/kept.js";
import { HISTORICAL_SETTINGS, OPENING_TEAMS, type RunSettings } from "../lib/run-settings.js";
import { useSeasonStore } from "../store/season.js";
import { FOLDING_YEAR, settingsForm, shownAt } from "../test-support.js";
import { keptSentences } from "./LineupChanges.js";
import { SeasonView } from "./SeasonView.js";
import { TeamsSetting } from "./TeamsSetting.js";

const FILL = 'aria-label="Empty seats go to"';

describe("the Teams setting", () => {
  it("presses Historical while historical, with nothing below it", () => {
    const html = renderToStaticMarkup(<TeamsSetting teams={null} reseated={false} />);
    expect(html).toMatch(/aria-pressed="true"[^>]*>Historical</);
    expect(html).not.toContain(FILL);
  });

  it("draws who takes the empty seats under the first season's teams", () => {
    const html = renderToStaticMarkup(<TeamsSetting teams={OPENING_TEAMS} reseated={false} />);
    expect(html).toMatch(/aria-pressed="true"[^>]*>The first season&#x27;s teams</);
    expect(html).toContain(FILL);
    expect(html).toMatch(/aria-pressed="true"[^>]*>Last year&#x27;s driver, if possible</);
    const best = renderToStaticMarkup(<TeamsSetting teams={{ fill: "best" }} reseated={false} />);
    expect(best).toMatch(/aria-pressed="true"[^>]*>The best available driver</);
  });

  it("hides who takes the empty seats under a reseat, which moves everyone", () => {
    const html = renderToStaticMarkup(<TeamsSetting teams={OPENING_TEAMS} reseated />);
    expect(html).toMatch(/aria-pressed="true"[^>]*>The first season&#x27;s teams</);
    expect(html).not.toContain(FILL);
  });

  it("is offered in Over the years on the era's screen and not a season's", () => {
    const at = (html: string, label: string) => html.indexOf(`aria-label="${label}"`);
    const era = settingsForm("era");
    expect(at(era, "Teams")).toBeGreaterThan(at(era, "Over the years"));
    const reseated = settingsForm("era", {
      ...HISTORICAL_SETTINGS,
      teams: OPENING_TEAMS,
      seating: { kind: "random", includeUnemployed: false },
    });
    expect(reseated).toContain('aria-label="Teams"');
    expect(reseated).not.toContain(FILL);
    expect(settingsForm("season", { ...HISTORICAL_SETTINGS, teams: OPENING_TEAMS })).not.toContain(
      'aria-label="Teams"',
    );
  });
});

describe("what the grid says about a kept year", () => {
  /** The grid of the year after a team folds, in an era from the year before. */
  function ghostYear(settings: RunSettings = { ...HISTORICAL_SETTINGS, teams: OPENING_TEAMS }) {
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
      "Gone by 2001 in real life, still racing with the same level of performance as their last real season: RED (2000) and BLUE (1999).",
      "Seats that were empty in real life: 2 kept last year's driver, 1 new signing.",
      "No free driver to sign, so RED runs one car and GREEN sits the year out.",
    ]);
  });
});
