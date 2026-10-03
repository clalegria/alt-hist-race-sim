import type { World } from "../store/season.js";
import { randomnessLabel } from "./RandomnessSlider.js";

/**
 * What this championship was simulated under, in one line.
 *
 * A finished season and a roll of honour are the two places a reader arrives at
 * a *result* — and a result is meaningless without the rules it was produced
 * under. "Bruno Giacomelli, champion" is a curiosity at Balanced and a shrug at
 * Chaotic, and the page should not make anyone remember which run they are
 * looking at. It is also the line to quote in a bug report.
 *
 * Deliberately a **list of settings, not a sentence about randomness**. The
 * settings are going to multiply — a reliability level of its own is already
 * planned, wet weather and circuit character are on the roadmap — so the shape
 * that has to survive is "name: value, name: value", and adding one is a line in
 * `settingsOf` rather than a rewrite of the copy on two screens. Kept to one
 * small muted line for the same reason: it has to still fit when there are four.
 */

export interface Setting {
  readonly name: string;
  readonly value: string;
}

/** The settings one world was run under. The only place the list is written. */
export function settingsOf(world: Pick<World, "randomness">): readonly Setting[] {
  return [{ name: "Randomness", value: randomnessLabel(world.randomness) }];
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
    return null;
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
