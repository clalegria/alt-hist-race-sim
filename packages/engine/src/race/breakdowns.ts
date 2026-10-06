/**
 * How often cars break down, as a what-if chosen before a run starts.
 *
 * A multiplier on the **mechanical** failure risk only, on top of the season's
 * retirement factor. Driver error stays: composure is a driver rating, and
 * "no breakdowns" means the cars never fail, not that nobody crashes.
 *
 * Same shape as `randomness.ts` and `retirement.ts`: a derived copy of the
 * constants, never an edit to them, and the constants object itself, by
 * identity, at the historical setting.
 */

import { RACE_CONSTANTS, type RaceConstants } from "./constants.js";

/** As often as the year's cars really failed, half as often, or never. */
export type Breakdowns = "realistic" | "fewer" | "none";

/** Every setting, the historical one first. */
export const BREAKDOWNS: readonly Breakdowns[] = Object.freeze(["realistic", "fewer", "none"]);

/** What each setting multiplies the mechanical risk by. */
const BREAKDOWN_SCALE: Readonly<Record<Breakdowns, number>> = Object.freeze({
  realistic: 1,
  fewer: 0.5,
  none: 0,
});

/** The multiplier a setting applies to the mechanical risk. */
export function breakdownScale(breakdowns: Breakdowns): number {
  return BREAKDOWN_SCALE[breakdowns] ?? 1;
}

/**
 * The constants a run with this setting races on.
 *
 * Scales `mechanicalDnfEraScale`, which the retirement factor and the weather
 * also multiply, so a zero stays zero through both.
 */
export function withBreakdowns(
  breakdowns: Breakdowns,
  constants: RaceConstants = RACE_CONSTANTS,
): RaceConstants {
  const scale = breakdownScale(breakdowns);
  if (scale === 1) {
    return constants;
  }
  return Object.freeze({
    ...constants,
    mechanicalDnfEraScale: constants.mechanicalDnfEraScale * scale,
  });
}

/** Narrows an arbitrary value to a setting, falling back to the historical one. */
export function parseBreakdowns(value: unknown): Breakdowns {
  return BREAKDOWNS.find((breakdowns) => breakdowns === value) ?? "realistic";
}
