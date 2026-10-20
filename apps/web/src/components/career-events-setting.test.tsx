/**
 * The Driver career events setting, and where a run states it. Rendered without a
 * DOM, like the rest of the setup screen; what it does to a run's ratings is
 * the era's store tests.
 */

import { FIRST_AUTHORED_SEASON } from "@alt-hist/data";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HISTORICAL_SETTINGS } from "../lib/run-settings.js";
import { createWorld, ERA_RATING_MODE } from "../store/season.js";
import { settingsForm, settingsPanel } from "../test-support.js";
import { settingsOf } from "./SimulationSettings.js";
import { YesNoSetting } from "./YesNoSetting.js";

describe("the career events setting", () => {
  it("presses Yes while historical, and No otherwise", () => {
    const historical = renderToStaticMarkup(<YesNoSetting setting="careerEvents" value={null} />);
    expect(historical).toMatch(/aria-pressed="true"[^>]*>Yes</);
    const none = renderToStaticMarkup(<YesNoSetting setting="careerEvents" value="none" />);
    expect(none).toMatch(/aria-pressed="true"[^>]*>No</);
    for (const html of [historical, none]) {
      expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    }
  });

  it("is offered on the era's setup screen, last on the Drivers tab, and not on a season's", () => {
    const drivers = settingsPanel(settingsForm("era"), "drivers");
    const at = (label: string) => drivers.indexOf(`aria-label="${label}"`);
    expect(at("Driver career events")).toBeGreaterThan(at("Who drives where"));

    const season = settingsForm("season");
    expect(settingsPanel(season, "drivers")).toContain('aria-label="Who drives where"');
    expect(season).not.toContain('aria-label="Driver career events"');
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
      {
        ...HISTORICAL_SETTINGS,
        careerEvents: "none",
      },
    );
    expect(settingsOf(world)).toContainEqual({ name: "Driver career events", value: "No" });
  });
});
