/**
 * The one sort order every list shares.
 *
 * Vitest runs without a DOM, so `localStorage` is absent here and the store
 * falls back to holding the value in memory — which is exactly the path most of
 * these exercise: that all three switches read one value and that setting it
 * tells every subscriber. The last case stubs storage in and loads the module
 * afresh, which is what a new visit does.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SORT_ORDER, type SortOrder } from "./sort.js";
import {
  parseSortOrder,
  resetSortOrder,
  setSortOrder,
  sortOrder,
  subscribe,
} from "./sort-preference.js";

/** The order a reader would switch to from the default. */
const OTHER: SortOrder = DEFAULT_SORT_ORDER === "name" ? "overall" : "name";

afterEach(() => {
  resetSortOrder();
  Reflect.deleteProperty(globalThis, "localStorage");
});

describe("reading a stored order", () => {
  it("takes either known order", () => {
    expect(parseSortOrder("name")).toBe("name");
    expect(parseSortOrder("overall")).toBe("overall");
  });

  it("falls back for anything else, including nothing stored", () => {
    expect(parseSortOrder(null)).toBe(DEFAULT_SORT_ORDER);
    expect(parseSortOrder("")).toBe(DEFAULT_SORT_ORDER);
    expect(parseSortOrder("by-rating")).toBe(DEFAULT_SORT_ORDER);
  });
});

describe("the shared order", () => {
  it("opens best first", () => {
    expect(sortOrder()).toBe(DEFAULT_SORT_ORDER);
    expect(DEFAULT_SORT_ORDER).toBe("overall");
  });

  it("is one value, so setting it anywhere sets it everywhere", () => {
    setSortOrder(OTHER);
    expect(sortOrder()).toBe(OTHER);
    setSortOrder(DEFAULT_SORT_ORDER);
    expect(sortOrder()).toBe(DEFAULT_SORT_ORDER);
  });

  it("tells every subscriber, which is what moves the other switches", () => {
    const grid = vi.fn();
    const pool = vi.fn();
    // Subscribing directly is what `useSyncExternalStore` does on mount; a
    // DOM-less test cannot mount two components to do it for real.
    const stop = [subscribe(grid), subscribe(pool)];
    setSortOrder(OTHER);
    expect(grid).toHaveBeenCalledTimes(1);
    expect(pool).toHaveBeenCalledTimes(1);
    // And the snapshot they would read back is the new one, not the old.
    expect(sortOrder()).toBe(OTHER);
    for (const off of stop) {
      off();
    }
    setSortOrder(DEFAULT_SORT_ORDER);
    expect(grid).toHaveBeenCalledTimes(1);
    expect(pool).toHaveBeenCalledTimes(1);
  });

  it("says nothing when the order did not change", () => {
    // A re-render per click on the order already chosen is work for nothing,
    // and `useSyncExternalStore` compares snapshots by identity.
    const listener = vi.fn();
    const off = subscribe(listener);
    setSortOrder(DEFAULT_SORT_ORDER);
    expect(listener).not.toHaveBeenCalled();
    off();
  });

  it("opens the next visit on whichever order was picked last", async () => {
    const store = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string): string | null => store.get(key) ?? null,
        setItem: (key: string, value: string): void => {
          store.set(key, value);
        },
      },
    });
    setSortOrder(OTHER);
    // A fresh load of the module is a new visit reading what the last one left.
    vi.resetModules();
    const next = await import("./sort-preference.js");
    expect(next.sortOrder()).toBe(OTHER);
    next.resetSortOrder();
  });
});
