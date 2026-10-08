/**
 * The Points setting, and where a run states it. Rendered without a DOM, like
 * the rest of the settings; what a chosen table *does* is the store's tests.
 */

import { FIRST_AUTHORED_SEASON, seasonSeed } from "@alt-hist/data";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { STARTING_RANDOMNESS_LEVEL } from "../lib/preferences.js";
import {
  HISTORICAL_SETTINGS,
  pointsTables,
  pointsValues,
  samePoints,
} from "../lib/run-settings.js";
import { createWorld } from "../store/season.js";
import { shownAt } from "../test-support.js";
import { PointsSetting } from "./PointsSetting.js";
import { RunSettingsForm } from "./RunSettingsDialog.js";
import { SeasonView } from "./SeasonView.js";
import { settingsOf } from "./SimulationSettings.js";

const YEAR = FIRST_AUTHORED_SEASON;
const other =
  pointsTables().find((table) => !samePoints(table.scale, seasonSeed(YEAR).points)) ??
  pointsTables()[0];

describe("the points setting", () => {
  it("is one select, each year's own first and selected while historical", () => {
    const html = renderToStaticMarkup(<PointsSetting points={null} year={YEAR} unit="era" />);
    expect(html.match(/<select/g)).toHaveLength(1);
    expect(html).toMatch(/selected="">Each year/);
    expect(html.split("<option").length - 1).toBe(pointsTables().length + 1);
  });

  it("selects the table once one is fixed", () => {
    const html = renderToStaticMarkup(
      <PointsSetting points={other?.scale ?? []} year={YEAR} unit="era" />,
    );
    expect(html).toMatch(new RegExp(`selected=""[^>]*>${other?.label ?? ""}<`));
  });

  it("talks about the one season on a season's screen, naming its own table", () => {
    const own = renderToStaticMarkup(<PointsSetting points={null} year={YEAR} unit="season" />);
    expect(own).toMatch(/selected="">As it was/);
    expect(own).toContain(pointsValues(seasonSeed(YEAR).points));
    const fixed = renderToStaticMarkup(
      <PointsSetting points={other?.scale ?? []} year={YEAR} unit="season" />,
    );
    for (const html of [own, fixed]) {
      expect(html).not.toMatch(/each year|every year|all run|the run/i);
    }
  });

  it("sits in the Races group of the run settings, on both screens", () => {
    const choice = { randomness: STARTING_RANDOMNESS_LEVEL, settings: HISTORICAL_SETTINGS };
    for (const html of [
      renderToStaticMarkup(<RunSettingsForm choice={choice} year={YEAR} unit="season" />),
      renderToStaticMarkup(<RunSettingsForm choice={choice} year={YEAR} unit="era" eraSettings />),
    ]) {
      const races = html.indexOf('aria-label="Races"');
      const cars = html.indexOf('aria-label="Cars"');
      const points = html.indexOf('aria-label="Points"');
      expect(races).toBeGreaterThan(-1);
      expect(points).toBeGreaterThan(races);
      expect(cars).toBeGreaterThan(points);
    }
  });
});

describe("a run's points, stated", () => {
  const fixed = { ...HISTORICAL_SETTINGS, points: other?.scale ?? [] };

  it("is left out of the settings line while historical", () => {
    const world = createWorld(3, YEAR);
    expect(world.settings).toEqual(HISTORICAL_SETTINGS);
    expect(settingsOf(world).map((setting) => setting.name)).not.toContain("Points");
  });

  it("is named on the settings line, and on the grid, once a table is fixed", () => {
    const world = createWorld(3, YEAR, "peak", null, null, undefined, null, null, fixed);
    expect(settingsOf(world)).toContainEqual({ name: "Points", value: pointsValues(fixed.points) });

    const grid = renderToStaticMarkup(<SeasonView {...shownAt(world, { kind: "grid" })} />);
    expect(grid).toContain(pointsValues(fixed.points));
    const historical = renderToStaticMarkup(
      <SeasonView {...shownAt(createWorld(3, YEAR), { kind: "grid" })} />,
    );
    expect(historical).not.toContain("Points:");
  });
});
