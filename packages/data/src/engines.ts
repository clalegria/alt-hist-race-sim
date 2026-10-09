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

import type { EngineSpec, Rng } from "@alt-hist/engine";
import { clamped } from "./chassis.js";
import { engines as enginePool } from "./index.js";
import { seasons } from "./seasons/index.js";
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

/** The authored season for a year, or undefined: the seed data, or a test's own. */
export type SeasonHistory = (year: number) => SeasonSeed | undefined;

const seedHistory: SeasonHistory = (year) => seasons.get(year);

/**
 * An engine's latest authored values at or before `year`, searching back no
 * further than `floor`, or undefined if none of those years rates it.
 */
export function latestEngineSpec(
  engineId: string,
  year: number,
  floor: number,
  history: SeasonHistory = seedHistory,
): SeasonEngine | undefined {
  for (let before = year; before >= floor; before--) {
    const spec = history(before)?.engines.find((engine) => engine.engineId === engineId);
    if (spec !== undefined) {
      return spec;
    }
  }
  return undefined;
}

/**
 * The season with each team on the engine it ran in **its first season at or
 * after `keptFrom`** — *Engine supplier changes: No*. The start year for a team
 * on the opening grid, its own first year for one that arrives later: the rule
 * `firstYearInRun` keeps a name by.
 *
 * An engine the year does not rate races its latest authored values instead,
 * added to the season's `engines` so `applyEngines` and `buildField` accept it —
 * the rule a ghost entry's engine follows (`keptYear`). Null `keptFrom` is the
 * season untouched.
 */
export function withFirstEngines(
  season: SeasonSeed,
  keptFrom: number | null,
  history: SeasonHistory = seedHistory,
): SeasonSeed {
  if (keptFrom === null || season.year <= keptFrom) {
    return season;
  }
  const first = new Map<string, { engineId: string; year: number }>();
  for (let year = keptFrom; year < season.year; year++) {
    for (const entry of history(year)?.entries ?? []) {
      if (!first.has(entry.teamId)) {
        first.set(entry.teamId, { engineId: entry.engineId, year });
      }
    }
  }
  const engines = [...season.engines];
  const entries = season.entries.map((entry) => {
    const kept = first.get(entry.teamId);
    if (kept === undefined || kept.engineId === entry.engineId) {
      return entry;
    }
    if (!engines.some((engine) => engine.engineId === kept.engineId)) {
      const spec = latestEngineSpec(kept.engineId, season.year - 1, kept.year, history);
      if (spec === undefined) {
        throw new Error(
          `Engine "${kept.engineId}" has no ratings from ${kept.year} to ${season.year}`,
        );
      }
      engines.push(spec);
    }
    return { ...entry, engineId: kept.engineId };
  });
  return { ...season, engines, entries };
}

/** Engine ratings per engine id: the same keys as the season's `engines`. */
export type SeasonEngineRatings = Readonly<Record<string, EngineSpec>>;

/** The three engine ratings, in the order the grid lists them. */
export const ENGINE_KEYS = ["racing", "qualifying", "reliability"] as const;

/** Every engine on the season's menu, at the values it was authored with. */
export function authoredEngineRatings(season: SeasonSeed): SeasonEngineRatings {
  const rated: Record<string, EngineSpec> = {};
  for (const { engineId, racing, qualifying, reliability } of season.engines) {
    rated[engineId] = { racing, qualifying, reliability };
  }
  return rated;
}

/**
 * The season with its engines re-rated: every engine on the menu, the same
 * for each team running it. Validates rather than trusts, as `applyChassis`
 * does.
 */
export function applyEngineRatings(season: SeasonSeed, ratings: SeasonEngineRatings): SeasonSeed {
  const known = new Set(season.engines.map((engine) => engine.engineId));
  for (const engineId of Object.keys(ratings)) {
    if (!known.has(engineId)) {
      throw new Error(
        `Engine ratings name "${engineId}", which season ${season.year} has no rating for`,
      );
    }
  }
  const engines = season.engines.map((engine) => {
    const rated = ratings[engine.engineId];
    if (rated === undefined) {
      throw new Error(`Engine ratings are missing "${engine.engineId}"`);
    }
    for (const key of ENGINE_KEYS) {
      const value = rated[key];
      if (!Number.isInteger(value) || value < 0 || value > 100) {
        throw new Error(
          `Engine "${engine.engineId}" has ${key} ${String(value)}; ratings are whole numbers from 0 to 100`,
        );
      }
    }
    return { engineId: engine.engineId, ...rated };
  });
  return { ...season, engines };
}

/**
 * Every engine moved by one whole-number offset, uniform in [−spread, spread],
 * on all three ratings, each held inside the scale on its own — the
 * *Engine performance: Random factor is added* roll. **Per engine, not per
 * team**, so every team running one moves together.
 *
 * Each moves off `from`'s values for it when there are some (*previous
 * season's engine*, a walk), else off the season's own. Draws one number per
 * engine, in the season's `engines` order, whatever `from` holds.
 */
export function variedEngines(
  season: SeasonSeed,
  spread: number,
  rng: Rng,
  from: SeasonEngineRatings | null = null,
): SeasonEngineRatings {
  const rolled: Record<string, EngineSpec> = {};
  for (const engine of season.engines) {
    const offset = rng.nextInt(-spread, spread + 1);
    const { racing, qualifying, reliability } = from?.[engine.engineId] ?? engine;
    rolled[engine.engineId] = {
      racing: clamped(racing + offset),
      qualifying: clamped(qualifying + offset),
      reliability: clamped(reliability + offset),
    };
  }
  return rolled;
}

/**
 * Every engine rating drawn uniformly between the season's weakest and
 * strongest value of it, each rating on its own — the *Engine performance:
 * Totally random* roll. Draws three numbers per engine, in the season's
 * `engines` order and `ENGINE_KEYS` order.
 */
export function randomEngines(season: SeasonSeed, rng: Rng): SeasonEngineRatings {
  const ranges = ENGINE_KEYS.map((key) => {
    const values = season.engines.map((engine) => engine[key]);
    return { key, min: Math.min(...values), max: Math.max(...values) };
  });
  const rolled: Record<string, EngineSpec> = {};
  for (const { engineId, racing, qualifying, reliability } of season.engines) {
    let spec: EngineSpec = { racing, qualifying, reliability };
    for (const { key, min, max } of ranges) {
      spec = { ...spec, [key]: rng.nextInt(min, max + 1) };
    }
    rolled[engineId] = spec;
  }
  return rolled;
}
