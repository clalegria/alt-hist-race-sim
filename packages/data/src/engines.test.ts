import { createRng, type EngineSpec, powertrain } from "@alt-hist/engine";
import { describe, expect, it } from "vitest";
import { buildField } from "./buildField.js";
import { CHASSIS_STEP_RANGE, pulled } from "./chassis.js";
import {
  applyEngineRatings,
  applyEngines,
  authoredEngineRatings,
  authoredEngines,
  availableEngines,
  canStepEngine,
  ENGINE_KEYS,
  engineChanges,
  engineRatingChanges,
  engineSpecOf,
  isAuthoredEngineRatings,
  isAuthoredEngines,
  randomEngines,
  type SeasonEngineRatings,
  stepEngine,
  variedEngines,
  withFirstEngines,
} from "./engines.js";
import { engines, FIRST_AUTHORED_SEASON, seasonSeed, seasons } from "./index.js";
import type { SeasonEngine, SeasonEntry, SeasonSeed } from "./types.js";

/** One authored season, as a fixture. Which one is not the point. */
const SEED = seasonSeed(FIRST_AUTHORED_SEASON);

/**
 * A season with a choice in it, found rather than named.
 *
 * Every test below that swaps one engine for another needs two to swap between,
 * and which years have how many suppliers is authored data that will keep
 * moving as seasons are added.
 */
function seasonWithAChoice(): SeasonSeed {
  const found = [...seasons.values()].find((season) => season.engines.length >= 2);
  if (found === undefined) {
    throw new Error("no authored season rates two engines");
  }
  return found;
}

/**
 * A team in that season, and a *different* engine it could run.
 *
 * "Different" means the ratings differ, not just the id: a test that swapped one
 * engine for another rated identically would assert nothing, and which engines
 * are rated what is authored data that keeps moving.
 */
function alternative(season: SeasonSeed): { teamId: string; from: string; to: string } {
  for (const entry of season.entries) {
    const current = season.engines.find((engine) => engine.engineId === entry.engineId);
    const other = season.engines.find(
      (engine) =>
        engine.engineId !== entry.engineId &&
        (engine.racing !== current?.racing ||
          engine.qualifying !== current?.qualifying ||
          engine.reliability !== current?.reliability),
    );
    if (other !== undefined) {
      return { teamId: entry.teamId, from: entry.engineId, to: other.engineId };
    }
  }
  throw new Error("no entry in the season has a differently rated engine available");
}

describe("authoredEngines", () => {
  it("names every team in the season, and only those", () => {
    const authored = authoredEngines(SEED);
    expect(Object.keys(authored).sort()).toEqual(SEED.entries.map((e) => e.teamId).sort());
  });

  it("gives each team the engine the season entered it with", () => {
    const authored = authoredEngines(SEED);
    for (const entry of SEED.entries) {
      expect(authored[entry.teamId], entry.teamId).toBe(entry.engineId);
    }
  });

  it("is recognised as the authored supply", () => {
    expect(isAuthoredEngines(SEED, authoredEngines(SEED))).toBe(true);
  });
});

describe("availableEngines", () => {
  it("offers exactly the engines the season rates", () => {
    for (const season of seasons.values()) {
      expect(
        availableEngines(season)
          .map((engine) => engine.engineId)
          .sort(),
        `${season.year}`,
      ).toEqual(season.engines.map((engine) => engine.engineId).sort());
    }
  });

  it("orders them by the manufacturer pool, so the list is stable across seasons", () => {
    const order = engines.map((maker) => maker.id);
    for (const season of seasons.values()) {
      const offered = availableEngines(season).map((engine) => engine.engineId);
      const positions = offered.map((id) => order.indexOf(id));
      expect(positions, `${season.year}`).toEqual([...positions].sort((a, b) => a - b));
    }
  });

  it("includes an engine nobody entered — the list is a menu, not a record", () => {
    const season = seasonWithAChoice();
    const spare = season.engines[0];
    if (spare === undefined) {
      throw new Error("expected a rated engine");
    }
    const unused: SeasonSeed = {
      ...season,
      entries: season.entries.map((entry) => ({
        ...entry,
        engineId: season.engines[1]?.engineId ?? entry.engineId,
      })),
    };
    expect(availableEngines(unused).map((engine) => engine.engineId)).toContain(spare.engineId);
  });
});

describe("engineSpecOf", () => {
  it("finds a rated engine and misses an unrated one", () => {
    const first = SEED.engines[0];
    if (first === undefined) {
      throw new Error("expected a rated engine");
    }
    expect(engineSpecOf(SEED, first.engineId)).toBe(first);
    expect(engineSpecOf(SEED, "phlogiston")).toBeUndefined();
  });
});

describe("applyEngines", () => {
  it("re-supplies a team without touching the rest of the season", () => {
    const season = seasonWithAChoice();
    const swap = alternative(season);
    const changed = applyEngines(season, { ...authoredEngines(season), [swap.teamId]: swap.to });

    expect(changed.entries.find((entry) => entry.teamId === swap.teamId)?.engineId).toBe(swap.to);
    expect(changed.calendar).toBe(season.calendar);
    expect(changed.entries).toHaveLength(season.entries.length);
    for (const entry of changed.entries) {
      const before = season.entries.find((candidate) => candidate.teamId === entry.teamId);
      expect(entry.chassis, entry.teamId).toEqual(before?.chassis);
      expect(entry.drivers, entry.teamId).toEqual(before?.drivers);
    }
  });

  it("is no longer the authored supply once a team has been moved", () => {
    const season = seasonWithAChoice();
    const swap = alternative(season);
    const moved = { ...authoredEngines(season), [swap.teamId]: swap.to };
    expect(isAuthoredEngines(season, moved)).toBe(false);
  });

  it("refuses an engine the season does not rate", () => {
    expect(() =>
      applyEngines(SEED, {
        ...authoredEngines(SEED),
        [SEED.entries[0]?.teamId ?? ""]: "phlogiston",
      }),
    ).toThrow(/no engine "phlogiston"/);
  });

  it("refuses a team the season does not enter", () => {
    expect(() => applyEngines(SEED, { ...authoredEngines(SEED), phantom: "ford" })).toThrow(
      /does not enter/,
    );
  });

  it("refuses a supply with a team missing", () => {
    const partial = { ...authoredEngines(SEED) };
    delete partial[SEED.entries[0]?.teamId ?? ""];
    expect(() => applyEngines(SEED, partial)).toThrow(/missing a supplier/);
  });
});

describe("engineChanges", () => {
  it("reports nothing for the authored supply", () => {
    expect(engineChanges(SEED, authoredEngines(SEED))).toEqual([]);
  });

  it("reports both halves of a change of supplier", () => {
    const season = seasonWithAChoice();
    const swap = alternative(season);
    const changes = engineChanges(season, { ...authoredEngines(season), [swap.teamId]: swap.to });
    expect(changes).toEqual([{ teamId: swap.teamId, from: swap.from, to: swap.to }]);
  });
});

describe("buildField and engines", () => {
  it("stamps every entrant with its team's engine and that engine's ratings", () => {
    const field = buildField(SEED);
    for (const entrant of field) {
      const entry = SEED.entries.find((candidate) => candidate.teamId === entrant.teamId);
      expect(entrant.engineId, entrant.driverId).toBe(entry?.engineId);
      const rated = SEED.engines.find((engine) => engine.engineId === entrant.engineId);
      expect(entrant.engine, entrant.driverId).toEqual({
        racing: rated?.racing,
        qualifying: rated?.qualifying,
        reliability: rated?.reliability,
      });
    }
  });

  it("stamps where each engine was built, for the home-advantage term", () => {
    const bases = new Map(engines.map((maker) => [maker.id, maker.base]));
    const field = buildField(SEED);
    for (const entrant of field) {
      expect(entrant.engineCountry, entrant.driverId).toBe(bases.get(entrant.engineId ?? ""));
    }
    // Not vacuous: the pool has to actually carry a base for these to mean
    // anything, and an entrant that never races at home would look identical.
    expect(field.every((entrant) => /^[A-Z]{2}$/.test(entrant.engineCountry ?? ""))).toBe(true);
  });

  it("moves the engine's country with the engine when a team is re-supplied", () => {
    const season = seasonWithAChoice();
    const bases = new Map(engines.map((maker) => [maker.id, maker.base]));
    // An alternative built somewhere else, so the country has somewhere to move
    // to — a swap between two engines from the same country proves nothing.
    const abroad = (() => {
      for (const entry of season.entries) {
        const other = season.engines.find(
          (engine) =>
            engine.engineId !== entry.engineId &&
            bases.get(engine.engineId) !== bases.get(entry.engineId),
        );
        if (other !== undefined) {
          return { teamId: entry.teamId, to: other.engineId };
        }
      }
      throw new Error("every engine in the season is built in the same country");
    })();

    const changed = applyEngines(season, {
      ...authoredEngines(season),
      [abroad.teamId]: abroad.to,
    });
    const after = buildField(changed).find((entrant) => entrant.teamId === abroad.teamId);
    expect(after?.engineCountry).toBe(bases.get(abroad.to));
  });

  it("carries a re-supplied engine through to the field it builds", () => {
    const season = seasonWithAChoice();
    const swap = alternative(season);
    const changed = applyEngines(season, { ...authoredEngines(season), [swap.teamId]: swap.to });
    const before = buildField(season).find((entrant) => entrant.teamId === swap.teamId);
    const after = buildField(changed).find((entrant) => entrant.teamId === swap.teamId);

    expect(after?.engineId).toBe(swap.to);
    // Same chassis, different unit: the car that gets raced is not the same car.
    expect(after?.chassis).toEqual(before?.chassis);
    if (before === undefined || after === undefined) {
      throw new Error("expected the team to hold a seat");
    }
    expect(powertrain(after.chassis, after.engine)).not.toEqual(
      powertrain(before.chassis, before.engine),
    );
  });
});

/**
 * A synthetic season: the first authored one's calendar and points, with its
 * own engines and entries, so the rolls and the kept supply are asserted as
 * rules and never against an authored rating.
 */
function synthetic(
  year: number,
  engineList: readonly SeasonEngine[],
  entries: readonly (readonly [teamId: string, engineId: string])[],
): SeasonSeed {
  return {
    ...SEED,
    year,
    engines: engineList,
    entries: entries.map(
      ([teamId, engineId]): SeasonEntry => ({
        teamId,
        engineId,
        chassis: { racing: 60, qualifying: 60, consistency: 60, reliability: 60 },
        drivers: [],
      }),
    ),
  };
}

/** The first engine sits on the top of the scale for racing and the bottom for reliability. */
const EDGE_ENGINE: SeasonEngine = {
  engineId: "edge",
  racing: CHASSIS_STEP_RANGE.max,
  qualifying: 50,
  reliability: CHASSIS_STEP_RANGE.min,
};
const MID_ENGINE: SeasonEngine = { engineId: "mid", racing: 60, qualifying: 60, reliability: 60 };
const LOW_ENGINE: SeasonEngine = { engineId: "low", racing: 40, qualifying: 30, reliability: 70 };
const ROLLED = synthetic(
  2000,
  [EDGE_ENGINE, MID_ENGINE, LOW_ENGINE],
  [
    ["a", "edge"],
    ["b", "mid"],
    ["c", "mid"],
    ["d", "low"],
  ],
);

describe("authoredEngineRatings and applyEngineRatings", () => {
  it("names every engine on the menu, and applies to the season unchanged", () => {
    const authored = authoredEngineRatings(ROLLED);
    expect(Object.keys(authored)).toEqual(ROLLED.engines.map((engine) => engine.engineId));
    expect(applyEngineRatings(ROLLED, authored)).toEqual(ROLLED);
  });

  it("refuses an engine the season has no rating for, a missing one, or a rating off the scale", () => {
    const authored = authoredEngineRatings(ROLLED);
    expect(() => applyEngineRatings(ROLLED, { ...authored, nope: MID_ENGINE })).toThrow(/nope/);
    const { mid: _dropped, ...missing } = authored;
    expect(() => applyEngineRatings(ROLLED, missing)).toThrow(/mid/);
    expect(() =>
      applyEngineRatings(ROLLED, { ...authored, mid: { ...MID_ENGINE, racing: 101 } }),
    ).toThrow(/racing/);
  });
});

describe("stepEngine", () => {
  const spec = ({ racing, qualifying, reliability }: SeasonEngine): EngineSpec => ({
    racing,
    qualifying,
    reliability,
  });

  it("moves all three ratings by one when no rating is named", () => {
    const next = stepEngine(authoredEngineRatings(ROLLED), "mid", 1);
    expect(next.mid).toEqual({
      racing: MID_ENGINE.racing + 1,
      qualifying: MID_ENGINE.qualifying + 1,
      reliability: MID_ENGINE.reliability + 1,
    });
  });

  it("moves only the named rating, and leaves every other engine alone", () => {
    const authored = authoredEngineRatings(ROLLED);
    const next = stepEngine(authored, "mid", -1, "qualifying");
    expect(next.mid).toEqual({ ...spec(MID_ENGINE), qualifying: MID_ENGINE.qualifying - 1 });
    expect(next.edge).toBe(authored.edge);
    expect(next.low).toBe(authored.low);
  });

  it("moves every team running the engine", () => {
    const next = stepEngine(authoredEngineRatings(ROLLED), "mid", 1);
    const field = buildField(applyEngineRatings(ROLLED, next));
    const customers = ROLLED.entries.filter((entry) => entry.engineId === "mid");
    expect(customers.length).toBeGreaterThan(1);
    for (const entry of customers) {
      for (const entrant of field.filter((e) => e.teamId === entry.teamId)) {
        expect(entrant.engine).toEqual(next.mid);
      }
    }
  });

  it("holds each rating inside the scale on its own", () => {
    const up = stepEngine(authoredEngineRatings(ROLLED), "edge", 1);
    expect(up.edge).toEqual({
      racing: CHASSIS_STEP_RANGE.max,
      qualifying: EDGE_ENGINE.qualifying + 1,
      reliability: EDGE_ENGINE.reliability + 1,
    });
  });

  it("hands back the same ratings when nothing could move", () => {
    const authored = authoredEngineRatings(ROLLED);
    expect(stepEngine(authored, "edge", 1, "racing")).toBe(authored);
    expect(stepEngine(authored, "edge", -1, "reliability")).toBe(authored);
    expect(stepEngine(authored, "no-such-engine", 1)).toBe(authored);
  });

  it("returns to the season's ratings when undone, and lists only what moved", () => {
    const authored = authoredEngineRatings(ROLLED);
    expect(isAuthoredEngineRatings(ROLLED, authored)).toBe(true);
    expect(engineRatingChanges(ROLLED, authored)).toEqual([]);
    const moved = stepEngine(authored, "low", 1, "racing");
    expect(isAuthoredEngineRatings(ROLLED, moved)).toBe(false);
    expect(engineRatingChanges(ROLLED, moved)).toEqual([
      { engineId: "low", from: spec(LOW_ENGINE), to: { ...spec(LOW_ENGINE), racing: 41 } },
    ]);
    expect(isAuthoredEngineRatings(ROLLED, stepEngine(moved, "low", -1, "racing"))).toBe(true);
  });

  it("says whether a step that way could move anything", () => {
    expect(canStepEngine(EDGE_ENGINE, 1, "racing")).toBe(false);
    expect(canStepEngine(EDGE_ENGINE, -1, "reliability")).toBe(false);
    expect(canStepEngine(EDGE_ENGINE, 1)).toBe(true);
    const top: EngineSpec = {
      racing: CHASSIS_STEP_RANGE.max,
      qualifying: CHASSIS_STEP_RANGE.max,
      reliability: CHASSIS_STEP_RANGE.max,
    };
    expect(canStepEngine(top, 1)).toBe(false);
    expect(canStepEngine(top, -1)).toBe(true);
  });
});

describe("variedEngines", () => {
  const SPREAD = 10;
  const averageOf = (key: keyof EngineSpec): number =>
    ROLLED.engines.reduce((sum, engine) => sum + engine[key], 0) / ROLLED.engines.length;

  it("moves each engine's three ratings by one offset within the spread, clamped", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const rolled = variedEngines(ROLLED, SPREAD, createRng(seed));
      expect(Object.keys(rolled)).toEqual(ROLLED.engines.map((engine) => engine.engineId));
      for (const engine of ROLLED.engines) {
        const now = rolled[engine.engineId] as EngineSpec;
        // Qualifying never reaches the clamp here, so it carries the offset itself.
        const offset = now.qualifying - engine.qualifying;
        expect(Math.abs(offset)).toBeLessThanOrEqual(SPREAD);
        for (const key of ENGINE_KEYS) {
          const expected = Math.min(
            Math.max(engine[key] + offset, CHASSIS_STEP_RANGE.min),
            CHASSIS_STEP_RANGE.max,
          );
          expect(now[key], `${engine.engineId} ${key}`).toBe(expected);
        }
      }
    }
  });

  it("is one roll per engine, so every team running it races the same one", () => {
    const rated = applyEngineRatings(ROLLED, variedEngines(ROLLED, SPREAD, createRng(9)));
    const field = buildField({ ...rated, entries: rated.entries.map(withADriver) });
    const shared = field.filter((entrant) => entrant.engineId === MID_ENGINE.engineId);
    expect(shared.length).toBeGreaterThan(1);
    expect(new Set(shared.map((entrant) => JSON.stringify(entrant.engine))).size).toBe(1);
  });

  it("is the same roll for the same seed", () => {
    expect(variedEngines(ROLLED, SPREAD, createRng(7))).toEqual(
      variedEngines(ROLLED, SPREAD, createRng(7)),
    );
  });

  it("walks off last year's values, and an engine new to the run off its own", () => {
    const LAST: EngineSpec = { racing: 50, qualifying: 50, reliability: 50 };
    const lastYear: SeasonEngineRatings = { edge: LAST, mid: LAST };
    for (const seed of [1, 2, 3]) {
      const walked = variedEngines(ROLLED, SPREAD, createRng(seed), lastYear);
      const real = variedEngines(ROLLED, SPREAD, createRng(seed));
      for (const engine of ROLLED.engines) {
        const base =
          engine === LOW_ENGINE
            ? engine.qualifying
            : pulled(LAST.qualifying, averageOf("qualifying"));
        // The same draw either way, so the offset is the real roll's.
        const offset = (real[engine.engineId] as EngineSpec).qualifying - engine.qualifying;
        expect((walked[engine.engineId] as EngineSpec).qualifying).toBe(base + offset);
      }
    }
  });

  it("pulls a walked engine part of the way towards the menu's average, and no further", () => {
    // Spread 0: the pull is the only thing moving an engine.
    const above: EngineSpec = { racing: 95, qualifying: 95, reliability: 95 };
    const below: EngineSpec = { racing: 5, qualifying: 5, reliability: 5 };
    const walked = variedEngines(ROLLED, 0, createRng(1), { edge: above, mid: below });
    for (const key of ENGINE_KEYS) {
      const average = averageOf(key);
      const down = (walked.edge as EngineSpec)[key];
      const up = (walked.mid as EngineSpec)[key];
      expect(down).toBeLessThan(above[key]);
      expect(down).toBeGreaterThan(average);
      expect(up).toBeGreaterThan(below[key]);
      expect(up).toBeLessThan(average);
    }
  });

  it("pulls nothing when the engine starts from the real one", () => {
    expect(variedEngines(ROLLED, 0, createRng(1))).toEqual(authoredEngineRatings(ROLLED));
  });
});

/** An entry with one driver from the first authored season, so `buildField` makes it an entrant. */
function withADriver(entry: SeasonEntry, index: number): SeasonEntry {
  const driverId = SEED.entries.flatMap((each) => each.drivers)[index];
  return driverId === undefined ? entry : { ...entry, drivers: [driverId] };
}

describe("randomEngines", () => {
  it("draws every rating between the season's weakest and strongest of it", () => {
    // Enough draws that one past either end would surely turn up.
    for (let seed = 1; seed <= 50; seed++) {
      const rolled = randomEngines(ROLLED, createRng(seed));
      expect(Object.keys(rolled)).toEqual(ROLLED.engines.map((engine) => engine.engineId));
      for (const key of ENGINE_KEYS) {
        const authored = ROLLED.engines.map((engine) => engine[key]);
        for (const spec of Object.values(rolled)) {
          expect(spec[key]).toBeGreaterThanOrEqual(Math.min(...authored));
          expect(spec[key]).toBeLessThanOrEqual(Math.max(...authored));
        }
      }
    }
  });

  it("draws each rating on its own", () => {
    const rolled = randomEngines(ROLLED, createRng(3));
    const differs = ROLLED.engines.some((engine) => {
      const now = rolled[engine.engineId] as EngineSpec;
      return now.racing - engine.racing !== now.qualifying - engine.qualifying;
    });
    expect(differs).toBe(true);
  });
});

describe("withFirstEngines", () => {
  const OLD: SeasonEngine = { engineId: "old", racing: 70, qualifying: 70, reliability: 70 };
  const OLDER: SeasonEngine = { ...OLD, racing: 65 };
  // 2000: a runs "old", b "mid". 2001: a moves to "mid", and "old" is still rated.
  // 2002: c arrives on "low", and nobody rates "old" any more. 2003: c moves to "mid".
  const YEARS = new Map<number, SeasonSeed>([
    [
      2000,
      synthetic(
        2000,
        [OLDER, MID_ENGINE],
        [
          ["a", "old"],
          ["b", "mid"],
        ],
      ),
    ],
    [
      2001,
      synthetic(
        2001,
        [OLD, MID_ENGINE],
        [
          ["a", "mid"],
          ["b", "mid"],
        ],
      ),
    ],
    [
      2002,
      synthetic(
        2002,
        [MID_ENGINE, LOW_ENGINE],
        [
          ["a", "mid"],
          ["b", "mid"],
          ["c", "low"],
        ],
      ),
    ],
    [
      2003,
      synthetic(
        2003,
        [MID_ENGINE],
        [
          ["a", "mid"],
          ["b", "mid"],
          ["c", "mid"],
        ],
      ),
    ],
  ]);
  const history = (year: number) => YEARS.get(year);
  const year = (y: number) => YEARS.get(y) as SeasonSeed;
  const engineOf = (season: SeasonSeed, teamId: string) =>
    season.entries.find((entry) => entry.teamId === teamId)?.engineId;

  it("is the season untouched when engines are not kept, and in the run's first year", () => {
    expect(withFirstEngines(year(2001), null, history)).toBe(year(2001));
    expect(withFirstEngines(year(2000), 2000, history)).toBe(year(2000));
  });

  it("keeps the first year's engine, at the year's own values while the year rates it", () => {
    const kept = withFirstEngines(year(2001), 2000, history);
    expect(engineOf(kept, "a")).toBe("old");
    expect(engineSpecOf(kept, "old")).toEqual(OLD);
    expect(kept.engines).toHaveLength(year(2001).engines.length);
  });

  it("adds an engine the year no longer rates, at its latest authored values", () => {
    const kept = withFirstEngines(year(2002), 2000, history);
    expect(engineOf(kept, "a")).toBe("old");
    expect(engineSpecOf(kept, "old")).toEqual(OLD);
    expect(() => applyEngines(kept, authoredEngines(kept))).not.toThrow();
  });

  it("keeps a later arrival on the engine of its own first year in the run", () => {
    const kept = withFirstEngines(year(2003), 2000, history);
    expect(engineOf(kept, "c")).toBe("low");
    expect(engineSpecOf(kept, "low")).toEqual(LOW_ENGINE);
    expect(engineOf(kept, "b")).toBe("mid");
  });
});
