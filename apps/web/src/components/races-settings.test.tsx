/**
 * The Mechanical failures and Cars as reliable as settings, and where a run states them.
 * Rendered without a DOM, like the rest of the settings; what they *do* to
 * a season is the store's tests.
 */

import { FIRST_AUTHORED_SEASON } from "@alt-hist/data";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { STARTING_RANDOMNESS_LEVEL } from "../lib/preferences.js";
import {
  BREAKDOWNS_LABELS,
  type FewerBreakdowns,
  HISTORICAL_SETTINGS,
  type RunUnit,
} from "../lib/run-settings.js";
import { PLAYABLE_SEASONS } from "../lib/seasons.js";
import { createWorld } from "../store/season.js";
import { shownAt } from "../test-support.js";
import { BreakdownsSetting } from "./BreakdownsSetting.js";
import { RunSettingsForm } from "./RunSettingsDialog.js";
import { SeasonView } from "./SeasonView.js";
import { settingsOf } from "./SimulationSettings.js";

const YEAR = FIRST_AUTHORED_SEASON;
const OTHER = PLAYABLE_SEASONS.at(-1) ?? YEAR;

describe("the breakdowns setting", () => {
  it("presses Realistic while historical, and the chosen answer otherwise", () => {
    expect(
      renderToStaticMarkup(<BreakdownsSetting breakdowns={null} reliability={null} unit="era" />),
    ).toMatch(/aria-pressed="true"[^>]*>Realistic</);
    for (const breakdowns of ["fewer", "none"] as const) {
      const html = renderToStaticMarkup(
        <BreakdownsSetting breakdowns={breakdowns} reliability={null} unit="era" />,
      );
      expect(html).toMatch(
        new RegExp(`aria-pressed="true"[^>]*>${BREAKDOWNS_LABELS[breakdowns]}<`),
      );
      expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    }
  });
});

describe("cars as reliable as, under the breakdowns setting", () => {
  it("is one select, the historical answer first, then every playable year", () => {
    const html = renderToStaticMarkup(
      <BreakdownsSetting breakdowns={null} reliability={null} unit="era" />,
    );
    expect(html.match(/<select/g)).toHaveLength(1);
    expect(html.split("<option").length - 1).toBe(PLAYABLE_SEASONS.length + 1);
    expect(html).toMatch(/<option value="" selected="">Each season</);
  });

  it("sits under Realistic and Fewer, selecting the chosen year", () => {
    for (const breakdowns of [null, "fewer"] as const) {
      const html = renderToStaticMarkup(
        <BreakdownsSetting breakdowns={breakdowns} reliability={OTHER} unit="era" />,
      );
      expect(html).toContain('aria-label="Cars as reliable as"');
      expect(html).toMatch(new RegExp(`value="${OTHER}" selected=""`));
    }
  });

  it("is gone under None, where no car breaks down", () => {
    const html = renderToStaticMarkup(
      <BreakdownsSetting breakdowns="none" reliability={OTHER} unit="era" />,
    );
    expect(html).not.toContain("<select");
  });
});

describe("the breakdowns setting's note", () => {
  const noteOf = (breakdowns: FewerBreakdowns | null, reliability: number | null, unit: RunUnit) =>
    renderToStaticMarkup(
      <BreakdownsSetting breakdowns={breakdowns} reliability={reliability} unit={unit} />,
    ).match(/<p[^>]*>([^<]*)<\/p>/g) ?? [];

  it("is one note for the pair, and none while both are historical", () => {
    expect(noteOf(null, null, "era")).toHaveLength(0);
    for (const breakdowns of [null, "fewer", "none"] as const) {
      for (const reliability of [null, OTHER]) {
        if (breakdowns !== null || reliability !== null) {
          expect(noteOf(breakdowns, reliability, "era")).toHaveLength(1);
        }
      }
    }
  });

  it("names the year the cars are as reliable as, under Realistic and Fewer", () => {
    for (const breakdowns of [null, "fewer"] as const) {
      expect(noteOf(breakdowns, OTHER, "era")[0]).toContain(String(OTHER));
    }
    expect(noteOf("none", OTHER, "era")[0]).not.toContain(String(OTHER));
  });

  it("says half as often under Fewer, and not under Realistic", () => {
    for (const reliability of [null, OTHER]) {
      expect(noteOf("fewer", reliability, "era")[0]).toContain("half as often");
    }
    expect(noteOf(null, OTHER, "era")[0]).not.toContain("half");
  });
});

describe("the breakdowns setting, on a season's screen", () => {
  it("talks about the one season, not every year", () => {
    const own = renderToStaticMarkup(
      <BreakdownsSetting breakdowns="fewer" reliability={null} unit="season" />,
    );
    expect(own).toMatch(/selected="">This season</);
    const asIn = renderToStaticMarkup(
      <BreakdownsSetting breakdowns="fewer" reliability={OTHER} unit="season" />,
    );
    for (const html of [own, asIn]) {
      expect(html).not.toMatch(/each (year|season)|every (year|season)/i);
    }
  });
});

describe("the races and cars groups", () => {
  const choice = {
    randomness: STARTING_RANDOMNESS_LEVEL,
    ratingMode: "aged" as const,
    settings: HISTORICAL_SETTINGS,
  };

  it("hold every race and car setting on both screens, in the design's order", () => {
    for (const html of [
      renderToStaticMarkup(<RunSettingsForm choice={choice} year={YEAR} unit="season" />),
      renderToStaticMarkup(<RunSettingsForm choice={choice} year={YEAR} unit="era" eraSettings />),
    ]) {
      const order = [
        "Luck on the day",
        "Points system",
        "Chassis performance",
        "Engine performance",
        "In-season development",
        "Mechanical failures",
        "Cars as reliable as",
      ].map((name) => html.indexOf(`aria-label="${name}"`));
      expect(order.every((at) => at >= 0)).toBe(true);
      expect([...order].sort((a, b) => a - b)).toEqual(order);
    }
  });
});

describe("a run's breakdowns and reliability, stated", () => {
  const fixed = { ...HISTORICAL_SETTINGS, breakdowns: "fewer" as const, reliability: OTHER };

  it("are named on the settings line and on the grid", () => {
    const world = createWorld(3, YEAR, "peak", null, null, undefined, null, fixed);
    expect(settingsOf(world)).toContainEqual({ name: "Mechanical failures", value: "Fewer" });
    expect(settingsOf(world)).toContainEqual({
      name: "Cars as reliable as",
      value: String(OTHER),
    });

    const grid = renderToStaticMarkup(<SeasonView {...shownAt(world, { kind: "grid" })} />);
    expect(grid).toContain("Cars as reliable as:");
  });
});
