/**
 * Engine performance, Engine supplier changes, Livery changes and In-season
 * development across an era: what each year is built from, what is recorded,
 * and that none of it reads as the reader's edit. No assertion reads an
 * authored rating; the cases that need a particular shape of history search
 * the seed data for one.
 */

import {
  authoredEngines,
  engineChanges,
  engineSpecOf,
  FIRST_AUTHORED_SEASON,
  seasonSeed,
} from "@alt-hist/data";
import { beforeEach, describe, expect, it } from "vitest";
import {
  HISTORICAL_SETTINGS,
  type RunSettings,
  rolledChassisOf,
  rolledEnginesOf,
  trendsOf,
} from "../lib/run-settings.js";
import { enteredSeason, PLAYABLE_SEASONS } from "../lib/seasons.js";
import {
  createWorld,
  ERA_RATING_MODE,
  eraStartOf,
  isUntouched,
  type Run,
  racedEngineRatings,
  useSeasonStore,
  type World,
} from "./season.js";

const YEAR = FIRST_AUTHORED_SEASON;

/** The era season being played, or a throw naming what was there instead. */
function running(): World {
  const current = useSeasonStore.getState().run;
  if (current?.kind !== "era" || current.cursor.kind === "review") {
    throw new Error(`expected an era season being played, found "${current?.kind ?? "no run"}"`);
  }
  return current.world;
}

/** The era's first `count` years under `settings`, by stepping, from `start`. */
function years(settings: RunSettings, count: number, start = YEAR): readonly World[] {
  useSeasonStore.getState().simulateEra(5, start, undefined, settings);
  for (let played = 1; played < count; played += 1) {
    useSeasonStore.getState().jumpTo({ year: running().year, beat: { kind: "summary" } });
    useSeasonStore.getState().continueRun();
    useSeasonStore.getState().continueRun();
  }
  const current = useSeasonStore.getState().run;
  if (current?.kind !== "era") {
    throw new Error("expected an era");
  }
  return [...current.run.seasons, current.world];
}

/** The engine each entrant of a world raced, by team. */
function enginesRaced(world: World): Map<string, string | undefined> {
  return new Map(world.field.map((entrant) => [entrant.teamId, entrant.engineId]));
}

beforeEach(() => {
  useSeasonStore.getState().exitRun();
});

describe("engine performance across an era", () => {
  const varied: RunSettings = {
    ...HISTORICAL_SETTINGS,
    enginePerformance: { kind: "varied", spread: 20, from: "real" },
  };
  const random: RunSettings = { ...HISTORICAL_SETTINGS, enginePerformance: { kind: "random" } };
  const walk: RunSettings = {
    ...HISTORICAL_SETTINGS,
    enginePerformance: { kind: "varied", spread: 20, from: "last" },
  };

  it("rolls every year's engines from its own seed, the same for every team running one", () => {
    for (const settings of [varied, random]) {
      for (const year of years(settings, 3)) {
        const rolled = rolledEnginesOf(seasonSeed(year.year), settings, year.seed);
        expect(rolled).not.toBeNull();
        expect(year.baselineEngineRatings, `${year.year}`).toEqual(rolled);
        for (const entrant of year.field) {
          expect(entrant.engine, `${year.year} ${entrant.teamId}`).toEqual(
            rolled?.[entrant.engineId ?? ""],
          );
        }
      }
    }
  });

  it("rolls nothing when the engines are historical", () => {
    for (const year of years(HISTORICAL_SETTINGS, 2)) {
      expect(year.baselineEngineRatings, `${year.year}`).toBeNull();
    }
  });

  it("leaves the chassis roll exactly as it is without it", () => {
    const chassis: RunSettings = {
      ...HISTORICAL_SETTINGS,
      carPerformance: { kind: "varied", spread: 10, from: "real" },
    };
    const [alone] = years(chassis, 1);
    const [both] = years({ ...chassis, enginePerformance: { kind: "random" } }, 1);
    expect(both?.baselineChassis).toEqual(alone?.baselineChassis);
    expect(both?.baselineChassis).toEqual(
      rolledChassisOf(seasonSeed(YEAR), chassis, both?.seed ?? 0),
    );
  });

  it("is the year's starting point, not an edit", () => {
    useSeasonStore.getState().simulateEra(5, YEAR, undefined, varied);
    const world = running();
    expect(world.engines).toBeNull();
    expect(isUntouched(useSeasonStore.getState().run as Run)).toBe(true);
    useSeasonStore.getState().setGrid(null, null);
    expect(running()).toEqual(world);
  });

  it("walks every later year off the engines the year before raced", () => {
    const run = years(walk, 3);
    expect(run[0]?.engineWalkedFrom).toBeNull();
    for (const [index, year] of run.entries()) {
      const before = run[index - 1];
      if (before === undefined) {
        continue;
      }
      expect(year.engineWalkedFrom, `${year.year}`).toEqual(racedEngineRatings(before));
      expect(year.baselineEngineRatings, `${year.year}`).toEqual(
        rolledEnginesOf(seasonSeed(year.year), walk, year.seed, racedEngineRatings(before)),
      );
    }
  });

  it("records no year before when the engines do not walk", () => {
    for (const year of years(varied, 2)) {
      expect(year.engineWalkedFrom, `${year.year}`).toBeNull();
    }
  });

  it("reaches the same third year by jumping as by stepping", () => {
    const stepped = years(walk, 3).at(-1);
    useSeasonStore.getState().simulateEra(5, YEAR, undefined, walk);
    useSeasonStore.getState().jumpTo({ year: stepped?.year ?? YEAR, beat: { kind: "grid" } });
    expect(running()).toEqual(stepped);
  });
});

/**
 * Each team's engine in its first season at or after `start`, up to `year`:
 * what *Engine supplier changes: No* should give it in `year`.
 */
function firstEngines(start: number, year: number): Map<string, string> {
  const first = new Map<string, string>();
  for (let each = start; each <= year; each++) {
    for (const entry of seasonSeed(each).entries) {
      if (!first.has(entry.teamId)) {
        first.set(entry.teamId, entry.engineId);
      }
    }
  }
  return first;
}

/** A world for `year` of an era from `start` under kept suppliers, built directly. */
function keptSupplierYear(start: number, year: number): World {
  return createWorld(
    5,
    year,
    ERA_RATING_MODE,
    null,
    null,
    undefined,
    null,
    null,
    { ...HISTORICAL_SETTINGS, engineSuppliers: "first" },
    { start },
  );
}

describe("engine suppliers kept for an era", () => {
  const kept: RunSettings = { ...HISTORICAL_SETTINGS, engineSuppliers: "first" };

  it("runs every team on the engine of its first season in the run, every year", () => {
    for (const year of years(kept, 3)) {
      expect(year.enginesKeptFrom, `${year.year}`).toBe(YEAR);
      const first = firstEngines(YEAR, year.year);
      for (const [teamId, engineId] of enginesRaced(year)) {
        expect(engineId, `${year.year} ${teamId}`).toBe(first.get(teamId));
      }
    }
  });

  it("is the year's starting point, not an edit", () => {
    // A year where keeping the suppliers changes someone's engine, searched
    // for — otherwise the kept season and history are one and this proves nothing.
    const found = (() => {
      for (const start of PLAYABLE_SEASONS) {
        for (const year of PLAYABLE_SEASONS.filter((y) => y > start && y <= start + 8)) {
          const first = firstEngines(start, year);
          if (
            seasonSeed(year).entries.some((entry) => first.get(entry.teamId) !== entry.engineId)
          ) {
            return { start, year };
          }
        }
      }
      return undefined;
    })();
    expect(found).toBeDefined();
    const world = keptSupplierYear(found?.start ?? YEAR, found?.year ?? YEAR);
    expect(world.engines).toBeNull();
    const entered = enteredSeason(world);
    // The season the grid measures edits from has the engines that raced…
    for (const [teamId, engineId] of enginesRaced(world)) {
      expect(entered.entries.find((entry) => entry.teamId === teamId)?.engineId, teamId).toBe(
        engineId,
      );
    }
    // …where history's supply would differ from them.
    const history = authoredEngines(seasonSeed(world.year));
    expect(engineChanges(entered, history).length).toBeGreaterThan(0);
  });

  it("records nothing when suppliers change as they did", () => {
    for (const year of years(HISTORICAL_SETTINGS, 2)) {
      expect(year.enginesKeptFrom, `${year.year}`).toBeNull();
    }
  });

  it("races an engine the year no longer rates at its latest authored values", () => {
    // A start year and a later one where some team's first engine is off the
    // later year's menu — searched for, so re-authoring moves the case.
    const found = (() => {
      for (const start of PLAYABLE_SEASONS) {
        for (const year of PLAYABLE_SEASONS.filter((y) => y > start && y <= start + 8)) {
          const first = firstEngines(start, year);
          const season = seasonSeed(year);
          const entry = season.entries.find((each) => {
            const engineId = first.get(each.teamId);
            return engineId !== undefined && engineSpecOf(season, engineId) === undefined;
          });
          if (entry !== undefined) {
            return { start, year, teamId: entry.teamId, engineId: first.get(entry.teamId) ?? "" };
          }
        }
      }
      return undefined;
    })();
    expect(found).toBeDefined();
    if (found === undefined) {
      return;
    }
    const world = keptSupplierYear(found.start, found.year);
    const latest = (() => {
      for (let each = found.year - 1; each >= found.start; each--) {
        const spec = engineSpecOf(seasonSeed(each), found.engineId);
        if (spec !== undefined) {
          return spec;
        }
      }
      return undefined;
    })();
    const entrant = world.field.find((each) => each.teamId === found.teamId);
    expect(entrant?.engineId).toBe(found.engineId);
    expect(entrant?.engine).toEqual({
      racing: latest?.racing,
      qualifying: latest?.qualifying,
      reliability: latest?.reliability,
    });
  });

  it("keeps a team that arrives later on the engine of its own first year", () => {
    // A team absent from the start year that arrives on one engine and later
    // changes it, searched for.
    const found = (() => {
      for (const start of PLAYABLE_SEASONS) {
        const opening = new Set(seasonSeed(start).entries.map((entry) => entry.teamId));
        for (const year of PLAYABLE_SEASONS.filter((y) => y > start && y <= start + 8)) {
          const first = firstEngines(start, year);
          const entry = seasonSeed(year).entries.find(
            (each) => !opening.has(each.teamId) && first.get(each.teamId) !== each.engineId,
          );
          if (entry !== undefined) {
            return { start, year, teamId: entry.teamId, engineId: first.get(entry.teamId) };
          }
        }
      }
      return undefined;
    })();
    expect(found).toBeDefined();
    if (found === undefined) {
      return;
    }
    const entrant = keptSupplierYear(found.start, found.year).field.find(
      (each) => each.teamId === found.teamId,
    );
    expect(entrant?.engineId).toBe(found.engineId);
  });

  it("reaches the same third year by jumping as by stepping", () => {
    const stepped = years(kept, 3).at(-1);
    useSeasonStore.getState().simulateEra(5, YEAR, undefined, kept);
    useSeasonStore.getState().jumpTo({ year: stepped?.year ?? YEAR, beat: { kind: "grid" } });
    expect(running()).toEqual(stepped);
  });
});

describe("liveries kept for an era", () => {
  const kept: RunSettings = { ...HISTORICAL_SETTINGS, liveries: "first" };

  it("records the era's first year on every year of it, and nothing otherwise", () => {
    for (const year of years(kept, 2)) {
      expect(year.liveriesKeptFrom, `${year.year}`).toBe(YEAR);
      expect(eraStartOf(year)).toBe(YEAR);
    }
    for (const year of years(HISTORICAL_SETTINGS, 2)) {
      expect(year.liveriesKeptFrom, `${year.year}`).toBeNull();
    }
  });

  it("changes nothing that is raced", () => {
    const [historical] = years(HISTORICAL_SETTINGS, 1);
    const [painted] = years(kept, 1);
    expect(painted?.field).toEqual(historical?.field);
    expect(painted?.season).toEqual(historical?.season);
  });
});

describe("in-season development across an era", () => {
  const random: RunSettings = { ...HISTORICAL_SETTINGS, development: "random" };
  const off: RunSettings = { ...HISTORICAL_SETTINGS, development: "none" };

  it("flattens every car under Off", () => {
    for (const year of years(off, 2)) {
      for (const entrant of year.field) {
        expect(entrant.developmentTrend, `${year.year} ${entrant.teamId}`).toBeUndefined();
      }
    }
  });

  it("draws every year's trends from its own seed under Random", () => {
    for (const year of years(random, 3)) {
      const trends = trendsOf(seasonSeed(year.year), random, year.seed);
      expect(year.baselineTrends, `${year.year}`).toEqual(trends);
      for (const entrant of year.field) {
        expect(entrant.developmentTrend ?? 0, `${year.year} ${entrant.teamId}`).toBe(
          trends?.[entrant.teamId],
        );
      }
    }
  });

  it("is the year's starting point, not an edit, and moves no other roll", () => {
    const chassis: RunSettings = {
      ...HISTORICAL_SETTINGS,
      carPerformance: { kind: "random" },
    };
    const [alone] = years(chassis, 1);
    useSeasonStore
      .getState()
      .simulateEra(5, YEAR, undefined, { ...chassis, development: "random" });
    expect(isUntouched(useSeasonStore.getState().run as Run)).toBe(true);
    expect(running().baselineChassis).toEqual(alone?.baselineChassis);
  });

  it("reaches the same third year by jumping as by stepping", () => {
    const stepped = years(random, 3).at(-1);
    useSeasonStore.getState().simulateEra(5, YEAR, undefined, random);
    useSeasonStore.getState().jumpTo({ year: stepped?.year ?? YEAR, beat: { kind: "grid" } });
    expect(running()).toEqual(stepped);
  });
});
