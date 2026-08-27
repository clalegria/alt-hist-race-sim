/**
 * These run without a DOM, so `localStorage` is simply absent. That is the
 * first case worth pinning — the store calls into here on every started season,
 * and a `ReferenceError` would take the app down rather than lose a preference.
 * The rest stub the API in, including a version that throws the way a locked-down
 * browser does.
 */

import { DEFAULT_RANDOMNESS_LEVEL } from "@alt-hist/engine";
import { afterEach, describe, expect, it } from "vitest";
import {
  parseRatingMode,
  readRandomness,
  readRatingMode,
  rememberRandomness,
  rememberRatingMode,
} from "./preferences.js";

const STORAGE_KEY = "alt-hist-rating-mode";
const RANDOMNESS_KEY = "alt-hist-randomness";

/**
 * Installs a fake storage and hands back the map behind it.
 *
 * `initial` seeds whichever key the caller names, defaulting to the rating mode
 * — the two preferences share a storage and are tested against the same stub.
 */
function stubStorage(
  behaviour: { throws?: boolean; initial?: string; key?: string } = {},
): Map<string, string> {
  const store = new Map<string, string>();
  if (behaviour.initial !== undefined) {
    store.set(behaviour.key ?? STORAGE_KEY, behaviour.initial);
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

describe("remembering the randomness level", () => {
  it("survives without any storage at all", () => {
    expect(typeof localStorage).toBe("undefined");
    expect(readRandomness()).toBe(DEFAULT_RANDOMNESS_LEVEL);
    expect(() => {
      rememberRandomness(5);
    }).not.toThrow();
  });

  it("reads back what it wrote, as a digit", () => {
    const store = stubStorage();
    rememberRandomness(4);
    expect(store.get(RANDOMNESS_KEY)).toBe("4");
    expect(readRandomness()).toBe(4);

    rememberRandomness(1);
    expect(readRandomness()).toBe(1);
  });

  it("picks up a level chosen on an earlier visit", () => {
    stubStorage({ key: RANDOMNESS_KEY, initial: "5" });
    expect(readRandomness()).toBe(5);
  });

  it("falls back to the calibrated default for anything else", () => {
    // Not "whichever level sorts first": an unreadable value has to land on the
    // one setting the model was actually measured against.
    for (const raw of ["", "0", "6", "2.5", "chaotic", "[]"]) {
      stubStorage({ key: RANDOMNESS_KEY, initial: raw });
      expect(readRandomness(), JSON.stringify(raw)).toBe(DEFAULT_RANDOMNESS_LEVEL);
    }
  });

  it("shrugs off storage that throws", () => {
    stubStorage({ throws: true });
    expect(readRandomness()).toBe(DEFAULT_RANDOMNESS_LEVEL);
    expect(() => {
      rememberRandomness(3);
    }).not.toThrow();
  });

  it("does not disturb the ability mode it shares a storage with", () => {
    stubStorage();
    rememberRatingMode("aged");
    rememberRandomness(5);
    expect(readRatingMode()).toBe("aged");
    expect(readRandomness()).toBe(5);
  });
});
