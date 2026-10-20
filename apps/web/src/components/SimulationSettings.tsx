import { DEFAULT_RATING_MODE } from "@alt-hist/data";
import { useState } from "react";
import { STARTING_RANDOMNESS_LEVEL } from "../lib/preferences.js";
import { PRESETS, type Preset } from "../lib/presets.js";
import { HISTORICAL_SETTINGS, type Setting, whatIfsOf } from "../lib/run-settings.js";
import type { World } from "../store/season.js";
import { PEAK_LABEL } from "./DriverAbilitySetting.js";
import { randomnessLabel } from "./RandomnessSlider.js";
import { Button } from "./ui/button.js";

/**
 * What this championship was simulated under, in one line.
 *
 * A finished season and a roll of honour are the two places a reader arrives at
 * a *result* — and a result is meaningless without the rules it was produced
 * under. "Bruno Giacomelli, champion" is a curiosity at Balanced and a shrug at
 * Lottery, and the page should not make anyone remember which run they are
 * looking at. It is also the line to quote in a bug report.
 *
 * Deliberately a **list of settings, not a sentence about randomness**. The
 * settings multiply — Breakdowns, Reliability and Points already, with more to
 * come — so the shape
 * that has to survive is "name: value, name: value", and adding one is a line in
 * `settingsOf` rather than a rewrite of the copy on two screens. Kept to one
 * small muted line for the same reason: it has to still fit when there are four.
 *
 * It names only what differs from the defaults, and says "Default settings"
 * when nothing does. A scenario's settings are said by its name, and past
 * three the rest wait behind "N more", so a busy run stays a short line.
 */

export type { Setting };

/**
 * The settings one world was run under that are not the defaults: its luck on
 * the day off the level the app opens on, drivers at their best, then every run
 * setting that is not historical (`whatIfsOf`). The only place the list is
 * written.
 */
export function settingsOf(
  world: Pick<World, "randomness" | "ratingMode" | "settings">,
): readonly Setting[] {
  return [
    ...(world.randomness === STARTING_RANDOMNESS_LEVEL
      ? []
      : [{ name: "Luck on the day", value: randomnessLabel(world.randomness) }]),
    ...(world.ratingMode === "peak" ? [{ name: "Driver ability", value: PEAK_LABEL }] : []),
    ...whatIfsOf(world.settings),
  ];
}

/** How many settings the line shows before the rest go behind "N more". */
const SHOWN = 3;

const sameSetting = (a: Setting, b: Setting) => a.name === b.name && a.value === b.value;

/**
 * The lines a *Scenarios* preset gives a run: applied over real history and
 * the default luck, as its card applies it.
 */
function presetLines(preset: Preset): readonly Setting[] {
  return settingsOf({
    randomness: preset.randomness ?? STARTING_RANDOMNESS_LEVEL,
    ratingMode: preset.ratingMode ?? DEFAULT_RATING_MODE,
    settings: { ...HISTORICAL_SETTINGS, ...preset.settings },
  });
}

/**
 * `settings` with a scenario's own lines folded into its name, when every line
 * of one is there: what was changed on top of it is still listed. The scenario
 * that covers the most lines wins.
 */
export function withScenario(settings: readonly Setting[]): readonly Setting[] {
  let best: { name: string; lines: readonly Setting[] } | null = null;
  for (const preset of PRESETS) {
    const lines = presetLines(preset);
    const covered =
      lines.length > 0 && lines.every((line) => settings.some((each) => sameSetting(each, line)));
    if (covered && (best === null || lines.length > best.lines.length)) {
      best = { name: preset.name, lines };
    }
  }
  if (best === null) {
    return settings;
  }
  const own = best.lines;
  return [
    { name: "Scenario", value: best.name },
    ...settings.filter((each) => !own.some((line) => sameSetting(each, line))),
  ];
}

export function SimulationSettings({
  settings,
  scenario = true,
  className,
}: {
  /**
   * The settings to state, from `settingsOf`. A list rather than the world it
   * came from, so this stays a way of *drawing* settings and the season summary
   * can keep taking pieces of a world rather than the whole thing.
   */
  settings: readonly Setting[];
  /** Whether a scenario's settings are said by its name; off beside the scenarios themselves. */
  scenario?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (settings.length === 0) {
    return <p className={className}>Default settings</p>;
  }

  const lines = scenario ? withScenario(settings) : settings;
  const shown = open ? lines : lines.slice(0, SHOWN);
  const hidden = lines.length - shown.length;
  return (
    <p className={className}>
      <span className="sr-only">Settings: </span>
      {shown.map((setting, index) => (
        <span key={setting.name}>
          {index === 0 ? "" : " · "}
          {setting.name}: <span className="text-foreground font-medium">{setting.value}</span>
        </span>
      ))}
      {hidden === 0 ? null : (
        <>
          {" · "}
          <Button
            variant="link"
            size="inline"
            onClick={() => {
              setOpen(true);
            }}
          >
            {hidden} more
          </Button>
        </>
      )}
    </p>
  );
}
