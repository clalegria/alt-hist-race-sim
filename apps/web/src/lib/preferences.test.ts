/**
 * These run without a DOM, so `localStorage` is simply absent. That is the
 * first case worth pinning — the store calls into here on every started season,
 * and a `ReferenceError` would take the app down rather than lose a preference.
 * The rest stub the API in, including a version that throws the way a locked-down
 * browser does.
 */

import { DEFAULT_RANDOMNESS_LEVEL, RANDOMNESS_LEVELS } from "@alt-hist/engine";
import { afterEach, describe, expect, it } from "vitest";
import {
  parseRatingMode,
  readRandomness,
  readRatingMode,
  readRunSettings,
  readSeasonYear,
  rememberRandomness,
  rememberRatingMode,
  rememberRunSettings,
  rememberSeasonYear,
  STARTING_RANDOMNESS_LEVEL,
} from "./preferences.js";
import { HISTORICAL_SETTINGS, pointsTables, type RunSettings } from "./run-settings.js";
import { DEFAULT_SEASON_YEAR, isPlayable, LAST_SEASON, PLAYABLE_SEASONS } from "./seasons.js";

const STORAGE_KEY = "alt-hist-rating-mode";
const RANDOMNESS_KEY = "alt-hist-randomness";
const YEAR_KEY = "alt-hist-season-year";

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
    // Peak is the default, so a corrupted value must land there rather than on
    // whichever mode happens to sort first.
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
  it("opens on a level of the app's choosing, not the engine's reference level", () => {
    // The two answer different questions — what the model is measured at, and
    // what makes a good first season — and this is the line that says so. If
    // they are ever meant to be the same number, deleting this is the decision.
    expect(STARTING_RANDOMNESS_LEVEL).not.toBe(DEFAULT_RANDOMNESS_LEVEL);
    expect(RANDOMNESS_LEVELS).toContain(STARTING_RANDOMNESS_LEVEL);
  });

  it("survives without any storage at all", () => {
    expect(typeof localStorage).toBe("undefined");
    expect(readRandomness()).toBe(STARTING_RANDOMNESS_LEVEL);
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

  it("falls back to the level the setup screen opens on for anything else", () => {
    // Not "whichever level sorts first": an unreadable value has to land on the
    // stop a reader who has never chosen would have been offered.
    for (const raw of ["", "0", "6", "2.5", "chaotic", "[]"]) {
      stubStorage({ key: RANDOMNESS_KEY, initial: raw });
      expect(readRandomness(), JSON.stringify(raw)).toBe(STARTING_RANDOMNESS_LEVEL);
    }
  });

  it("shrugs off storage that throws", () => {
    stubStorage({ throws: true });
    expect(readRandomness()).toBe(STARTING_RANDOMNESS_LEVEL);
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

describe("remembering the year a picker opens on", () => {
  it("survives without any storage at all", () => {
    expect(typeof localStorage).toBe("undefined");
    expect(readSeasonYear()).toBe(DEFAULT_SEASON_YEAR);
    expect(() => {
      rememberSeasonYear(DEFAULT_SEASON_YEAR);
    }).not.toThrow();
  });

  it("reads back what it wrote", () => {
    const store = stubStorage();
    // Not the default, so the assertion cannot pass by falling back — and taken
    // off the playable list rather than written down.
    const other = PLAYABLE_SEASONS.at(-1) ?? DEFAULT_SEASON_YEAR;
    expect(other).not.toBe(DEFAULT_SEASON_YEAR);

    rememberSeasonYear(other);
    expect(store.get(YEAR_KEY)).toBe(String(other));
    expect(readSeasonYear()).toBe(other);
  });

  it("picks up a year chosen on an earlier visit", () => {
    const stored = PLAYABLE_SEASONS.at(-1) ?? DEFAULT_SEASON_YEAR;
    stubStorage({ key: YEAR_KEY, initial: String(stored) });
    expect(readSeasonYear()).toBe(stored);
  });

  it("falls back for a year nothing could be simulated from", () => {
    // The case that matters: a stored year with no seed file behind it reaches
    // `seasonSeed`, which throws. A year outside the authored range stands in
    // for a season file that has been removed.
    const unauthored = LAST_SEASON + 10;
    expect(isPlayable(unauthored)).toBe(false);
    for (const raw of ["", "nineteen eighty", "1980.5", "[]", String(unauthored)]) {
      stubStorage({ key: YEAR_KEY, initial: raw });
      expect(readSeasonYear(), JSON.stringify(raw)).toBe(DEFAULT_SEASON_YEAR);
    }
  });

  it("shrugs off storage that throws", () => {
    stubStorage({ throws: true });
    expect(readSeasonYear()).toBe(DEFAULT_SEASON_YEAR);
    expect(() => {
      rememberSeasonYear(DEFAULT_SEASON_YEAR);
    }).not.toThrow();
  });

  it("does not disturb the two preferences it shares a storage with", () => {
    stubStorage();
    rememberRatingMode("aged");
    rememberRandomness(5);
    rememberSeasonYear(PLAYABLE_SEASONS.at(-1) ?? DEFAULT_SEASON_YEAR);
    expect(readRatingMode()).toBe("aged");
    expect(readRandomness()).toBe(5);
  });
});

describe("remembering the run settings", () => {
  const fixed: RunSettings = {
    breakdowns: "fewer",
    reliability: PLAYABLE_SEASONS[0] ?? null,
    points: pointsTables().at(-1)?.scale ?? [],
    careerEvents: "none",
    teamNames: "first",
  };

  it("survives without any storage at all", () => {
    expect(typeof localStorage).toBe("undefined");
    expect(readRunSettings()).toEqual(HISTORICAL_SETTINGS);
    expect(() => {
      rememberRunSettings(fixed);
    }).not.toThrow();
  });

  it("reads back what it wrote", () => {
    stubStorage();
    rememberRunSettings(fixed);
    expect(readRunSettings()).toEqual(fixed);
  });

  it("falls back to the historical settings for anything it could not have written", () => {
    const junk = [
      "",
      "{",
      "null",
      "[]",
      JSON.stringify({ points: "own" }),
      JSON.stringify({ points: [100, 1] }),
      // Settings from before Breakdowns and Reliability existed.
      JSON.stringify({ points: null }),
      // And from before Career events.
      JSON.stringify({ breakdowns: null, reliability: null, points: null }),
      // And from before Team names.
      JSON.stringify({ breakdowns: null, reliability: null, points: null, careerEvents: null }),
    ];
    for (const raw of junk) {
      stubStorage({ key: "alt-hist-run-settings", initial: raw });
      expect(readRunSettings(), raw).toEqual(HISTORICAL_SETTINGS);
    }
  });

  it("shrugs off storage that throws", () => {
    stubStorage({ throws: true });
    expect(readRunSettings()).toEqual(HISTORICAL_SETTINGS);
    expect(() => {
      rememberRunSettings(fixed);
    }).not.toThrow();
  });
});
