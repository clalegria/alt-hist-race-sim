/**
 * The Points setting, and where a run states it. Rendered without a DOM, like
 * the rest of the setup screen; what a chosen table *does* is the store's tests.
 */

import { FIRST_AUTHORED_SEASON, seasonSeed } from "@alt-hist/data";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  HISTORICAL_SETTINGS,
  pointsTables,
  pointsValues,
  samePoints,
} from "../lib/run-settings.js";
import { createWorld } from "../store/season.js";
import { shownAt } from "../test-support.js";
import { PointsSetting } from "./PointsSetting.js";
import { EraPicker, SeasonPicker } from "./SeasonPicker.js";
import { SeasonView } from "./SeasonView.js";
import { settingsOf } from "./SimulationSettings.js";

const YEAR = FIRST_AUTHORED_SEASON;
const other =
  pointsTables().find((table) => !samePoints(table.scale, seasonSeed(YEAR).points)) ??
  pointsTables()[0];
const noop = () => {};

describe("the points setting", () => {
  it("offers no table while each year keeps its own", () => {
    const html = renderToStaticMarkup(<PointsSetting points={null} year={YEAR} unit="era" />);
    expect(html).toMatch(/aria-pressed="true"[^>]*>Each year/);
    expect(html).not.toContain("<select");
  });

  it("offers every table once one is fixed, with the chosen one selected", () => {
    const html = renderToStaticMarkup(
      <PointsSetting points={other?.scale ?? []} year={YEAR} unit="era" />,
    );
    expect(html).toMatch(/aria-pressed="true"[^>]*>Same all run/);
    expect(html.split("<option").length - 1).toBe(pointsTables().length);
    expect(html).toMatch(new RegExp(`selected=""[^>]*>${other?.label ?? ""}<`));
  });

  it("talks about the one season on a season's screen, not every year or the run", () => {
    const own = renderToStaticMarkup(<PointsSetting points={null} year={YEAR} unit="season" />);
    expect(own).toMatch(/aria-pressed="true"[^>]*>As it was</);
    expect(own).toContain(pointsValues(seasonSeed(YEAR).points));
    const fixed = renderToStaticMarkup(
      <PointsSetting points={other?.scale ?? []} year={YEAR} unit="season" />,
    );
    expect(fixed).toMatch(/aria-pressed="true"[^>]*>From a year</);
    for (const html of [own, fixed]) {
      expect(html).not.toMatch(/each year|every year|all run|the run/i);
    }
  });

  it("sits in the Races group of the run settings, on both setup screens", () => {
    for (const html of [
      renderToStaticMarkup(<SeasonPicker onStart={noop} />),
      renderToStaticMarkup(<EraPicker onStart={noop} />),
    ]) {
      expect(html).toContain("Run settings");
      expect(html).toContain('aria-label="Races"');
      expect(html).toContain('aria-label="Points"');
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
    expect(historical).not.toContain("Simulation settings");
  });
});
