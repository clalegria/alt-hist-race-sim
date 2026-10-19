/**
 * The order every list is in, shared and remembered between visits.
 *
 * There are three sort switches on the app — the opening grid, the pool of
 * drivers without a drive, and the grid at the foot of a finished season — and
 * they used to hold three pieces of state. The reasoning was that the grid and
 * the pool are read for different reasons; what it produced was a reader setting
 * "Rating" on the grid, opening the editor, and being handed an alphabetical
 * pool, then setting it again and losing it on the next screen. Sorting by
 * rating is a way of reading, not a property of one list: asking for it once
 * should mean it everywhere.
 *
 * Kept here as a tiny external store rather than in the world state, because it
 * is a display choice and nothing to do with the simulation — the world object
 * is the save file, and how a list happens to be ordered is not part of one.
 * `useSyncExternalStore` is what makes the three switches move together: they
 * subscribe to the same value, so setting one re-renders all of them.
 *
 * `localStorage`, like the theme, so a choice outlasts the visit: whichever
 * order the reader last picked is the one the app opens on next time, and best
 * first until they pick. Storage belongs to the address the app is served from,
 * so a new tunnel address starts afresh on the default. Access is wrapped
 * exactly as `theme.ts` wraps it: it throws outright in Safari's private
 * browsing and in embeddings that block third-party storage, and is simply
 * absent under Vitest, which runs without a DOM.
 */

import { useSyncExternalStore } from "react";
import { DEFAULT_SORT_ORDER, type SortOrder } from "./sort.js";

const STORAGE_KEY = "alt-hist-sort-order";

/** A stored value, falling back for anything that is not a known order. */
export function parseSortOrder(raw: string | null): SortOrder {
  return raw === "name" || raw === "overall" ? raw : DEFAULT_SORT_ORDER;
}

function read(): SortOrder {
  if (typeof localStorage === "undefined") {
    return DEFAULT_SORT_ORDER;
  }
  try {
    return parseSortOrder(localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_SORT_ORDER;
  }
}

// Read once at module load rather than on every `getSnapshot` call: the hook
// compares snapshots by identity, and a getter that touched storage each time
// would still be correct but would hit it on every render.
let current: SortOrder = read();
const listeners = new Set<() => void>();

/**
 * What `useSyncExternalStore` hooks onto, and what makes the three switches move
 * together. Exported so a DOM-less test can hold two subscribers at once, which
 * is the whole behaviour and not something two static renders can show.
 */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot(): SortOrder {
  return current;
}

/** What a list would be ordered by right now. Also the server snapshot. */
export function sortOrder(): SortOrder {
  return current;
}

/** Sets the order for every list on the app, and remembers it for next time. */
export function setSortOrder(order: SortOrder): void {
  if (order === current) {
    return;
  }
  current = order;
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, order);
    } catch {
      // Remembering is a convenience; failing to is not worth surfacing.
    }
  }
  for (const listener of listeners) {
    listener();
  }
}

/**
 * The shared order, as a `useState`-shaped pair.
 *
 * Shaped that way so a component that holds a sort switch reads the same as one
 * that held its own state — `const [sort, setSort] = useSortOrder()` — and the
 * switches themselves stay controlled components taking `sort` and `onChange`,
 * which is what lets a DOM-less test render every order without a click.
 */
export function useSortOrder(): readonly [SortOrder, (order: SortOrder) => void] {
  const order = useSyncExternalStore(subscribe, snapshot, snapshot);
  return [order, setSortOrder] as const;
}

/** Forgets the choice. Tests only — nothing on the app clears it. */
export function resetSortOrder(): void {
  setSortOrder(DEFAULT_SORT_ORDER);
}
