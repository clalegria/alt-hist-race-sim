/**
 * The run kept in storage: restored on start, written on every change, removed
 * on exit — and nothing worse than a lost reload when storage misbehaves.
 *
 * These run without a DOM, so `localStorage` is stubbed in, as in
 * `lib/preferences.test.ts`, including a version that throws the way a
 * locked-down browser does.
 */

import { FIRST_AUTHORED_SEASON } from "@alt-hist/data";
import { afterEach, describe, expect, it } from "vitest";
import { RUN_KEY, startRunPersistence } from "./persist.js";
import { recipeOf } from "./recipe.js";
import { type Run, useSeasonStore } from "./season.js";

const YEAR = FIRST_AUTHORED_SEASON;

/** Installs a fake storage and hands back the map behind it. */
function stubStorage(behaviour: { throws?: boolean; initial?: string } = {}): Map<string, string> {
  const store = new Map<string, string>();
  if (behaviour.initial !== undefined) {
    store.set(RUN_KEY, behaviour.initial);
  }
  const guard = (): void => {
    if (behaviour.throws === true) {
      throw new Error("storage is blocked");
    }
  };
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string): string | null => {
        guard();
        return store.get(key) ?? null;
      },
      setItem: (key: string, value: string): void => {
        guard();
        store.set(key, value);
      },
      removeItem: (key: string): void => {
        guard();
        store.delete(key);
      },
    },
  });
  return store;
}

/** A run built and then taken out of the store, as if from an earlier visit. */
function earlierRun(): Run {
  useSeasonStore.getState().simulateEra(5, YEAR);
  useSeasonStore.getState().continueRun();
  const run = useSeasonStore.getState().run;
  useSeasonStore.setState({ run: null });
  if (run === null) {
    throw new Error("expected a run");
  }
  return run;
}

let stop: (() => void) | undefined;

afterEach(() => {
  stop?.();
  stop = undefined;
  Reflect.deleteProperty(globalThis, "localStorage");
  useSeasonStore.setState({ run: null, resumeFailed: false });
});

describe("on start", () => {
  it("restores the run saved before the reload", () => {
    const run = earlierRun();
    stubStorage({ initial: JSON.stringify(recipeOf(run)) });
    stop = startRunPersistence();
    expect(useSeasonStore.getState().run).toEqual(run);
    expect(useSeasonStore.getState().resumeFailed).toBe(false);
  });

  it("drops a run this build cannot rebuild, and says so", () => {
    const recipe = recipeOf(earlierRun());
    const worlds = recipe.worlds.map((world) => ({ ...world, check: "stale" }));
    const storage = stubStorage({ initial: JSON.stringify({ ...recipe, worlds }) });
    stop = startRunPersistence();
    expect(useSeasonStore.getState().run).toBeNull();
    expect(useSeasonStore.getState().resumeFailed).toBe(true);
    expect(storage.has(RUN_KEY)).toBe(false);
  });

  it("treats a value that is not JSON the same way", () => {
    const storage = stubStorage({ initial: "{" });
    stop = startRunPersistence();
    expect(useSeasonStore.getState().resumeFailed).toBe(true);
    expect(storage.has(RUN_KEY)).toBe(false);
  });

  it("finds nothing to say when nothing was saved", () => {
    stubStorage();
    stop = startRunPersistence();
    expect(useSeasonStore.getState().run).toBeNull();
    expect(useSeasonStore.getState().resumeFailed).toBe(false);
  });
});

describe("while the app runs", () => {
  it("saves a started run, every step of it, and forgets it on exit", () => {
    const storage = stubStorage();
    stop = startRunPersistence();
    useSeasonStore.getState().simulate(3, YEAR);
    expect(JSON.parse(storage.get(RUN_KEY) ?? "null")?.cursor).toEqual({ kind: "grid" });

    useSeasonStore.getState().continueRun();
    expect(JSON.parse(storage.get(RUN_KEY) ?? "null")?.cursor).toEqual({
      kind: "qualifying",
      round: 0,
    });

    useSeasonStore.getState().exitRun();
    expect(storage.has(RUN_KEY)).toBe(false);
  });

  it("clears the notice once another run is started", () => {
    stubStorage({ initial: "{" });
    stop = startRunPersistence();
    useSeasonStore.getState().simulate(3, YEAR);
    expect(useSeasonStore.getState().resumeFailed).toBe(false);
  });
});

describe("without working storage", () => {
  it("runs as if nothing had been saved when storage is absent", () => {
    stop = startRunPersistence();
    useSeasonStore.getState().simulate(3, YEAR);
    expect(useSeasonStore.getState().run).not.toBeNull();
  });

  it("runs as if nothing had been saved when storage throws", () => {
    stubStorage({ throws: true });
    expect(() => {
      stop = startRunPersistence();
    }).not.toThrow();
    useSeasonStore.getState().simulate(3, YEAR);
    useSeasonStore.getState().exitRun();
    expect(useSeasonStore.getState().resumeFailed).toBe(false);
  });
});
