/**
 * A tab strip's memory of the tab it was left on.
 *
 * Without a DOM `sessionStorage` is absent, and the memory still holds the tab
 * for the life of the page. The rest stub storage in, including one that throws
 * the way a locked-down browser does.
 */

import { afterEach, describe, expect, it } from "vitest";
import { tabMemory } from "./tab-memory.js";

const TABS = ["first", "second", "third"] as const;

function stubStorage(behaviour: { throws?: boolean } = {}): Map<string, string> {
  const store = new Map<string, string>();
  const guard = () => {
    if (behaviour.throws === true) {
      throw new Error("storage is blocked");
    }
  };
  Object.defineProperty(globalThis, "sessionStorage", {
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
    },
  });
  return store;
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, "sessionStorage");
});

describe("a tab strip's memory", () => {
  it("opens a fresh visit on the first tab", () => {
    expect(tabMemory("strip", TABS).last()).toBe("first");
  });

  it("holds the tab last left on, without storage", () => {
    const memory = tabMemory("strip", TABS);
    memory.remember("third");
    expect(memory.last()).toBe("third");
  });

  it("reads the tab back after a reload", () => {
    stubStorage();
    tabMemory("strip", TABS).remember("second");
    expect(tabMemory("strip", TABS).last()).toBe("second");
  });

  it("keeps each strip's tab apart", () => {
    stubStorage();
    tabMemory("one", TABS).remember("second");
    expect(tabMemory("other", TABS).last()).toBe("first");
  });

  it("ignores a stored tab the strip does not have", () => {
    const store = stubStorage();
    tabMemory("strip", TABS).remember("third");
    for (const [key] of store) {
      store.set(key, "gone");
    }
    expect(tabMemory("strip", TABS).last()).toBe("first");
  });

  it("still remembers when storage throws", () => {
    stubStorage({ throws: true });
    const memory = tabMemory("strip", TABS);
    expect(memory.last()).toBe("first");
    memory.remember("second");
    expect(memory.last()).toBe("second");
  });
});
