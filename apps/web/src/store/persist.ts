/**
 * Keeps the run in `localStorage`, so it survives a reload and a closed tab and
 * ends only when the reader exits it.
 *
 * What is stored is the run's recipe (`recipe.ts`), never its worlds: a long era
 * as JSON would outgrow the few megabytes `localStorage` allows, and the recipe
 * rebuilds it exactly.
 *
 * **Saved by subscription, not by each action.** One listener writes whenever
 * `run` changes, so Continue, a jump, a grid edit, a restart and Exit are all
 * covered without any of them knowing about storage, and an action added later
 * cannot forget to save.
 *
 * Started once, from `main.tsx`, before the router exists — so a reload onto
 * `/run/…` finds the run already in the store when the route guard looks. The
 * store module itself never touches storage, which keeps its tests free of it.
 *
 * Storage access is wrapped as `lib/preferences.ts` wraps it: absent under
 * Vitest, and throwing in private browsing. Failing to save loses the reload,
 * never the run.
 */

import { recipeOf, runFromRecipe } from "./recipe.js";
import { useSeasonStore } from "./season.js";

/** Where the run in progress is kept. One slot: this is not the save-file feature. */
export const RUN_KEY = "alt-hist-run";

function read(): string | null {
  if (typeof localStorage === "undefined") {
    return null;
  }
  try {
    return localStorage.getItem(RUN_KEY);
  } catch {
    return null;
  }
}

function write(value: string | null): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  try {
    if (value === null) {
      localStorage.removeItem(RUN_KEY);
    } else {
      localStorage.setItem(RUN_KEY, value);
    }
  } catch {
    // Too full or blocked: the run goes on, it just will not survive a reload.
  }
}

/** The stored value parsed, or `undefined` when it is not JSON at all. */
function parse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/**
 * Restores the saved run into the store, then saves every change to it.
 * Returns the unsubscribe, for tests.
 *
 * A saved run this build cannot rebuild is dropped and `resumeFailed` raised, so
 * Home can say so instead of the run silently vanishing.
 */
export function startRunPersistence(): () => void {
  const saved = read();
  if (saved !== null) {
    const run = runFromRecipe(parse(saved));
    if (run === null) {
      write(null);
      useSeasonStore.setState({ resumeFailed: true });
    } else {
      useSeasonStore.setState({ run });
    }
  }
  return useSeasonStore.subscribe((state, previous) => {
    if (state.run === previous.run) {
      return;
    }
    write(state.run === null ? null : JSON.stringify(recipeOf(state.run)));
    if (state.run !== null && state.resumeFailed) {
      // A new run answers the notice about the old one.
      useSeasonStore.setState({ resumeFailed: false });
    }
  });
}
