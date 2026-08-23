/**
 * Who supplies whom.
 *
 * The engine layer over a season seed, mirroring `lineup.ts` exactly: a
 * `SeasonEngines` is an override of the season's authored supply deals — the
 * same teams, a different unit in the back of each — and `applyEngines(season,
 * engines)` hands back a `SeasonSeed` that `buildField` consumes unchanged.
 *
 * It exists so a reader can find out what Ferrari's 1980 chassis would have done
 * with a Renault turbo in it, and so a season that was changed can say what was
 * changed. Plain data — a record of strings — because it is part of the saved
 * world alongside the seed, the year and the lineup.
 *
 * **A team can only be given an engine the season actually has.** The menu is
 * the season's own `engines` list, which is authored per year because an engine
 * is not one thing for a decade. Nothing here can invent a supplier, and
 * `applyEngines` re-validates rather than trusting, because an override can
 * arrive from a save file.
 */

import { engines as enginePool } from "./index.js";
import type { EngineManufacturer, SeasonEngine, SeasonSeed } from "./types.js";

/** Engine manufacturer ids per team id: the same keys as the season it overrides. */
export type SeasonEngines = Readonly<Record<string, string>>;

/** The supply deals as authored — the override every edit starts from. */
export function authoredEngines(season: SeasonSeed): SeasonEngines {
  const chosen: Record<string, string> = {};
  for (const entry of season.entries) {
    chosen[entry.teamId] = entry.engineId;
  }
  return chosen;
}

/**
 * Every engine the season has, in the order the manufacturers are listed in
 * `engines.json` rather than the order the season file happens to use.
 *
 * A stable order across seasons, so a picker does not reshuffle itself between
 * years, and an engine nobody entered still appears — the list is the season's
 * menu, not a record of what was used.
 */
export function availableEngines(
  season: SeasonSeed,
  pool: readonly EngineManufacturer[] = enginePool,
): readonly SeasonEngine[] {
  const order = new Map(pool.map((maker, index) => [maker.id, index]));
  return [...season.engines].sort(
    (a, b) => (order.get(a.engineId) ?? Infinity) - (order.get(b.engineId) ?? Infinity),
  );
}

/** What one engine was worth in a season, or undefined if the season lacks it. */
export function engineSpecOf(season: SeasonSeed, engineId: string): SeasonEngine | undefined {
  return season.engines.find((engine) => engine.engineId === engineId);
}

/** Whether an override is the authored supply, team for team. */
export function isAuthoredEngines(season: SeasonSeed, engines: SeasonEngines): boolean {
  const authored = authoredEngines(season);
  const teamIds = Object.keys(authored);
  if (Object.keys(engines).length !== teamIds.length) {
    return false;
  }
  return teamIds.every((teamId) => engines[teamId] === authored[teamId]);
}

/**
 * The season with its engines reallocated.
 *
 * Validates rather than trusts, for the same reason `applyLineup` does: a team
 * quietly running a unit the year never had would show up much later as a car
 * nobody can explain.
 */
export function applyEngines(season: SeasonSeed, engines: SeasonEngines): SeasonSeed {
  const known = new Set(season.entries.map((entry) => entry.teamId));
  for (const teamId of Object.keys(engines)) {
    if (!known.has(teamId)) {
      throw new Error(`Engines name team "${teamId}", which does not enter season ${season.year}`);
    }
  }

  const available = new Set(season.engines.map((engine) => engine.engineId));
  const entries = season.entries.map((entry) => {
    const engineId = engines[entry.teamId];
    if (engineId === undefined) {
      throw new Error(`Engines are missing a supplier for team "${entry.teamId}"`);
    }
    if (!available.has(engineId)) {
      throw new Error(
        `Season ${season.year} has no engine "${engineId}" to give "${entry.teamId}"`,
      );
    }
    return { ...entry, engineId };
  });

  return { ...season, entries };
}

/**
 * One team's change of supplier.
 *
 * Always both halves: an engine deal is a replacement, never an addition, so
 * this reads as "Ferrari now run a Renault" rather than two unrelated facts.
 */
export interface EngineChange {
  readonly teamId: string;
  /** The manufacturer the season authored for them. */
  readonly from: string;
  /** The one they run instead. */
  readonly to: string;
}

/** Every team whose engine differs from the authored season, in entry order. */
export function engineChanges(season: SeasonSeed, engines: SeasonEngines): readonly EngineChange[] {
  const changes: EngineChange[] = [];
  for (const entry of season.entries) {
    const now = engines[entry.teamId] ?? entry.engineId;
    if (now !== entry.engineId) {
      changes.push({ teamId: entry.teamId, from: entry.engineId, to: now });
    }
  }
  return changes;
}
