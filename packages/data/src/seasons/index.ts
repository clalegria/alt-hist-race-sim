/**
 * Every season, one JSON file per year, discovered rather than listed.
 *
 * **Adding a season is one file**: drop `<year>.json` in this folder. There is
 * no registry to update, so there is no way to add a season and forget to
 * announce it — which years the picker offers, which of them are playable and
 * what a world is built from all derive from what is on disk.
 *
 * Two environments have to agree on that, and they read a folder differently:
 *
 *  - **Node** (`tsx` for the CLI tools, Vitest for the suites) reads the
 *    directory with `fs`, reached through `process.getBuiltinModule` so no
 *    `node:` import statement exists for a bundler to trip over.
 *  - **The browser** has no filesystem, so Vite's `import.meta.glob` inlines
 *    the same files at build time. Bundled, no I/O, same result.
 *
 * `process.getBuiltinModule` is the discriminator: present in Node and in
 * Vitest under either environment, absent in a real browser.
 *
 * The cost is that `tsc` no longer checks each season file against
 * `SeasonSeed` — a glob has no per-file type. `validateSeedData()` covers the
 * same ground at runtime, over every season, and its tests fail loudly.
 *
 * The end state is 1950 to 2026 and beyond. Nothing here is sized for two.
 */

import type { SeasonSeed } from "../types.js";

/**
 * Vite's `import.meta.glob`, typed by hand rather than by pulling in
 * `vite/client`: this package has no Vite dependency and must not grow one —
 * `tsx` and Vitest consume it too. A cast rather than a global declaration
 * because `apps/web` type-checks this same source with `vite/client` loaded,
 * and two declarations of `glob` collide. TypeScript erases the cast before
 * Vite looks for the call, so the glob is still inlined at build time.
 */
type Globber = {
  glob(pattern: string, options: { eager: true }): Record<string, unknown>;
};

/** `<year>.json`, and nothing else in the folder. */
const SEASON_FILE = /^(\d{4})\.json$/;

interface NodeFs {
  readdirSync(path: string): string[];
  readFileSync(path: string, encoding: "utf8"): string;
}

interface NodeUrl {
  fileURLToPath(url: URL): string;
}

/** Node's escape hatch, or `undefined` in a browser. */
const getBuiltinModule = (globalThis as { process?: { getBuiltinModule?: <T>(id: string) => T } })
  .process?.getBuiltinModule;

function seasonsFromDisk(read: <T>(id: string) => T): readonly SeasonSeed[] {
  const fs = read<NodeFs>("node:fs");
  const url = read<NodeUrl>("node:url");
  // `import.meta.url` through a variable on purpose: written literally inside
  // `new URL(...)`, Vite's asset plugin would treat this module as a static
  // asset and emit a copy of it into `dist/`.
  const self = import.meta.url;
  const folder = url.fileURLToPath(new URL(".", self));
  return fs
    .readdirSync(folder)
    .filter((file) => SEASON_FILE.test(file))
    .map((file) => JSON.parse(fs.readFileSync(`${folder}/${file}`, "utf8")) as SeasonSeed);
}

function seasonsFromBundle(): readonly SeasonSeed[] {
  const modules = (import.meta as unknown as Globber).glob("./*.json", {
    eager: true,
  }) as Record<string, { default: SeasonSeed }>;
  return Object.entries(modules)
    .filter(([path]) => SEASON_FILE.test(path.replace("./", "")))
    .map(([, module]) => module.default);
}

const DISCOVERED: readonly SeasonSeed[] =
  getBuiltinModule === undefined
    ? seasonsFromBundle()
    : seasonsFromDisk(getBuiltinModule.bind(globalThis));

/** Every season on disk, by year. */
export const seasons: ReadonlyMap<number, SeasonSeed> = new Map(
  [...DISCOVERED].sort((a, b) => a.year - b.year).map((season) => [season.year, season]),
);

/** The years that have seed data, earliest first. */
export const authoredSeasons: readonly number[] = [...seasons.keys()];

/** The earliest season on disk — where a run starts unless told otherwise. */
export const FIRST_AUTHORED_SEASON: number = authoredSeasons[0] ?? 1980;

export function hasSeason(year: number): boolean {
  return seasons.has(year);
}

/**
 * The seed data for a year, or a throw.
 *
 * A throw rather than a fallback: a picker that offered a year with no data by
 * mistake would otherwise look like it worked, quietly running someone else's
 * season under the wrong heading.
 */
export function seasonSeed(year: number): SeasonSeed {
  const seed = seasons.get(year);
  if (seed === undefined) {
    throw new Error(`Season ${year} has no seed data`);
  }
  return seed;
}
