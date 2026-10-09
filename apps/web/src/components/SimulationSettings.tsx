import { STARTING_RANDOMNESS_LEVEL } from "../lib/preferences.js";
import { type Setting, whatIfsOf } from "../lib/run-settings.js";
import type { World } from "../store/season.js";
import { randomnessLabel } from "./RandomnessSlider.js";

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
 * when nothing does.
 */

export type { Setting };

/**
 * The settings one world was run under that are not the defaults: its luck on
 * the day off the level the app opens on, then every run setting that is not
 * historical (`whatIfsOf`). The only place the list is written.
 */
export function settingsOf(world: Pick<World, "randomness" | "settings">): readonly Setting[] {
  return [
    ...(world.randomness === STARTING_RANDOMNESS_LEVEL
      ? []
      : [{ name: "Luck on the day", value: randomnessLabel(world.randomness) }]),
    ...whatIfsOf(world.settings),
  ];
}

export function SimulationSettings({
  settings,
  className,
}: {
  /**
   * The settings to state, from `settingsOf`. A list rather than the world it
   * came from, so this stays a way of *drawing* settings and the season summary
   * can keep taking pieces of a world rather than the whole thing.
   */
  settings: readonly Setting[];
  className?: string;
}) {
  if (settings.length === 0) {
    return <p className={className}>Default settings</p>;
  }

  return (
    <p className={className}>
      <span className="sr-only">Simulation settings: </span>
      {settings.map((setting, index) => (
        <span key={setting.name}>
          {index === 0 ? "" : " · "}
          {setting.name}: <span className="text-foreground font-medium">{setting.value}</span>
        </span>
      ))}
    </p>
  );
}
