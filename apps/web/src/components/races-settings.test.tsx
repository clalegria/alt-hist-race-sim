/**
 * The Breakdowns and Reliability settings, and where a run states them.
 * Rendered without a DOM, like the rest of the setup screen; what they *do* to
 * a season is the store's tests.
 */

import { FIRST_AUTHORED_SEASON } from "@alt-hist/data";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BREAKDOWNS_LABELS, HISTORICAL_SETTINGS } from "../lib/run-settings.js";
import { PLAYABLE_SEASONS } from "../lib/seasons.js";
import { createWorld } from "../store/season.js";
import { shownAt } from "../test-support.js";
import { BreakdownsSetting } from "./BreakdownsSetting.js";
import { ReliabilitySetting } from "./ReliabilitySetting.js";
import { EraPicker, SeasonPicker } from "./SeasonPicker.js";
import { SeasonView } from "./SeasonView.js";
import { settingsOf } from "./SimulationSettings.js";

const YEAR = FIRST_AUTHORED_SEASON;
const OTHER = PLAYABLE_SEASONS.at(-1) ?? YEAR;
const noop = () => {};

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

describe("the reliability setting", () => {
  it("offers no year while each year keeps its own", () => {
    const html = renderToStaticMarkup(<ReliabilitySetting reliability={null} year={YEAR} />);
    expect(html).toMatch(/aria-pressed="true"[^>]*>Each year/);
    expect(html).not.toContain("<select");
  });

  it("is greyed out when asked, keeping the choice on show but offering no year", () => {
    const html = renderToStaticMarkup(
      <ReliabilitySetting reliability={OTHER} year={YEAR} disabled />,
    );
    expect(html).toMatch(/<fieldset[^>]*disabled=""/);
    expect(html).toMatch(/aria-pressed="true"[^>]*>As in a year/);
    expect(html).not.toContain("<select");
    expect(
      renderToStaticMarkup(<ReliabilitySetting reliability={OTHER} year={YEAR} />),
    ).not.toContain('disabled=""');
  });

  it("offers every playable year once one is chosen, with that year selected", () => {
    const html = renderToStaticMarkup(<ReliabilitySetting reliability={OTHER} year={YEAR} />);
    expect(html).toMatch(/aria-pressed="true"[^>]*>As in a year/);
    expect(html.split("<option").length - 1).toBe(PLAYABLE_SEASONS.length);
    expect(html).toMatch(new RegExp(`selected=""[^>]*>${OTHER}<`));
  });
});

describe("the races group", () => {
  it("holds both settings on both setup screens, in the design's order", () => {
    for (const html of [
      renderToStaticMarkup(<SeasonPicker onStart={noop} />),
      renderToStaticMarkup(<EraPicker onStart={noop} />),
    ]) {
      const order = ["Randomness", "Breakdowns", "Reliability", "Points"].map((name) =>
        html.indexOf(`aria-label="${name}"`),
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
