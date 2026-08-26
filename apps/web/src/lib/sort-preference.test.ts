/**
 * The one sort order every list shares.
 *
 * Vitest runs without a DOM, so `sessionStorage` is absent here and the store
 * falls back to holding the value in memory — which is exactly the path these
 * exercise: that all three switches read one value and that setting it tells
 * every subscriber. The storage half is a convenience wrapped in try/catch, the
 * same as `theme.ts`, and is not what the stickiness depends on within a page.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SORT_ORDER } from "./sort.js";
import {
  parseSortOrder,
  resetSortOrder,
  setSortOrder,
  sortOrder,
  subscribe,
} from "./sort-preference.js";

afterEach(() => {
  resetSortOrder();
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
  it("opens on the default, so a fresh visit is not given the pecking order", () => {
    expect(sortOrder()).toBe(DEFAULT_SORT_ORDER);
    expect(DEFAULT_SORT_ORDER).toBe("name");
  });

  it("is one value, so setting it anywhere sets it everywhere", () => {
    setSortOrder("overall");
    expect(sortOrder()).toBe("overall");
    setSortOrder("name");
    expect(sortOrder()).toBe("name");
  });

  it("tells every subscriber, which is what moves the other switches", () => {
    const grid = vi.fn();
    const pool = vi.fn();
    // Subscribing directly is what `useSyncExternalStore` does on mount; a
    // DOM-less test cannot mount two components to do it for real.
    const stop = [subscribe(grid), subscribe(pool)];
    setSortOrder("overall");
    expect(grid).toHaveBeenCalledTimes(1);
    expect(pool).toHaveBeenCalledTimes(1);
    // And the snapshot they would read back is the new one, not the old.
    expect(sortOrder()).toBe("overall");
    for (const off of stop) {
      off();
    }
    setSortOrder("name");
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
});
