/**
 * Which tab a tab strip was last left on, remembered for the visit.
 *
 * A tab strip that snaps back to its first tab on every new page is the app
 * forgetting what the reader was doing: someone reading calendars season after
 * season has to pick Calendar again each time. So every strip opens on the tab
 * it was last left on, until the reader picks another.
 *
 * `sessionStorage`, like the old sort choice was, so a reload keeps it while a
 * fresh visit starts at each strip's first tab. A module-level copy is read once
 * at load, so asking for the tab never touches storage. Access is wrapped as
 * `theme.ts` wraps it: it throws in Safari's private browsing and in embeddings
 * that block third-party storage, and is absent under Vitest, which has no DOM.
 */

const KEY_PREFIX = "alt-hist-tab-";

export interface TabMemory<T extends string> {
  /** The tab last left on, or the strip's first for a fresh visit. */
  readonly last: () => T;
  readonly remember: (tab: T) => void;
}

/** The memory of one tab strip, under `name`, holding only one of `tabs`. */
export function tabMemory<T extends string>(name: string, tabs: readonly T[]): TabMemory<T> {
  const key = KEY_PREFIX + name;
  const first = tabs[0];
  if (first === undefined) {
    throw new Error(`tab strip "${name}" has no tabs`);
  }
  let current = read(key, tabs) ?? first;
  return {
    last: () => current,
    remember: (tab) => {
      if (tab === current) {
        return;
      }
      current = tab;
      if (typeof sessionStorage === "undefined") {
        return;
      }
      try {
        sessionStorage.setItem(key, tab);
      } catch {
        // Remembering is a convenience; failing to is not worth surfacing.
      }
    },
  };
}

function read<T extends string>(key: string, tabs: readonly T[]): T | undefined {
  if (typeof sessionStorage === "undefined") {
    return undefined;
  }
  try {
    const stored = sessionStorage.getItem(key);
    return tabs.find((tab) => tab === stored);
  } catch {
    return undefined;
  }
}
