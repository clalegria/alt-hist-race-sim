import { championshipStandings, constructorStandings, createRngFromState } from "@alt-hist/engine";
import { describe, expect, it } from "vitest";
import { advance, createWorld, useSeasonStore, type View } from "./season.js";

describe("the world", () => {
  it("runs one race per round on the calendar", () => {
    expect(createWorld(1).season.races).toHaveLength(14);
  });

  it("is the same world for the same seed", () => {
    expect(createWorld(7)).toEqual(createWorld(7));
  });

  it("is a different world for a different seed", () => {
    expect(createWorld(7)).not.toEqual(createWorld(8));
  });

  it("records the grid it actually raced", () => {
    const world = createWorld(1);
    expect(world.field).toHaveLength(28);
    // Not just ids: the ratings that fed the simulation, which is what makes
    // this the record of the season rather than a pointer back to the seed.
    const jones = world.field.find((entrant) => entrant.driverId === "jones");
    expect(jones?.teamId).toBe("williams");
    expect(jones?.driver.racing).toBeGreaterThan(0);
    expect(jones?.car.reliability).toBeGreaterThan(0);
  });

  it("survives a JSON round trip unchanged", () => {
    // The save-game invariant: the world is plain data. A function, a Map, or a
    // live `Rng` anywhere in it would silently vanish here.
    const world = createWorld(3);
    expect(JSON.parse(JSON.stringify(world))).toEqual(world);
  });

  it("holds no functions anywhere", () => {
    // Stronger than the round trip, which a `Date` or a `Map` could survive by
    // turning into something else that happens to compare equal.
    const seen = new Set<unknown>();
    const walk = (value: unknown, path: string): void => {
      expect(typeof value, `${path} is a function`).not.toBe("function");
      if (typeof value !== "object" || value === null || seen.has(value)) {
        return;
      }
      seen.add(value);
      expect(
        Object.getPrototypeOf(value) === Object.prototype || Array.isArray(value),
        `${path} is a class instance`,
      ).toBe(true);
      for (const [key, child] of Object.entries(value)) {
        walk(child, `${path}.${key}`);
      }
    };
    walk(createWorld(2), "world");
  });

  it("stores an RNG snapshot that resumes the stream", () => {
    // Not a decoration: this is what a saved game continues from. Rebuilding
    // from the snapshot must give the same next value as carrying on would.
    const world = createWorld(5);
    const resumed = createRngFromState(world.rngState);
    const again = createRngFromState(world.rngState);
    expect(resumed.next()).toBe(again.next());
    expect(world.rngState).not.toEqual(createWorld(6).rngState);
  });

  it("produces a season the championship can be derived from", () => {
    const world = createWorld(4);
    const drivers = championshipStandings(world.season);
    const teams = constructorStandings(world.season);
    expect(drivers).toHaveLength(28);
    expect(teams).toHaveLength(15);
    expect(drivers.reduce((sum, s) => sum + s.points, 0)).toBe(
      teams.reduce((sum, t) => sum + t.points, 0),
    );
  });
});

describe("the store", () => {
  it("starts with a season already run", () => {
    // The page has something to show on first paint; there is no empty state.
    expect(useSeasonStore.getState().world.season.races).toHaveLength(14);
  });

  it("replaces the world when a new seed is simulated", () => {
    const before = useSeasonStore.getState().world;
    useSeasonStore.getState().simulate(before.seed + 1);
    const after = useSeasonStore.getState().world;
    expect(after.seed).toBe(before.seed + 1);
    expect(after.season).not.toEqual(before.season);
    // A fresh object, not a mutation of the old one — that is what makes the
    // subscription fire and the tables re-render.
    expect(after).not.toBe(before);
  });

  it("gives the same world for the same seed however it is reached", () => {
    useSeasonStore.getState().simulate(9);
    expect(useSeasonStore.getState().world).toEqual(createWorld(9));
  });
});

describe("revealing the season", () => {
  const ROUNDS = 14;

  it("opens on the grid", () => {
    useSeasonStore.getState().startAgain();
    expect(useSeasonStore.getState().view).toEqual({ kind: "grid" });
  });

  it("walks qualifying, race, qualifying, race", () => {
    let view = advance({ kind: "grid" }, ROUNDS);
    expect(view).toEqual({ kind: "qualifying", round: 0 });
    view = advance(view, ROUNDS);
    expect(view).toEqual({ kind: "race", round: 0 });
    view = advance(view, ROUNDS);
    expect(view).toEqual({ kind: "qualifying", round: 1 });
    view = advance(view, ROUNDS);
    expect(view).toEqual({ kind: "race", round: 1 });
  });

  it("reaches the summary after the last race, not before", () => {
    expect(advance({ kind: "race", round: ROUNDS - 2 }, ROUNDS)).toEqual({
      kind: "qualifying",
      round: ROUNDS - 1,
    });
    expect(advance({ kind: "race", round: ROUNDS - 1 }, ROUNDS)).toEqual({ kind: "summary" });
  });

  it("shows every session exactly once on the way through", () => {
    // Two per round plus the summary; anything else means a skipped or
    // repeated session.
    const seen: View[] = [];
    let view: View = { kind: "grid" };
    for (let step = 0; step < ROUNDS * 2 + 5; step += 1) {
      view = advance(view, ROUNDS);
      seen.push(view);
      if (view.kind === "summary") {
        break;
      }
    }
    expect(seen).toHaveLength(ROUNDS * 2 + 1);
    expect(seen.filter((v) => v.kind === "qualifying")).toHaveLength(ROUNDS);
    expect(seen.filter((v) => v.kind === "race")).toHaveLength(ROUNDS);
  });

  it("stays put once the season is over", () => {
    expect(advance({ kind: "summary" }, ROUNDS)).toEqual({ kind: "summary" });
  });

  it("skips to the summary from anywhere", () => {
    useSeasonStore.getState().nextSession();
    useSeasonStore.getState().skipToEnd();
    expect(useSeasonStore.getState().view).toEqual({ kind: "summary" });
  });

  it("starts again on a new season, back at the grid", () => {
    useSeasonStore.getState().skipToEnd();
    const before = useSeasonStore.getState().world.seed;
    useSeasonStore.getState().startAgain();
    const after = useSeasonStore.getState();
    expect(after.view).toEqual({ kind: "grid" });
    expect(after.world.seed).not.toBe(before);
  });
});
