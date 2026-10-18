/**
 * The *What if?* presets: a handful of runs a reader can set up with one
 * click, on the setup screen's card and the settings dialog's first tab.
 *
 * **A preset is a shortcut, never a setting.** It names only what it changes;
 * everything else goes back to its default, as Restore defaults does, and the
 * result is an ordinary set of answers. Nothing records which preset was
 * picked: the one on show is whichever the answers equal (`chosenPreset` in
 * `WhatIfPresets.tsx`), so tweaking anything afterwards simply lights none.
 *
 * Pure: the presets as data, applied over the defaults by the component.
 */

import type { RatingMode } from "@alt-hist/data";
import { RANDOMNESS_LEVELS, type RandomnessLevel } from "@alt-hist/engine";
import { OPENING_DRIVER_POOL, type RunSettings, type RunUnit } from "./run-settings.js";
import { FIRST_SEASON, PLAYABLE_SEASONS } from "./seasons.js";

export interface Preset {
  readonly id: string;
  readonly name: string;
  /** What it lets the reader see, following the screen it is on. */
  readonly blurb: (unit: RunUnit) => string;
  /** The setup screens that offer it. */
  readonly units: readonly RunUnit[];
  /** Its luck on the day, if not the default. */
  readonly randomness?: RandomnessLevel;
  /** Its driver ability, if not the default. Season only, like the setting. */
  readonly ratingMode?: RatingMode;
  /** The settings it changes; every other one is on its default. */
  readonly settings: Partial<RunSettings>;
}

const BOTH: readonly RunUnit[] = ["season", "era"];

/** The varied car every season of *Car performance drifts from real life* moves off: last year's. */
const DRIFT = { kind: "varied", spread: 30, from: "last" } as const;

export const PRESETS: readonly Preset[] = [
  {
    id: "default",
    name: "Default",
    blurb: (unit) =>
      `Simulates ${unit === "era" ? "every season" : "the season"} as it happened in real life. Results will be very similar to what happened in reality.`,
    units: BOTH,
    settings: {},
  },
  {
    id: "random-teams",
    name: "Drivers drive for random teams",
    blurb: () =>
      "What happens if drivers were placed in teams at random? Schumacher could end up at Minardi, or Lance Stroll at Ferrari.",
    units: BOTH,
    settings: { seating: { kind: "random", includeUnemployed: false } },
  },
  {
    id: "fastest-in-slowest",
    name: "Fastest drivers in slowest teams",
    blurb: () =>
      "What happens if the grid is reversed, and the best drivers end up in the worst cars?",
    units: BOTH,
    settings: { seating: { kind: "fastest-in-slowest", includeUnemployed: false } },
  },
  {
    id: "drift",
    name: "Car performance drifts from real life",
    blurb: () => "What if instead of Ferrari dominating the early 2000s it was Sauber? Or Toyota?",
    units: ["era"],
    settings: { carPerformance: DRIFT, enginePerformance: DRIFT, development: "random" },
  },
  {
    id: "all-time-best",
    name: "The all-time best drivers",
    blurb: () => "The top drivers of all time, at their best, are all put on the grid.",
    units: ["season"],
    ratingMode: "peak",
    settings: {
      seating: { kind: "fastest-in-fastest", includeUnemployed: true },
      driverPool: { ...OPENING_DRIVER_POOL, activeOnly: false },
    },
  },
  {
    id: "frozen-grid",
    name: "New teams don't come in, old teams don't retire",
    blurb: () =>
      `What if the 1980 grid stays the same until ${PLAYABLE_SEASONS.at(-1) ?? ""}? Lotus, Brabham and Tyrrell continue to race. Mercedes and Red Bull never come to exist.`,
    units: ["era"],
    settings: {
      teams: { fill: "last" },
      teamNames: "first",
      liveries: "first",
      engineSuppliers: "first",
    },
  },
  {
    id: "attrition",
    name: "High attrition, high randomness",
    blurb: () =>
      "The same teams and cars, but everyone can be good on their day, and any car can retire at any moment. Who wins?",
    units: BOTH,
    randomness: RANDOMNESS_LEVELS.at(-1) ?? 5,
    settings: { reliability: PLAYABLE_SEASONS[0] ?? FIRST_SEASON },
  },
];

/** The presets a setup screen offers, in order. */
export function presetsFor(unit: RunUnit): readonly Preset[] {
  return PRESETS.filter((preset) => preset.units.includes(unit));
}
