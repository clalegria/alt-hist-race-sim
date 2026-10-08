/**
 * The Breakdowns and Reliability settings, and where a run states them.
 * Rendered without a DOM, like the rest of the settings; what they *do* to
 * a season is the store's tests.
 */

import { FIRST_AUTHORED_SEASON } from "@alt-hist/data";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { STARTING_RANDOMNESS_LEVEL } from "../lib/preferences.js";
import { BREAKDOWNS_LABELS, HISTORICAL_SETTINGS } from "../lib/run-settings.js";
import { PLAYABLE_SEASONS } from "../lib/seasons.js";
import { createWorld } from "../store/season.js";
import { shownAt } from "../test-support.js";
import { BreakdownsSetting } from "./BreakdownsSetting.js";
import { ReliabilitySetting } from "./ReliabilitySetting.js";
import { RunSettingsForm } from "./RunSettingsDialog.js";
import { SeasonView } from "./SeasonView.js";
import { settingsOf } from "./SimulationSettings.js";

const YEAR = FIRST_AUTHORED_SEASON;
const OTHER = PLAYABLE_SEASONS.at(-1) ?? YEAR;

describe("the breakdowns setting", () => {
  it("presses Realistic while historical, and the chosen answer otherwise", () => {
    expect(renderToStaticMarkup(<BreakdownsSetting breakdowns={null} />)).toMatch(
      /aria-pressed="true"[^>]*>Realistic</,
    );
    for (const breakdowns of ["fewer", "none"] as const) {
      const html = renderToStaticMarkup(<BreakdownsSetting breakdowns={breakdowns} />);
      expect(html).toMatch(
        new RegExp(`aria-pressed="true"[^>]*>${BREAKDOWNS_LABELS[breakdowns]}<`),
      );
      expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    }
  });
});

describe("the breakdowns setting's note", () => {
  it("speaks only for a what-if: Realistic says what it is in its name", () => {
    expect(renderToStaticMarkup(<BreakdownsSetting breakdowns={null} />)).not.toContain("<p");
    for (const breakdowns of ["fewer", "none"] as const) {
      expect(renderToStaticMarkup(<BreakdownsSetting breakdowns={breakdowns} />)).toContain("<p");
    }
  });
});

describe("the reliability setting", () => {
  it("is one select, the historical answer first, then every playable year", () => {
    const html = renderToStaticMarkup(<ReliabilitySetting reliability={null} unit="era" />);
    expect(html.match(/<select/g)).toHaveLength(1);
    expect(html.split("<option").length - 1).toBe(PLAYABLE_SEASONS.length + 1);
    expect(html).toMatch(/<option value="" selected="">Each year/);
    expect(html).not.toContain("<p");
  });

  it("selects the chosen year, and says what it does", () => {
    const html = renderToStaticMarkup(<ReliabilitySetting reliability={OTHER} unit="era" />);
    expect(html).toMatch(new RegExp(`value="${OTHER}" selected=""`));
    expect(html).toContain("<p");
  });

  it("is greyed out when asked, keeping the choice on show", () => {
    const html = renderToStaticMarkup(
      <ReliabilitySetting reliability={OTHER} unit="era" disabled />,
    );
    expect(html).toMatch(/<select[^>]*disabled=""/);
    expect(html).toMatch(new RegExp(`value="${OTHER}" selected=""`));
    expect(
      renderToStaticMarkup(<ReliabilitySetting reliability={OTHER} unit="era" />),
    ).not.toContain('disabled=""');
  });
});

describe("the reliability setting, on a season's screen", () => {
  it("talks about the one season, not every year", () => {
    const own = renderToStaticMarkup(<ReliabilitySetting reliability={null} unit="season" />);
    expect(own).toMatch(/selected="">As it was</);
    const asIn = renderToStaticMarkup(<ReliabilitySetting reliability={OTHER} unit="season" />);
    for (const html of [own, asIn]) {
      expect(html).not.toMatch(/each year|every year/i);
    }
  });
});

describe("the races and cars groups", () => {
  const choice = { randomness: STARTING_RANDOMNESS_LEVEL, settings: HISTORICAL_SETTINGS };

  it("hold every race and car setting on both screens, in the design's order", () => {
    for (const html of [
      renderToStaticMarkup(<RunSettingsForm choice={choice} year={YEAR} unit="season" />),
      renderToStaticMarkup(<RunSettingsForm choice={choice} year={YEAR} unit="era" eraSettings />),
    ]) {
      const order = ["Randomness", "Points", "Car performance", "Breakdowns", "Reliability"].map(
        (name) => html.indexOf(`aria-label="${name}"`),
      );
      expect(order.every((at) => at >= 0)).toBe(true);
      expect([...order].sort((a, b) => a - b)).toEqual(order);
    }
  });
});

describe("a run's breakdowns and reliability, stated", () => {
  const fixed = { ...HISTORICAL_SETTINGS, breakdowns: "fewer" as const, reliability: OTHER };

  it("are named on the settings line and on the grid", () => {
    const world = createWorld(3, YEAR, "peak", null, null, undefined, null, null, fixed);
    expect(settingsOf(world)).toContainEqual({ name: "Breakdowns", value: "Fewer" });
    expect(settingsOf(world)).toContainEqual({ name: "Reliability", value: `as in ${OTHER}` });

    const grid = renderToStaticMarkup(<SeasonView {...shownAt(world, { kind: "grid" })} />);
    expect(grid).toContain(`as in ${OTHER}`);
  });
});
