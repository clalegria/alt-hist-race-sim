/**
 * What a real season actually did, as the fit's target.
 *
 * These live in `tools/calibrate/targets/<year>.json` rather than in
 * `packages/data`, because nothing in the simulation reads them: they are an
 * input to calibration, not seed data. They are authored by hand from the real
 * results and are the one part of fitting that no tool can do for you.
 *
 * Keyed by `teamId`, never by display name. A team's name is an era — the 2026
 * entry called "Racing Bulls" is `minardi` in the files and was displayed as
 * "RB" until recently — so a name key silently stops matching the day a livery
 * or identity is edited.
 *
 * Not to be confused with `targets.ts`, which holds the *tuner's* win- and
 * pole-share targets for 1980 and 1981 inline. That one drives `pnpm tune`;
 * this one drives `pnpm fit`.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** One team's real season. */
export interface TeamTarget {
  /** Championship points as the real season scored them, whatever its scale. */
  readonly points: number;
  readonly wins: number;
  readonly podiums: number;
  /** Retirements across every car the team entered, all causes. */
  readonly dnfs: number;
}

export interface FitTargets {
  readonly year: number;
  /** Races the real figures cover — a part season is fine, and common. */
  readonly races: number;
  /** Starts each team made, i.e. `races * cars entered`. Denominator for `dnfs`. */
  readonly startsPerTeam: number;
  readonly note?: string;
  readonly teams: Readonly<Record<string, TeamTarget>>;
}

const TARGETS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "targets");

/** Years with a target file, for the error message when one is missing. */
export function targetedYears(): number[] {
  if (!fs.existsSync(TARGETS_DIR)) {
    return [];
  }
  return fs
    .readdirSync(TARGETS_DIR)
    .filter((name) => name.endsWith(".json"))
    .map((name) => Number.parseInt(name.slice(0, -5), 10))
    .filter((year) => Number.isFinite(year))
    .sort((a, b) => a - b);
}

function fail(year: number, message: string): never {
  throw new Error(`targets/${year}.json: ${message}`);
}

/**
 * Reads and validates one year's targets.
 *
 * Throws rather than defaulting on anything, for the reason `parseYear` does:
 * a fit run against a silently substituted target prints one season's answer
 * under another season's heading.
 */
export function fitTargets(year: number): FitTargets {
  const file = path.join(TARGETS_DIR, `${year}.json`);
  if (!fs.existsSync(file)) {
    const known = targetedYears();
    throw new Error(
      `No targets for ${year}. Authored: ${known.length === 0 ? "(none)" : known.join(", ")}. ` +
        `Write tools/calibrate/targets/${year}.json to fit it.`,
    );
  }
  const raw = JSON.parse(fs.readFileSync(file, "utf-8")) as FitTargets;

  if (raw.year !== year) {
    fail(year, `says year ${raw.year}`);
  }
  for (const field of ["races", "startsPerTeam"] as const) {
    if (!Number.isFinite(raw[field]) || raw[field] < 1) {
      fail(year, `${field} must be a positive number`);
    }
  }
  const entries = Object.entries(raw.teams ?? {});
  if (entries.length === 0) {
    fail(year, "has no teams");
  }
  for (const [teamId, target] of entries) {
    for (const field of ["points", "wins", "podiums", "dnfs"] as const) {
      const value = target?.[field];
      if (!Number.isFinite(value) || value < 0) {
        fail(year, `${teamId}.${field} must be a non-negative number`);
      }
    }
    if (target.dnfs > raw.startsPerTeam) {
      fail(year, `${teamId} retired ${target.dnfs} times from ${raw.startsPerTeam} starts`);
    }
    if (target.wins > raw.races) {
      fail(year, `${teamId} won ${target.wins} of ${raw.races} races`);
    }
  }
  return raw;
}

/** Each team's share of all points scored, which is what the fit scores against. */
export function pointsShare(targets: FitTargets): Map<string, number> {
  const total = Object.values(targets.teams).reduce((sum, t) => sum + t.points, 0);
  if (total <= 0) {
    fail(targets.year, "no team scored a point");
  }
  return new Map(Object.entries(targets.teams).map(([id, t]) => [id, t.points / total]));
}
