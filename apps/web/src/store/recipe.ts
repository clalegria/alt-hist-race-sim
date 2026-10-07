/**
 * A run as the few facts that rebuild it — what survives a reload.
 *
 * Simulation is deterministic, so a world is a function of the inputs it was
 * built from, and every `World` already records all of them: the seed, the
 * year, the ability mode, the randomness level, the run settings, the year
 * its team names are kept from and the reader's grid (lineup, engines, chassis, arrangement). The recipe is therefore *derived* from the run rather
 * than kept beside it: one entry per world, plus the cursor. There is no second
 * record of the reader's inputs that could fall out of step with the worlds.
 *
 * Each world's seed is stored rather than re-derived with `nextSeed`, because a
 * restart mid-era draws a fresh one that nothing else could reproduce.
 *
 * **The fingerprint is the build check.** Beside each world's inputs goes a hash
 * of the world they produced. Resumed on a build whose data or engine would
 * replay those inputs differently, the hashes disagree and the run is refused,
 * rather than history being quietly rewritten under the reader. A build that
 * changes nothing the simulation reads leaves the run resumable.
 *
 * Pure: no storage here (`persist.ts` reads and writes it).
 */

import {
  type GridArrangement,
  RATING_MODES,
  type RatingMode,
  type SeasonChassis,
  type SeasonEngines,
  type SeasonLineup,
} from "@alt-hist/data";
import { RANDOMNESS_LEVELS, type RandomnessLevel } from "@alt-hist/engine";
import { parseRunSettings, type RunSettings } from "../lib/run-settings.js";
import { isPlayable, nextEraYear } from "../lib/seasons.js";
import type { Beat } from "../lib/timeline.js";
import { createWorld, type Run, type World } from "./season.js";

/** Bumped when the recipe changes shape; any other version is refused. */
export const RECIPE_VERSION = 7;

/** Everything `createWorld` was called with, and a hash of what it returned. */
export interface WorldRecipe {
  readonly seed: number;
  readonly year: number;
  readonly ratingMode: RatingMode;
  readonly randomness: RandomnessLevel;
  readonly settings: RunSettings;
  /** The era's first year under *Team names: Keep the first*, else null. */
  readonly namesKeptFrom: number | null;
  readonly lineup: SeasonLineup | null;
  readonly engines: SeasonEngines | null;
  readonly chassis: SeasonChassis | null;
  readonly arrangement: GridArrangement | null;
  /** `fingerprint` of the world these inputs built. */
  readonly check: string;
}

/** A run: its kind, its worlds in order — an era's crowned years, then the cursor's — and the cursor. */
export interface RunRecipe {
  readonly version: number;
  readonly kind: Run["kind"];
  readonly worlds: readonly WorldRecipe[];
  readonly cursor: Beat;
}

const fingerprints = new WeakMap<World, string>();

/**
 * A 32-bit FNV-1a hash of the world's JSON, as hex.
 *
 * Over the whole world, field included, so a retuned rating is caught even in a
 * season it happens not to change the result of — the run on screen would no
 * longer be the run the reader saw. Worlds are never mutated, so each one is
 * hashed once.
 */
export function fingerprint(world: World): string {
  const known = fingerprints.get(world);
  if (known !== undefined) {
    return known;
  }
  const json = JSON.stringify(world);
  let hash = 0x811c9dc5;
  for (let i = 0; i < json.length; i += 1) {
    hash ^= json.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const hex = (hash >>> 0).toString(16).padStart(8, "0");
  fingerprints.set(world, hex);
  return hex;
}

function worldRecipe(world: World): WorldRecipe {
  return {
    seed: world.seed,
    year: world.year,
    ratingMode: world.ratingMode,
    randomness: world.randomness,
    settings: world.settings,
    namesKeptFrom: world.namesKeptFrom,
    lineup: world.lineup,
    engines: world.engines,
    chassis: world.chassis,
    arrangement: world.arrangement,
    check: fingerprint(world),
  };
}

/** The recipe for a run. Plain data, ready for `JSON.stringify`. */
export function recipeOf(run: Run): RunRecipe {
  const worlds = run.kind === "era" ? [...run.run.seasons, run.world] : [run.world];
  return {
    version: RECIPE_VERSION,
    kind: run.kind,
    worlds: worlds.map(worldRecipe),
    cursor: run.cursor,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A plain object or null: what a lineup, an engine supply, a chassis set or an arrangement looks like from outside. */
function isRecordOrNull(value: unknown): boolean {
  return value === null || isRecord(value);
}

/** The cursor, if `raw` is a beat; a round is checked against its season later. */
function parseBeat(raw: unknown): Beat | null {
  if (!isRecord(raw)) {
    return null;
  }
  switch (raw.kind) {
    case "grid":
    case "summary":
    case "review":
      return { kind: raw.kind };
    case "qualifying":
    case "race":
      return Number.isInteger(raw.round) && (raw.round as number) >= 0
        ? { kind: raw.kind, round: raw.round as number }
        : null;
    default:
      return null;
  }
}

/** One world's inputs, if `raw` has the shape of them. Their *contents* are judged by the rebuild. */
function parseWorldRecipe(raw: unknown): WorldRecipe | null {
  if (!isRecord(raw)) {
    return null;
  }
  const {
    seed,
    year,
    ratingMode,
    randomness,
    namesKeptFrom,
    lineup,
    engines,
    chassis,
    arrangement,
    check,
  } = raw;
  const settings = parseRunSettings(raw.settings);
  const valid =
    Number.isInteger(seed) &&
    Number.isInteger(year) &&
    isPlayable(year as number) &&
    RATING_MODES.some((mode) => mode === ratingMode) &&
    RANDOMNESS_LEVELS.some((level) => level === randomness) &&
    settings !== null &&
    (namesKeptFrom === null ||
      (Number.isInteger(namesKeptFrom) && isPlayable(namesKeptFrom as number))) &&
    isRecordOrNull(lineup) &&
    isRecordOrNull(engines) &&
    isRecordOrNull(chassis) &&
    isRecordOrNull(arrangement) &&
    typeof check === "string";
  return valid ? { ...(raw as unknown as WorldRecipe), settings } : null;
}

/** The world a recipe builds, or null when this build would not build the same one. */
function rebuild(recipe: WorldRecipe): World | null {
  const world = createWorld(
    recipe.seed,
    recipe.year,
    recipe.ratingMode,
    recipe.lineup,
    recipe.engines,
    recipe.randomness,
    recipe.arrangement,
    recipe.chassis,
    recipe.settings,
    recipe.namesKeptFrom,
  );
  return fingerprint(world) === recipe.check ? world : null;
}

/** Whether the cursor names a beat the world actually has. */
function fits(cursor: Beat, world: World, kind: Run["kind"]): boolean {
  if (cursor.kind === "qualifying" || cursor.kind === "race") {
    return cursor.round < world.season.races.length;
  }
  return cursor.kind !== "review" || kind === "era";
}

/**
 * The run a stored recipe rebuilds, or null for anything that does not rebuild
 * exactly: a malformed or tampered value, a version this build does not read,
 * years that do not chain, a cursor off the end of its season, or a world that
 * this build simulates differently.
 *
 * The input is untrusted — it comes out of storage the reader controls — so it
 * is checked before it reaches `createWorld`, and anything that throws on the
 * way is a refusal rather than a crash.
 */
export function runFromRecipe(raw: unknown): Run | null {
  try {
    if (!isRecord(raw) || raw.version !== RECIPE_VERSION) {
      return null;
    }
    const { kind } = raw;
    if ((kind !== "season" && kind !== "era") || !Array.isArray(raw.worlds)) {
      return null;
    }
    const recipes = raw.worlds.map(parseWorldRecipe);
    const cursor = parseBeat(raw.cursor);
    if (
      cursor === null ||
      recipes.length === 0 ||
      (kind === "season" && recipes.length !== 1) ||
      recipes.some((recipe) => recipe === null)
    ) {
      return null;
    }
    const checked = recipes as WorldRecipe[];
    // An era is consecutive playable years, exactly as Continue walks them.
    if (
      checked.some((recipe, i) => i > 0 && nextEraYear(checked[i - 1]?.year ?? 0) !== recipe.year)
    ) {
      return null;
    }
    const worlds: World[] = [];
    for (const recipe of checked) {
      const world = rebuild(recipe);
      if (world === null) {
        return null;
      }
      worlds.push(world);
    }
    const world = worlds.at(-1);
    if (world === undefined || !fits(cursor, world, kind)) {
      return null;
    }
    if (kind === "season") {
      return { kind, world, cursor };
    }
    const seasons = worlds.slice(0, -1);
    return {
      kind,
      run: { startYear: worlds[0]?.year ?? world.year, seasons },
      world,
      cursor,
    };
  } catch {
    return null;
  }
}
