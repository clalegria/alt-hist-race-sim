/**
 * The *What if?* presets: each one lights itself once picked, from any
 * starting choice; none lights after a tweak; every answer is one this build
 * offers. Picking one is a click, out of reach here; where it lands is the
 * same commit the settings line makes.
 */

import { RANDOMNESS_LEVELS } from "@alt-hist/engine";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { STARTING_RANDOMNESS_LEVEL } from "../lib/preferences.js";
import { PRESETS, presetsFor } from "../lib/presets.js";
import {
  HISTORICAL_SETTINGS,
  parseRunSettings,
  pointsTables,
  type RunSettings,
  type RunUnit,
  sameSettings,
} from "../lib/run-settings.js";
import { settingsPanel, YEAR } from "../test-support.js";
import { defaultChoice, type RunChoice, RunSettingsFields } from "./RunSettingsDialog.js";
import { chosenPreset, OWN_MIX, PresetList, presetChoice, WhatIfCard } from "./WhatIfPresets.js";

const UNITS: readonly RunUnit[] = ["season", "era"];

const atDefaults: RunChoice = {
  randomness: STARTING_RANDOMNESS_LEVEL,
  ratingMode: "aged",
  settings: HISTORICAL_SETTINGS,
};

/** A choice off the defaults on every tab, so a preset has something to undo. */
const tweaked: RunChoice = {
  randomness: RANDOMNESS_LEVELS[1] ?? STARTING_RANDOMNESS_LEVEL,
  ratingMode: "aged",
  settings: {
    ...HISTORICAL_SETTINGS,
    breakdowns: "fewer",
    careerEvents: "none",
    seating: { kind: "random", includeUnemployed: true },
  },
};

/** The description under the rows, as text. */
const described = (html: string) =>
  (html.match(/aria-live="polite"[^>]*>([^<]*)</)?.[1] ?? "")
    .replaceAll("&#x27;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&amp;", "&");

/** How many buttons a render shows pressed. */
const pressed = (html: string) => html.split('aria-pressed="true"').length - 1;

describe("the presets", () => {
  it.each(UNITS)("light themselves once picked, from any choice, on the %s screen", (unit) => {
    for (const preset of presetsFor(unit)) {
      for (const from of [atDefaults, tweaked]) {
        expect(chosenPreset(presetChoice(preset, from, unit), unit)?.id).toBe(preset.id);
      }
    }
  });

  it.each(UNITS)("give different answers from each other on the %s screen", (unit) => {
    const applied = presetsFor(unit).map((preset) => presetChoice(preset, atDefaults, unit));
    applied.forEach((one, i) => {
      applied.slice(i + 1).forEach((other) => {
        const same =
          one.randomness === other.randomness &&
          one.ratingMode === other.ratingMode &&
          sameSettings(one.settings, other.settings);
        expect(same).toBe(false);
      });
    });
  });

  it("start from what Restore defaults puts back", () => {
    for (const unit of UNITS) {
      const defaults = defaultChoice(tweaked, unit === "era");
      const lit = chosenPreset(defaults, unit);
      expect(lit).not.toBeNull();
      expect(lit?.settings).toEqual({});
    }
  });

  it("light none once a setting is changed after one", () => {
    for (const unit of UNITS) {
      for (const preset of presetsFor(unit)) {
        const picked = presetChoice(preset, atDefaults, unit);
        const changed: RunSettings = {
          ...picked.settings,
          points: picked.settings.points === null ? (pointsTables()[0]?.scale ?? null) : null,
        };
        expect(chosenPreset({ ...picked, settings: changed }, unit)).toBeNull();
      }
    }
  });

  it("are each offered somewhere, and only answer with what this build reads back", () => {
    for (const preset of PRESETS) {
      expect(preset.units.length).toBeGreaterThan(0);
      for (const unit of preset.units) {
        const { settings } = presetChoice(preset, atDefaults, unit);
        expect(parseRunSettings(JSON.parse(JSON.stringify(settings)))).toEqual(settings);
      }
    }
  });

  it("read a season past the era answers it keeps, and keep them", () => {
    const remembered: RunChoice = {
      ...atDefaults,
      settings: {
        ...HISTORICAL_SETTINGS,
        teams: { fill: "last" },
        teamNames: "first",
        driverPool: { ...HISTORICAL_SETTINGS.driverPool, activeOnly: false },
      },
    };
    expect(chosenPreset(remembered, "season")?.settings).toEqual({});
    for (const preset of presetsFor("season")) {
      const picked = presetChoice(preset, remembered, "season");
      expect(picked.settings.teams).toEqual(remembered.settings.teams);
      expect(picked.settings.teamNames).toBe(remembered.settings.teamNames);
    }
  });

  it("keep a season's driver ability out of an era", () => {
    for (const preset of presetsFor("era")) {
      expect(presetChoice(preset, atDefaults, "era").ratingMode).toBe(atDefaults.ratingMode);
    }
  });
});

describe("the What if? card and tab", () => {
  it.each(UNITS)("draws the %s screen's presets, one pressed at the defaults", (unit) => {
    const html = renderToStaticMarkup(<WhatIfCard choice={atDefaults} year={YEAR} unit={unit} />);
    expect(html).toContain("What if?");
    expect(html.split("aria-pressed=").length - 1).toBe(presetsFor(unit).length);
    expect(pressed(html)).toBe(1);
  });

  it("carries the settings button and what is in force", () => {
    const card = (choice: RunChoice) =>
      renderToStaticMarkup(<WhatIfCard choice={choice} year={YEAR} unit="era" />);
    expect(card(atDefaults)).toContain('aria-label="Run settings"');
    expect(card(atDefaults)).toContain("Default settings");
    expect(card(tweaked)).toContain("Mechanical failures:");
  });

  it.each(UNITS)("describes the lit preset alone on the %s screen", (unit) => {
    for (const preset of presetsFor(unit)) {
      const html = renderToStaticMarkup(
        <PresetList choice={presetChoice(preset, atDefaults, unit)} unit={unit} />,
      );
      expect(described(html)).toBe(preset.blurb(unit));
    }
  });

  it("presses none for a choice of the reader's own, and says so", () => {
    const html = renderToStaticMarkup(<PresetList choice={tweaked} unit="era" />);
    expect(pressed(html)).toBe(0);
    expect(described(html)).toBe(OWN_MIX);
  });

  it("is the dialog's first tab, disabled with the rest under a lock", () => {
    const fields = (lock: string | null) =>
      renderToStaticMarkup(
        <RunSettingsFields
          choice={atDefaults}
          year={YEAR}
          unit="era"
          eraSettings
          tab="presets"
          lock={lock}
        />,
      );
    const open = fields(null);
    expect(settingsPanel(open, "presets")).toContain('aria-pressed="true"');
    expect(open.search(/role="tab"[^>]*>What if\?/)).toBe(open.indexOf('role="tab"'));
    expect(fields("Locked")).toMatch(
      /<fieldset disabled=""[^>]*><div role="tabpanel" id="[^"]*-panel-presets"/,
    );
  });
});
