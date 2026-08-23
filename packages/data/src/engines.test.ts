import { powertrain } from "@alt-hist/engine";
import { describe, expect, it } from "vitest";
import { buildField } from "./buildField.js";
import {
  applyEngines,
  authoredEngines,
  availableEngines,
  engineChanges,
  engineSpecOf,
  isAuthoredEngines,
} from "./engines.js";
import { engines, FIRST_AUTHORED_SEASON, seasonSeed, seasons } from "./index.js";
import type { SeasonSeed } from "./types.js";

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
      expect(entry.car, entry.teamId).toEqual(before?.car);
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

  it("carries a re-supplied engine through to the field it builds", () => {
    const season = seasonWithAChoice();
    const swap = alternative(season);
    const changed = applyEngines(season, { ...authoredEngines(season), [swap.teamId]: swap.to });
    const before = buildField(season).find((entrant) => entrant.teamId === swap.teamId);
    const after = buildField(changed).find((entrant) => entrant.teamId === swap.teamId);

    expect(after?.engineId).toBe(swap.to);
    // Same chassis, different unit: the car that gets raced is not the same car.
    expect(after?.car).toEqual(before?.car);
    if (before === undefined || after === undefined) {
      throw new Error("expected the team to hold a seat");
    }
    expect(powertrain(after.car, after.engine)).not.toEqual(powertrain(before.car, before.engine));
  });
});
