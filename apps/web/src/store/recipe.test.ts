/**
 * The recipe: a run rebuilt from the inputs its worlds record.
 *
 * Every assertion is a rule about the round trip — the same run back, or none
 * at all — and none reads what a seed produced. The runs are built through the
 * store's own actions, so they have the shapes a reader can reach: an edited
 * grid, a restart mid-era, a kept rule.
 */

import {
  authoredChassis,
  authoredEngines,
  authoredLineup,
  DEFAULT_DRIVER_FILTERS,
  FIRST_AUTHORED_SEASON,
  type GridArrangement,
  reserveDrivers,
  seasonSeed,
  stepChassis,
  swapDrivers,
} from "@alt-hist/data";
import { beforeEach, describe, expect, it } from "vitest";
import {
  HISTORICAL_SETTINGS,
  OPENING_SEAT_RULES,
  pointsTables,
  samePoints,
} from "../lib/run-settings.js";
import { FIRST_SEASON, nextEraYear, PLAYABLE_SEASONS } from "../lib/seasons.js";
import { nextSeed } from "../lib/seed.js";
import { FOLDING_YEAR } from "../test-support.js";
import { fingerprint, RECIPE_VERSION, recipeOf, runFromRecipe } from "./recipe.js";
import { createWorld, type Run, useSeasonStore } from "./season.js";

const YEAR = FIRST_AUTHORED_SEASON;
const SEED = seasonSeed(YEAR);

/** The run in the store, or a throw. */
function current(): Run {
  const run = useSeasonStore.getState().run;
  if (run === null) {
    throw new Error("expected a run");
  }
  return run;
}

/** The recipe as storage would hand it back: through JSON, untyped. */
function stored(run: Run): Record<string, unknown> & { worlds: Record<string, unknown>[] } {
  return JSON.parse(JSON.stringify(recipeOf(run)));
}

function roundTrip(run: Run): Run | null {
  return runFromRecipe(stored(run));
}

/** On to the end of `year`, then its review. */
function crown(year: number): void {
  useSeasonStore.getState().jumpTo({ year, beat: { kind: "summary" } });
  useSeasonStore.getState().continueRun();
}

const kept: GridArrangement = {
  kind: "fastest-in-fastest",
  includeUnemployed: false,
  filters: DEFAULT_DRIVER_FILTERS,
  retain: true,
};

beforeEach(() => {
  useSeasonStore.setState({ run: null });
});

describe("a run rebuilt from its recipe", () => {
  it("is the same season, freshly started", () => {
    useSeasonStore.getState().simulate(3, YEAR);
    expect(roundTrip(current())).toEqual(current());
  });

  it("keeps a re-rated chassis", () => {
    const team = SEED.entries[0]?.teamId ?? "";
    useSeasonStore.getState().simulate(3, YEAR);
    useSeasonStore
      .getState()
      .setGrid(null, null, null, stepChassis(authoredChassis(SEED), team, -1));
    const run = current();
    expect(run.world.chassis, "the chassis was re-rated").not.toBeNull();
    expect(roundTrip(run)).toEqual(run);
  });

  it("keeps an edited grid, engines and all, part-way through the season", () => {
    const authored = authoredLineup(SEED);
    const seated = SEED.entries[0]?.drivers[0] ?? "";
    const reserve = reserveDrivers(authored)[0]?.id ?? "";
    const engines = authoredEngines(SEED);
    const [first, other] = [SEED.entries[0]?.teamId ?? "", SEED.entries.at(-1)?.teamId ?? ""];
    useSeasonStore.getState().simulate(3, YEAR, "aged", 4);
    useSeasonStore.getState().setGrid(swapDrivers(authored, seated, reserve), {
      ...engines,
      [first]: engines[other] ?? "",
    });
    useSeasonStore.getState().continueRun();
    useSeasonStore.getState().continueRun();
    useSeasonStore.getState().continueRun();

    const run = current();
    expect(run.world.lineup, "the grid was edited").not.toBeNull();
    expect(run.cursor.kind).toBe("qualifying");
    expect(roundTrip(run)).toEqual(run);
  });

  it("keeps an era's every year, a mid-era restart and a kept rule included", () => {
    useSeasonStore.getState().simulateEra(5, YEAR);
    useSeasonStore.getState().setGrid(null, null, kept);
    crown(YEAR);
    useSeasonStore.getState().continueRun();
    useSeasonStore.getState().continueRun();
    // A fresh seed for the second year, which nothing in the first could derive.
    useSeasonStore.getState().restartSeason();
    const second = current().world;
    crown(second.year);
    useSeasonStore.getState().continueRun();
    useSeasonStore.getState().continueRun();

    const run = current();
    if (run.kind !== "era") {
      throw new Error("expected an era");
    }
    const [firstWorld] = run.run.seasons;
    expect(run.run.seasons).toHaveLength(2);
    expect(second.seed).not.toBe(nextSeed(firstWorld?.rngState ?? []));
    expect(run.world.arrangement).toEqual(kept);
    expect(roundTrip(run)).toEqual(run);
  });

  it("keeps the run settings chosen for the whole era", () => {
    const other =
      pointsTables().find((table) => !samePoints(table.scale, SEED.points))?.scale ?? [];
    useSeasonStore.getState().simulateEra(9, YEAR, undefined, {
      carPerformance: { kind: "varied", spread: 10, from: "real" },
      breakdowns: "fewer",
      reliability: PLAYABLE_SEASONS.at(-1) ?? null,
      points: other,
      careerEvents: "none",
      teamNames: "first",
      teamsAndSeats: OPENING_SEAT_RULES,
    });
    crown(YEAR);
    useSeasonStore.getState().continueRun();
    const run = current();
    expect(run.world.namesKeptFrom).toBe(YEAR);
    expect(run.world.baselineChassis).not.toBeNull();
    expect(roundTrip(run)).toEqual(run);
  });

  it("keeps an era walking from previous year's car, through a chassis edit and a restart", () => {
    useSeasonStore.getState().simulateEra(9, YEAR, undefined, {
      ...HISTORICAL_SETTINGS,
      carPerformance: { kind: "varied", spread: 20, from: "last" },
    });
    // An edit the next year walks off, then a restart the year after keeps.
    const first = current().world;
    const team = SEED.entries[0]?.teamId ?? "";
    const base = first.baselineChassis ?? {};
    const lower = stepChassis(base, team, -1);
    useSeasonStore
      .getState()
      .setGrid(null, null, null, lower === base ? stepChassis(base, team, 1) : lower);
    crown(YEAR);
    useSeasonStore.getState().continueRun();
    useSeasonStore.getState().restartSeason();
    const run = current();
    expect(run.world.walkedFrom).not.toBeNull();
    expect(roundTrip(run)).toEqual(run);
  });

  it("keeps a season on rolled cars", () => {
    useSeasonStore.getState().simulate(3, YEAR, "peak", undefined, {
      ...HISTORICAL_SETTINGS,
      carPerformance: { kind: "random" },
    });
    const run = current();
    expect(run.world.baselineChassis).not.toBeNull();
    expect(roundTrip(run)).toEqual(run);
  });

  it("keeps an era on its review", () => {
    useSeasonStore.getState().simulateEra(5, YEAR);
    crown(YEAR);
    expect(current().cursor.kind).toBe("review");
    expect(roundTrip(current())).toEqual(current());
  });
});

describe("an era that keeps its starting grid", () => {
  const keep = { ...HISTORICAL_SETTINGS, teamsAndSeats: OPENING_SEAT_RULES };

  it("rebuilds a year with a ghost entry in it", () => {
    useSeasonStore.getState().simulateEra(9, FOLDING_YEAR.year, undefined, keep);
    useSeasonStore.getState().jumpTo({ year: FOLDING_YEAR.year + 1, beat: { kind: "grid" } });
    expect(current().world.kept?.ghosts).toHaveProperty(FOLDING_YEAR.teamId);
    expect(roundTrip(current())).toEqual(current());
  });

  it("refuses rules this build would not offer", () => {
    useSeasonStore.getState().simulateEra(9, FOLDING_YEAR.year, undefined, keep);
    const recipe = stored(current());
    recipe.worlds[0] = {
      ...recipe.worlds[0],
      settings: { ...keep, teamsAndSeats: { ...OPENING_SEAT_RULES, maxAge: 99 } },
    };
    expect(runFromRecipe(recipe)).toBeNull();
  });
});

describe("a recipe that is refused", () => {
  /** An era three years in, its recipe as storage would return it. */
  function threeYears() {
    useSeasonStore.getState().simulateEra(5, YEAR);
    crown(YEAR);
    useSeasonStore.getState().continueRun();
    crown(YEAR + 1);
    useSeasonStore.getState().continueRun();
    return stored(current());
  }

  function season() {
    useSeasonStore.getState().simulate(3, YEAR);
    return stored(current());
  }

  it("has a world whose check does not match", () => {
    const recipe = season();
    recipe.worlds[0] = { ...recipe.worlds[0], check: "not a hash" };
    expect(runFromRecipe(recipe)).toBeNull();
  });

  it("would build a different world from the one it was saved with", () => {
    // What a retuned build looks like from here: the same inputs, another world.
    const recipe = season();
    const world = recipe.worlds[0] ?? {};
    recipe.worlds[0] = { ...world, seed: (world.seed as number) + 1 };
    expect(runFromRecipe(recipe)).toBeNull();
  });

  it("names a year with no seed data", () => {
    const recipe = season();
    recipe.worlds[0] = { ...recipe.worlds[0], year: FIRST_SEASON - 1 };
    expect(runFromRecipe(recipe)).toBeNull();
  });

  it("skips a year of an era", () => {
    const recipe = threeYears();
    const [first, , third] = recipe.worlds;
    expect(nextEraYear(YEAR + 1)).toBe(third?.year);
    expect(runFromRecipe({ ...recipe, worlds: [first, third] })).toBeNull();
  });

  it("is a season run of more than one world", () => {
    const recipe = threeYears();
    expect(runFromRecipe({ ...recipe, kind: "season", cursor: { kind: "grid" } })).toBeNull();
  });

  it("puts a season run on an era's review", () => {
    expect(runFromRecipe({ ...season(), cursor: { kind: "review" } })).toBeNull();
  });

  it("puts the cursor past the last race", () => {
    const rounds = createWorld(3, YEAR).season.races.length;
    expect(runFromRecipe({ ...season(), cursor: { kind: "race", round: rounds } })).toBeNull();
  });

  it("is another version of the recipe", () => {
    expect(runFromRecipe({ ...season(), version: RECIPE_VERSION + 1 })).toBeNull();
  });

  it("is not a recipe at all, without throwing", () => {
    const recipe = season();
    const junk: unknown[] = [
      null,
      undefined,
      "x",
      3,
      [],
      {},
      { version: RECIPE_VERSION },
      { ...recipe, kind: "game" },
      { ...recipe, worlds: "none" },
      { ...recipe, worlds: [] },
      { ...recipe, worlds: [{}] },
      { ...recipe, worlds: [{ ...recipe.worlds[0], lineup: "everyone" }] },
      { ...recipe, worlds: [{ ...recipe.worlds[0], randomness: 99 }] },
      { ...recipe, worlds: [{ ...recipe.worlds[0], ratingMode: "young" }] },
      { ...recipe, worlds: [{ ...recipe.worlds[0], settings: undefined }] },
      { ...recipe, worlds: [{ ...recipe.worlds[0], settings: "historical" }] },
      { ...recipe, worlds: [{ ...recipe.worlds[0], settings: { points: [100, 1] } }] },
      // A Varied spread the setup screen never offered.
      {
        ...recipe,
        worlds: [
          {
            ...recipe.worlds[0],
            settings: {
              ...HISTORICAL_SETTINGS,
              carPerformance: { kind: "varied", spread: 7, from: "real" },
            },
          },
        ],
      },
      { ...recipe, worlds: [{ ...recipe.worlds[0], namesKeptFrom: undefined }] },
      { ...recipe, worlds: [{ ...recipe.worlds[0], namesKeptFrom: "first" }] },
      { ...recipe, worlds: [{ ...recipe.worlds[0], namesKeptFrom: FIRST_SEASON - 1 }] },
      // Settings from before Career events.
      {
        ...recipe,
        worlds: [
          {
            ...recipe.worlds[0],
            settings: { breakdowns: null, reliability: null, points: null },
          },
        ],
      },
      { ...recipe, cursor: { kind: "race", round: -1 } },
      { ...recipe, cursor: { kind: "lap" } },
      // A grid that names nobody real reaches the simulation, which must not take
      // the app down with it.
      {
        ...recipe,
        worlds: [{ ...recipe.worlds[0], lineup: { [SEED.entries[0]?.teamId ?? ""]: ["nobody"] } }],
      },
    ];
    for (const raw of junk) {
      expect(() => runFromRecipe(raw), JSON.stringify(raw)).not.toThrow();
      expect(runFromRecipe(raw), JSON.stringify(raw)).toBeNull();
    }
  });
});

describe("the fingerprint", () => {
  it("is the same for the same world, however it was arrived at", () => {
    const world = createWorld(3, YEAR);
    expect(fingerprint(createWorld(3, YEAR))).toBe(fingerprint(world));
    expect(fingerprint(JSON.parse(JSON.stringify(world)))).toBe(fingerprint(world));
  });

  it("tells two different worlds apart", () => {
    expect(fingerprint(createWorld(4, YEAR))).not.toBe(fingerprint(createWorld(3, YEAR)));
  });
});
