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
import { settingsForm } from "../test-support.js";
import { CareerEventsSetting } from "./CareerEventsSetting.js";
import { settingsOf } from "./SimulationSettings.js";

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

  it("is offered on the era's setup screen, in the Over the years group after Races, and not on a season's", () => {
    const era = settingsForm("era");
    const at = (label: string) => era.indexOf(`aria-label="${label}"`);
    expect(at("Career events")).toBeGreaterThan(at("Over the years"));
    expect(at("Over the years")).toBeGreaterThan(at("Points"));

    const season = settingsForm("season");
    expect(season).not.toContain('aria-label="Over the years"');
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
