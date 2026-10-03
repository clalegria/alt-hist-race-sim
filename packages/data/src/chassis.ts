/**
 * How good each team's chassis is, as the reader would have it.
 *
 * The chassis layer over a season seed, mirroring `engines.ts`: a
 * `SeasonChassis` is an override of the season's authored chassis ratings — the
 * same teams, different numbers — and `applyChassis(season, chassis)` hands back
 * a `SeasonSeed` that `buildField` consumes unchanged.
 *
 * It exists so a reader who thinks a car was better or worse than the data says
 * can run that season instead. **It never edits the authored data**: it is a
 * grid-editor what-if, carried by one world and gone the next year. Plain data —
 * a record of ratings — because it is part of the saved world beside the lineup
 * and the engines.
 *
 * Absolute ratings rather than offsets, so a check is a range check and the
 * draft is simply the chassis as it now stands; how far it moved is derived
 * against the season (`chassisChanges`).
 */

import type { ChassisSpec, SeasonSeed } from "./types.js";

/** Chassis ratings per team id: the same keys as the season it overrides. */
export type SeasonChassis = Readonly<Record<string, ChassisSpec>>;

/** The four chassis ratings, in the order the grid lists them. */
export const CHASSIS_KEYS = ["racing", "qualifying", "consistency", "reliability"] as const;

/**
 * How far a step may take a rating: the 1–100 scale the ratings are written on.
 *
 * Narrower than what `applyChassis` accepts (0–100, the seed data's own check),
 * so a step can never produce a rating the data could not hold.
 */
export const CHASSIS_STEP_RANGE = { min: 1, max: 100 } as const;

/** The chassis ratings as authored — the override every edit starts from. */
export function authoredChassis(season: SeasonSeed): SeasonChassis {
  const chosen: Record<string, ChassisSpec> = {};
  for (const entry of season.entries) {
    chosen[entry.teamId] = entry.chassis;
  }
  return chosen;
}

function sameChassis(a: ChassisSpec, b: ChassisSpec): boolean {
  return CHASSIS_KEYS.every((key) => a[key] === b[key]);
}

/** Whether an override is the authored chassis, team for team. */
export function isAuthoredChassis(season: SeasonSeed, chassis: SeasonChassis): boolean {
  if (Object.keys(chassis).length !== season.entries.length) {
    return false;
  }
  return season.entries.every((entry) => {
    const now = chassis[entry.teamId];
    return now !== undefined && sameChassis(now, entry.chassis);
  });
}

/**
 * The season with its chassis re-rated.
 *
 * Validates rather than trusts, for the reason `applyEngines` does: an override
 * can arrive from a save file, and a rating outside the scale would show up much
 * later as a car nobody can explain.
 */
export function applyChassis(season: SeasonSeed, chassis: SeasonChassis): SeasonSeed {
  const known = new Set(season.entries.map((entry) => entry.teamId));
  for (const teamId of Object.keys(chassis)) {
    if (!known.has(teamId)) {
      throw new Error(`Chassis name team "${teamId}", which does not enter season ${season.year}`);
    }
  }

  const entries = season.entries.map((entry) => {
    const rated = chassis[entry.teamId];
    if (rated === undefined) {
      throw new Error(`Chassis are missing ratings for team "${entry.teamId}"`);
    }
    for (const key of CHASSIS_KEYS) {
      const value = rated[key];
      if (!Number.isInteger(value) || value < 0 || value > 100) {
        throw new Error(
          `Chassis for "${entry.teamId}" has ${key} ${String(value)}; ratings are whole numbers from 0 to 100`,
        );
      }
    }
    const { racing, qualifying, consistency, reliability } = rated;
    return { ...entry, chassis: { racing, qualifying, consistency, reliability } };
  });

  return { ...season, entries };
}

/** One rating moved by a step, held inside the scale. */
function stepped(value: number, step: 1 | -1): number {
  return Math.min(Math.max(value + step, CHASSIS_STEP_RANGE.min), CHASSIS_STEP_RANGE.max);
}

/**
 * One team's chassis a point better or worse: one rating, or all four when no
 * rating is named.
 *
 * Each rating is held inside the scale on its own, so a car already at 100 for
 * racing still gains the other three. Hands back the override it was given when
 * nothing could move, so a press at the limit changes nothing.
 */
export function stepChassis(
  chassis: SeasonChassis,
  teamId: string,
  step: 1 | -1,
  key?: keyof ChassisSpec,
): SeasonChassis {
  const current = chassis[teamId];
  if (current === undefined) {
    return chassis;
  }
  let next: ChassisSpec = current;
  for (const k of key === undefined ? CHASSIS_KEYS : [key]) {
    next = { ...next, [k]: stepped(current[k], step) };
  }
  return sameChassis(next, current) ? chassis : { ...chassis, [teamId]: next };
}

/** Whether a step that way could move this chassis at all — one rating, or any of the four. */
export function canStepChassis(
  chassis: ChassisSpec,
  step: 1 | -1,
  key?: keyof ChassisSpec,
): boolean {
  const keys = key === undefined ? CHASSIS_KEYS : [key];
  return keys.some((k) => stepped(chassis[k], step) !== chassis[k]);
}

/**
 * One team's re-rated chassis.
 *
 * Both ends, like an `EngineChange`, so whoever reads it can say how far it
 * moved rating by rating.
 */
export interface ChassisChange {
  readonly teamId: string;
  /** The chassis the season authored. */
  readonly from: ChassisSpec;
  /** The one they run instead. */
  readonly to: ChassisSpec;
}

/** Every team whose chassis differs from the authored season, in entry order. */
export function chassisChanges(
  season: SeasonSeed,
  chassis: SeasonChassis,
): readonly ChassisChange[] {
  const changes: ChassisChange[] = [];
  for (const entry of season.entries) {
    const now = chassis[entry.teamId] ?? entry.chassis;
    if (!sameChassis(now, entry.chassis)) {
      changes.push({ teamId: entry.teamId, from: entry.chassis, to: now });
    }
  }
  return changes;
}
