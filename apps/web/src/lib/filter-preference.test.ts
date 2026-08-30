/**
 * Remembering how the pool is narrowed.
 *
 * These run without a DOM, so `localStorage` is simply absent — the first case
 * worth pinning, because the grid editor calls into here on every open and a
 * `ReferenceError` would take the page down rather than lose a preference. The
 * rest stub the API in, including a version that throws the way a locked-down
 * browser does.
 */

import { afterEach, describe, expect, it } from "vitest";
import {
  hasStoredDriverFilters,
  parseDriverFilters,
  readDriverFilters,
  rememberDriverFilters,
} from "./filter-preference.js";
import { AGE_RANGE, type DriverFilters, defaultDriverFilters } from "./people.js";

const STORAGE_KEY = "alt-hist-driver-filters";

/** Installs a fake storage and hands back the map behind it. */
function stubStorage(behaviour: { throws?: boolean } = {}): Map<string, string> {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string): string | null => {
        if (behaviour.throws === true) {
          throw new Error("storage is blocked");
        }
        return store.get(key) ?? null;
      },
      setItem: (key: string, value: string): void => {
        if (behaviour.throws === true) {
          throw new Error("storage is blocked");
        }
        store.set(key, value);
      },
      removeItem: (key: string): void => {
        store.delete(key);
      },
    },
  });
  return store;
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, "localStorage");
});

/** A set that is nobody's default, so "it was remembered" cannot pass by luck. */
const NARROWED: DriverFilters = {
  hideRetired: false,
  hideFuture: true,
  minAge: 25,
  maxAge: 39,
};

describe("without a storage to reach", () => {
  it("opens on the mode's defaults rather than throwing", () => {
    expect(readDriverFilters("aged")).toEqual(defaultDriverFilters("aged"));
    expect(readDriverFilters("peak")).toEqual(defaultDriverFilters("peak"));
  });

  it("drops what it was asked to remember, quietly", () => {
    expect(() => {
      rememberDriverFilters(NARROWED);
    }).not.toThrow();
    expect(hasStoredDriverFilters()).toBe(false);
  });
});

describe("when the browser blocks storage", () => {
  it("falls back both ways rather than surfacing the failure", () => {
    stubStorage({ throws: true });
    expect(readDriverFilters("peak")).toEqual(defaultDriverFilters("peak"));
    expect(hasStoredDriverFilters()).toBe(false);
    expect(() => {
      rememberDriverFilters(NARROWED);
    }).not.toThrow();
  });
});

describe("remembering a set", () => {
  it("hands back what was last set", () => {
    const store = stubStorage();
    rememberDriverFilters(NARROWED);
    expect(readDriverFilters("aged")).toEqual(NARROWED);
    expect(store.has(STORAGE_KEY)).toBe(true);
  });

  it("hands the same set to both modes", () => {
    stubStorage();
    // The two modes disagree about what the panel opens on, which is what makes
    // this worth pinning: a set the reader chose is theirs in either, and
    // switching to peak must not hand back peak's defaults instead.
    expect(defaultDriverFilters("peak")).not.toEqual(defaultDriverFilters("aged"));
    rememberDriverFilters(NARROWED);
    expect(readDriverFilters("aged")).toEqual(NARROWED);
    expect(readDriverFilters("peak")).toEqual(NARROWED);
  });

  it("says whether anything has ever been set, which no set can say for itself", () => {
    stubStorage();
    expect(hasStoredDriverFilters()).toBe(false);
    // Storing the defaults still counts as an answer: it is what stops a later
    // mode switch overwriting a reader who deliberately chose them.
    rememberDriverFilters(defaultDriverFilters("aged"));
    expect(hasStoredDriverFilters()).toBe(true);
  });

  it("opens on the mode's defaults only while nothing has been set", () => {
    stubStorage();
    expect(readDriverFilters("peak")).toEqual(defaultDriverFilters("peak"));
    expect(readDriverFilters("aged")).toEqual(defaultDriverFilters("aged"));
  });
});

describe("reading a stored set back", () => {
  it("takes the mode's defaults when the slot is empty", () => {
    expect(parseDriverFilters(null, "aged")).toEqual(defaultDriverFilters("aged"));
  });

  it("takes them again when the slot holds something that is not a set", () => {
    for (const raw of ["", "not json", "42", "null", '"aged"', "[]"]) {
      expect(parseDriverFilters(raw, "peak"), raw).toEqual(defaultDriverFilters("peak"));
    }
  });

  it("falls back field by field, so a set stored before a filter existed still reads", () => {
    const partial = parseDriverFilters(JSON.stringify({ minAge: 25 }), "aged");
    expect(partial.minAge).toBe(25);
    // Everything the stored set did not say keeps the default rather than the
    // whole thing being thrown away.
    expect(partial.hideRetired).toBe(defaultDriverFilters("aged").hideRetired);
    expect(partial.hideFuture).toBe(defaultDriverFilters("aged").hideFuture);
    expect(partial.maxAge).toBe(defaultDriverFilters("aged").maxAge);
  });

  it("ignores a field of the wrong type", () => {
    const wrong = parseDriverFilters(
      JSON.stringify({ hideRetired: "yes", minAge: "young", maxAge: 30 }),
      "aged",
    );
    expect(wrong.hideRetired).toBe(defaultDriverFilters("aged").hideRetired);
    expect(wrong.minAge).toBe(defaultDriverFilters("aged").minAge);
    expect(wrong.maxAge).toBe(30);
  });

  it("clamps an age to the range the panel can hold", () => {
    const clamped = parseDriverFilters(JSON.stringify({ minAge: -40, maxAge: 900 }), "aged");
    expect(clamped.minAge).toBe(AGE_RANGE.min);
    expect(clamped.maxAge).toBe(AGE_RANGE.max);
  });

  it("puts a crossed range the right way round rather than hiding everybody", () => {
    const crossed = parseDriverFilters(JSON.stringify({ minAge: 50, maxAge: 20 }), "aged");
    expect(crossed.minAge).toBe(20);
    expect(crossed.maxAge).toBe(50);
  });
});
