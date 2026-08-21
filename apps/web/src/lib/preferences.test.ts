/**
 * These run without a DOM, so `localStorage` is simply absent. That is the
 * first case worth pinning — the store calls into here on every started season,
 * and a `ReferenceError` would take the app down rather than lose a preference.
 * The rest stub the API in, including a version that throws the way a locked-down
 * browser does.
 */

import { afterEach, describe, expect, it } from "vitest";
import { parseRatingMode, readRatingMode, rememberRatingMode } from "./preferences.js";

const STORAGE_KEY = "alt-hist-rating-mode";

/** Installs a fake storage and hands back the map behind it. */
function stubStorage(behaviour: { throws?: boolean; initial?: string } = {}): Map<string, string> {
  const store = new Map<string, string>();
  if (behaviour.initial !== undefined) {
    store.set(STORAGE_KEY, behaviour.initial);
  }
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
    },
  });
  return store;
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, "localStorage");
});

describe("parsing a stored mode", () => {
  it("accepts the modes the data package declares", () => {
    expect(parseRatingMode("peak")).toBe("peak");
    expect(parseRatingMode("aged")).toBe("aged");
  });

  it("falls back to peak for anything else", () => {
    // Peak is the calibrated default, so a corrupted value must land there
    // rather than on whichever mode happens to sort first.
    for (const raw of [null, "", "PEAK", "young", "[]"]) {
      expect(parseRatingMode(raw), JSON.stringify(raw)).toBe("peak");
    }
  });
});

describe("remembering the choice", () => {
  it("survives without any storage at all", () => {
    // No stub installed: this is the Vitest and no-DOM case.
    expect(typeof localStorage).toBe("undefined");
    expect(readRatingMode()).toBe("peak");
    expect(() => {
      rememberRatingMode("aged");
    }).not.toThrow();
  });

  it("reads back what it wrote", () => {
    const store = stubStorage();
    rememberRatingMode("aged");
    expect(store.get(STORAGE_KEY)).toBe("aged");
    expect(readRatingMode()).toBe("aged");

    rememberRatingMode("peak");
    expect(readRatingMode()).toBe("peak");
  });

  it("picks up a choice made on an earlier visit", () => {
    stubStorage({ initial: "aged" });
    expect(readRatingMode()).toBe("aged");
  });

  it("shrugs off storage that throws", () => {
    // Safari private browsing and blocked third-party storage both do this. A
    // preference is never worth a blank page.
    stubStorage({ throws: true });
    expect(readRatingMode()).toBe("peak");
    expect(() => {
      rememberRatingMode("aged");
    }).not.toThrow();
  });
});
