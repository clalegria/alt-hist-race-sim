/**
 * The settings form's Drivers group — Driver ability, Who drives where,
 * Drivers who can be signed — and the age range the pool shares with the grid
 * editor. Rendered without a DOM; which row shows when is the point.
 */

import { AGE_RANGE, ARRANGEMENT_KINDS, type RatingMode } from "@alt-hist/data";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { STARTING_RANDOMNESS_LEVEL } from "../lib/preferences.js";
import {
  ARRANGEMENT_LABELS,
  HISTORICAL_SETTINGS,
  OPENING_DRIVER_POOL,
  OPENING_TEAMS,
  type RunSettings,
} from "../lib/run-settings.js";
import { settingsForm } from "../test-support.js";
import { AgeRangeInput, leftAge, typedAge } from "./AgeRangeInput.js";
import { settingsOf } from "./SimulationSettings.js";
import { WhoDrivesSetting } from "./WhoDrivesSetting.js";

const ABILITY = 'aria-label="Driver ability"';
const POOL = "Drivers who can be signed";
const UNEMPLOYED = "Drivers without a drive can take a seat";

/** Where a label sits in the markup, for the order of rows. */
const at = (html: string, label: string) => html.indexOf(`aria-label="${label}"`);

/** A reseat, signing or not. */
const reseat = (includeUnemployed: boolean): RunSettings => ({
  ...HISTORICAL_SETTINGS,
  seating: { kind: "fastest-in-fastest", includeUnemployed },
});

describe("the Drivers group", () => {
  it("sits between Races and Cars on both screens", () => {
    for (const html of [settingsForm("season"), settingsForm("era")]) {
      expect(at(html, "Drivers")).toBeGreaterThan(at(html, "Points system"));
      expect(at(html, "Who drives where")).toBeGreaterThan(at(html, "Drivers"));
      expect(at(html, "Cars")).toBeGreaterThan(at(html, "Who drives where"));
    }
  });
});

describe("Driver ability", () => {
  it("is offered on a season's screen, first in Drivers, and not on an era's", () => {
    const season = settingsForm("season");
    expect(season).toContain(ABILITY);
    expect(at(season, "Driver ability")).toBeGreaterThan(at(season, "Drivers"));
    expect(at(season, "Who drives where")).toBeGreaterThan(at(season, "Driver ability"));
    expect(settingsForm("era")).not.toContain(ABILITY);
  });

  it("is named on the settings line at their best, and not as they were", () => {
    const line = (ratingMode: RatingMode) =>
      settingsOf({
        randomness: STARTING_RANDOMNESS_LEVEL,
        ratingMode,
        settings: HISTORICAL_SETTINGS,
      });
    expect(line("peak")).toEqual([{ name: "Driver ability", value: "At their best" }]);
    expect(line("aged")).toEqual([]);
  });

  it("presses the world's answer, with a note only at their best", () => {
    const aged = settingsForm("season");
    expect(aged).toMatch(/aria-pressed="true"[^>]*>As they were that year</);
    expect(aged).not.toContain("the best they ever were");
    const peak = settingsForm("season", HISTORICAL_SETTINGS, "peak");
    expect(peak).toMatch(/aria-pressed="true"[^>]*>At their best</);
    expect(peak).toContain("the best they ever were");
  });
});

describe("Who drives where", () => {
  it("opens on Historical, with every rule on offer and nothing under it", () => {
    const html = renderToStaticMarkup(<WhoDrivesSetting seating={null} unit="season" />);
    expect(html).toMatch(/<option value="" selected="">Historical</);
    for (const kind of ARRANGEMENT_KINDS) {
      expect(html, kind).toContain(`>${ARRANGEMENT_LABELS[kind]}<`);
    }
    expect(html).not.toContain(UNEMPLOYED);
  });

  it("offers drivers without a drive under a rule, ticked as the answer says", () => {
    for (const includeUnemployed of [false, true]) {
      const html = renderToStaticMarkup(
        <WhoDrivesSetting seating={{ kind: "random", includeUnemployed }} unit="season" />,
      );
      expect(html).toMatch(/<option value="random" selected="">/);
      expect(html).toContain(UNEMPLOYED);
      expect(/<input[^>]*type="checkbox"[^>]*checked=""/.test(html)).toBe(includeUnemployed);
    }
  });

  it("talks about every year on the era's screen and about the one on a season's", () => {
    const seating = { kind: "random", includeUnemployed: false } as const;
    const season = renderToStaticMarkup(<WhoDrivesSetting seating={seating} unit="season" />);
    const era = renderToStaticMarkup(<WhoDrivesSetting seating={seating} unit="era" />);
    expect(era).toContain("Every year,");
    expect(season).not.toContain("Every year");
  });
});

describe("Drivers who can be signed", () => {
  it("is shown only while something signs drivers", () => {
    // Nothing signs: no what-if, or a reseat of the drivers already seated.
    expect(settingsForm("season")).not.toContain(POOL);
    expect(settingsForm("era")).not.toContain(POOL);
    expect(settingsForm("season", reseat(false))).not.toContain(POOL);
    // A reseat that may seat drivers without a drive, on either screen.
    expect(settingsForm("season", reseat(true))).toContain(POOL);
    expect(settingsForm("era", reseat(true))).toContain(POOL);
    // The first season's teams sign for their empty seats: an era's answer, so
    // a season passing it through signs nobody.
    const kept = { ...HISTORICAL_SETTINGS, teams: OPENING_TEAMS };
    expect(settingsForm("era", kept)).toContain(POOL);
    expect(settingsForm("season", kept)).not.toContain(POOL);
  });

  it("sits under Who drives where, and before Driver career events on an era", () => {
    const era = settingsForm("era", reseat(true));
    expect(at(era, "Youngest age")).toBeGreaterThan(at(era, "Who drives where"));
    expect(at(era, "Driver career events")).toBeGreaterThan(at(era, "Oldest age"));
  });

  it("draws the pool's ages and its racing-that-year box", () => {
    const pool = { minAge: 21, maxAge: 33, activeOnly: false };
    const html = settingsForm("season", { ...reseat(true), driverPool: pool });
    expect(html).toMatch(/aria-label="Youngest age"[^>]*value="21"/);
    expect(html).toMatch(/aria-label="Oldest age"[^>]*value="33"/);
    expect(html).toContain("Only drivers racing that year");
    // The reseat's own box is ticked, the pool's is not.
    expect(html.match(/type="checkbox"[^>]*checked=""/g)).toHaveLength(1);
    const active = settingsForm("season", { ...reseat(true), driverPool: OPENING_DRIVER_POOL });
    expect(active.match(/type="checkbox"[^>]*checked=""/g)).toHaveLength(2);
  });

  it("reads the ages as peak ages at their best", () => {
    expect(settingsForm("season", reseat(true))).toContain(">Aged<");
    expect(settingsForm("season", reseat(true), "peak")).toContain(">Peak age<");
  });
});

describe("the shared age range", () => {
  it("commits an age the range can hold as it is typed, and holds anything else", () => {
    expect(typedAge("25")).toBe(25);
    expect(typedAge(String(AGE_RANGE.min))).toBe(AGE_RANGE.min);
    expect(typedAge(String(AGE_RANGE.max))).toBe(AGE_RANGE.max);
    // The empty box that used to collapse the range, and the "2" of "25".
    expect(typedAge("")).toBeNull();
    expect(typedAge(" ")).toBeNull();
    expect(typedAge(String(AGE_RANGE.min - 1))).toBeNull();
    expect(typedAge(String(AGE_RANGE.max + 1))).toBeNull();
    expect(typedAge("25.5")).toBeNull();
  });

  it("commits what was held on leaving, and puts an empty box back", () => {
    expect(leftAge("")).toBeNull();
    expect(leftAge("abc")).toBeNull();
    // Already committed while typing.
    expect(leftAge("25")).toBeNull();
    // Held while typing, committed now, to be clamped.
    expect(leftAge("2")).toBe(2);
    expect(leftAge(String(AGE_RANGE.max + 10))).toBe(AGE_RANGE.max + 10);
  });

  it("draws the same two boxes for the editor and the settings", () => {
    const html = renderToStaticMarkup(
      <AgeRangeInput band={{ minAge: 19, maxAge: 40 }} ratingMode="aged" />,
    );
    expect(html).toMatch(/aria-label="Youngest age"[^>]*value="19"/);
    expect(html).toMatch(/aria-label="Oldest age"[^>]*value="40"/);
  });
});
