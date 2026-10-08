/**
 * The run settings line, the read-only dialog form, and the grid's Clear all
 * edits link. The dialog renders into a portal, out of a static render's
 * reach, so its contents are tested through `RunSettingsFields`; opening it and
 * committing a draft are `pnpm screenshots`, and where a commit ends up is the
 * store's tests (`store/settings.test.ts`).
 */

import { authoredLineup, lineupChanges, swapDrivers } from "@alt-hist/data";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { STARTING_RANDOMNESS_LEVEL } from "../lib/preferences.js";
import { HISTORICAL_SETTINGS, type RunSettings } from "../lib/run-settings.js";
import { seasonSeed } from "../lib/seasons.js";
import { createWorld } from "../store/season.js";
import { shownAt, YEAR } from "../test-support.js";
import { RunSettingsFields } from "./RunSettingsDialog.js";
import { RunSettingsLine } from "./RunSettingsLine.js";
import { SeasonGrid } from "./SeasonGrid.js";
import { SeasonView } from "./SeasonView.js";

const choice = (settings: RunSettings = HISTORICAL_SETTINGS) => ({
  randomness: STARTING_RANDOMNESS_LEVEL,
  settings,
});

describe("the settings line", () => {
  it("states the settings and offers the button, drawn without an svg", () => {
    const html = renderToStaticMarkup(
      <RunSettingsLine
        choice={choice({ ...HISTORICAL_SETTINGS, breakdowns: "fewer" })}
        year={YEAR}
        unit="season"
      />,
    );
    expect(html).toContain("Randomness:");
    expect(html).toContain("Breakdowns:");
    expect(html).toContain('aria-label="Run settings"');
    expect(html).not.toContain("<svg");
    expect(html).not.toContain("everything else as it was");
  });

  it("says so when every what-if is historical", () => {
    const html = renderToStaticMarkup(<RunSettingsLine choice={choice()} year={YEAR} unit="era" />);
    expect(html).toContain("everything else as it was");
  });

  it("states only what a season races on a season's screen", () => {
    const eraOnly = { ...HISTORICAL_SETTINGS, teamNames: "first" as const };
    const season = renderToStaticMarkup(
      <RunSettingsLine choice={choice(eraOnly)} year={YEAR} unit="season" />,
    );
    const era = renderToStaticMarkup(
      <RunSettingsLine choice={choice(eraOnly)} year={YEAR} unit="era" />,
    );
    expect(season).not.toContain("Team names:");
    expect(era).toContain("Team names:");
  });

  it("is the first thing on the grid, and carries the lock as its title", () => {
    const world = createWorld(3, YEAR);
    const html = renderToStaticMarkup(
      <SeasonView {...shownAt(world, { kind: "grid" })} settingsLock="Fixed for a test." />,
    );
    expect(html.indexOf('aria-label="Run settings"')).toBeLessThan(
      html.indexOf('aria-label="Driver ability"'),
    );
    expect(html).toContain('title="Fixed for a test."');
  });
});

describe("the dialog's form", () => {
  it("is one disabled fieldset under a lock, with the reason above it", () => {
    const html = renderToStaticMarkup(
      <RunSettingsFields choice={choice()} year={YEAR} unit="era" lock="Fixed for a test." />,
    );
    expect(html).toMatch(/^<p[^>]*>Fixed for a test\.<\/p><fieldset disabled=""/);
  });

  it("is live with no lock", () => {
    const html = renderToStaticMarkup(
      <RunSettingsFields choice={choice()} year={YEAR} unit="era" lock={null} />,
    );
    expect(html).toMatch(/^<fieldset class/);
    expect(html).not.toContain('disabled=""');
  });

  it("explains only the what-ifs", () => {
    // The randomness level has no historical answer, so its line is the only
    // note on an all-historical form.
    const notes = (settings: RunSettings) =>
      (
        renderToStaticMarkup(
          <RunSettingsFields
            choice={choice(settings)}
            year={YEAR}
            unit="era"
            eraSettings
            lock={null}
          />,
        ).match(/<p /g) ?? []
      ).length;
    const historical = notes(HISTORICAL_SETTINGS);
    expect(notes({ ...HISTORICAL_SETTINGS, breakdowns: "fewer" })).toBe(historical + 1);
    expect(notes({ ...HISTORICAL_SETTINGS, careerEvents: "none" })).toBe(historical + 1);
  });
});

describe("clearing a grid's edits", () => {
  const season = seasonSeed(YEAR);
  const authored = authoredLineup(season);
  // Two teams' first drivers, traded: an edit any season has.
  const [first, second] = season.entries.map((entry) => entry.drivers[0] ?? "");
  const lineup = swapDrivers(authored, first ?? "", second ?? "");
  const world = createWorld(3, YEAR, "aged", lineup);
  const grid = (props: Partial<Parameters<typeof SeasonGrid>[0]>) =>
    renderToStaticMarkup(
      <SeasonGrid
        field={world.field}
        seasonYear={YEAR}
        ratingMode="aged"
        changes={lineupChanges(season, lineup)}
        {...props}
      />,
    );

  it("is offered in the edited grid's notice", () => {
    const html = grid({ onClearEdits: () => {} });
    expect(html).toContain("This grid was edited");
    expect(html).toContain("Clear all edits");
  });

  it("is not offered without a handler, or on a grid with nothing to clear", () => {
    expect(grid({})).not.toContain("Clear all edits");
    expect(grid({ changes: [], onClearEdits: () => {} })).not.toContain("Clear all edits");
  });
});
