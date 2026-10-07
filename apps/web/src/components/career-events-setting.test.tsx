/**
 * The Career events setting, and where a run states it. Rendered without a
 * DOM, like the rest of the setup screen; what it does to a run's ratings is
 * the era's store tests.
 */

import { FIRST_AUTHORED_SEASON } from "@alt-hist/data";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HISTORICAL_SETTINGS } from "../lib/run-settings.js";
import { createWorld, ERA_RATING_MODE } from "../store/season.js";
import { CareerEventsSetting } from "./CareerEventsSetting.js";
import { EraPicker, SeasonPicker } from "./SeasonPicker.js";
import { settingsOf } from "./SimulationSettings.js";

const noop = () => {};

describe("the career events setting", () => {
  it("presses As they happened while historical, and None otherwise", () => {
    const historical = renderToStaticMarkup(<CareerEventsSetting careerEvents={null} />);
    expect(historical).toMatch(/aria-pressed="true"[^>]*>As they happened</);
    const none = renderToStaticMarkup(<CareerEventsSetting careerEvents="none" />);
    expect(none).toMatch(/aria-pressed="true"[^>]*>None</);
    for (const html of [historical, none]) {
      expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    }
  });

  it("is offered on the era's setup screen, in a Drivers group after Races, and not on a season's", () => {
    const era = renderToStaticMarkup(<EraPicker onStart={noop} />);
    const at = (label: string) => era.indexOf(`aria-label="${label}"`);
    expect(at("Career events")).toBeGreaterThan(at("Drivers"));
    expect(at("Drivers")).toBeGreaterThan(at("Points"));

    const season = renderToStaticMarkup(<SeasonPicker onStart={noop} />);
    expect(season).not.toContain('aria-label="Drivers"');
    expect(season).not.toContain('aria-label="Career events"');
  });

  it("is named on the settings line when dropped", () => {
    const world = createWorld(
      3,
      FIRST_AUTHORED_SEASON,
      ERA_RATING_MODE,
      null,
      null,
      undefined,
      null,
      null,
      {
        ...HISTORICAL_SETTINGS,
        careerEvents: "none",
      },
    );
    expect(settingsOf(world)).toContainEqual({ name: "Career events", value: "None" });
  });
});
