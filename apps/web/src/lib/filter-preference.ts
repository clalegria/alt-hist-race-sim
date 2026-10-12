/**
 * How the reader likes the pool narrowed, remembered between visits.
 *
 * The editor is opened and closed constantly — every applied grid re-simulates
 * the season and re-mounts the page behind it — so filters held in component
 * state are filters set again every single time. Widening the age range to
 * reach a driver from another decade is four interactions, and having to repeat
 * them on the next visit to the same screen is the app forgetting something it
 * was just told.
 *
 * **One set, not one per rating mode.** The two modes do read the age range
 * differently — season age in `aged`, peak age in `peak`, see `ratedAge` — and
 * that is a reason for the *defaults* to differ, which they do. It is not a
 * reason to throw away an answer the reader gave: someone who narrows the pool
 * and then flips to peak ratings to see the same people at their best has not
 * asked for their filters back. The mode picks what the panel opens on;
 * `useReserveFilters` re-lays that default only while nothing has ever been stored, and
 * `hasStoredDriverFilters` is how it knows.
 *
 * `localStorage` rather than the session, and that is the difference from
 * `sort-preference.ts` next door: an order is a way of reading one list, but how
 * wide the pool is opened is a standing answer to "which drivers am I playing
 * with", closer in kind to the ability mode in `preferences.ts`. A stored set
 * cannot strand anybody either — the panel is on screen with the values in it,
 * and the list states both counts.
 *
 * Storage access is wrapped exactly as `theme.ts` wraps it: it throws outright
 * in Safari's private browsing and in embeddings that block third-party storage,
 * and is simply absent under Vitest, which runs without a DOM.
 */

import type { RatingMode } from "@alt-hist/data";
import { clampAge, type DriverFilters, defaultDriverFilters } from "./people.js";

const STORAGE_KEY = "alt-hist-driver-filters";

/**
 * A stored set, falling back field by field rather than all-or-nothing.
 *
 * Field by field because the shape can grow: a fourth filter added later would
 * make every set already stored unreadable if a missing key threw the lot away,
 * and the reader would silently lose the other three. Anything that is not the
 * type it should be takes the given mode's default instead.
 *
 * The ages come back through `clampAge` and are then put the right way round, so
 * a hand-edited or stale value cannot produce a range that hides everybody with
 * nothing on screen explaining why.
 */
export function parseDriverFilters(raw: string | null, mode: RatingMode): DriverFilters {
  const fallback = defaultDriverFilters(mode);
  if (raw === null) {
    return fallback;
  }
  let stored: unknown;
  try {
    stored = JSON.parse(raw);
  } catch {
    return fallback;
  }
  if (typeof stored !== "object" || stored === null) {
    return fallback;
  }
  const fields = stored as Partial<Record<keyof DriverFilters, unknown>>;
  const bool = (value: unknown, whenMissing: boolean): boolean =>
    typeof value === "boolean" ? value : whenMissing;
  const age = (value: unknown, whenMissing: number): number =>
    typeof value === "number" && Number.isFinite(value) ? clampAge(value) : whenMissing;

  const minAge = age(fields.minAge, fallback.minAge);
  const maxAge = age(fields.maxAge, fallback.maxAge);
  return {
    hideRetired: bool(fields.hideRetired, fallback.hideRetired),
    hideFuture: bool(fields.hideFuture, fallback.hideFuture),
    minAge: Math.min(minAge, maxAge),
    maxAge: Math.max(minAge, maxAge),
  };
}

/**
 * How the pool should open: what was last set, or this mode's defaults.
 *
 * The mode is read only for that fallback — a stored set is the reader's answer,
 * and it is handed back whichever mode asks for it.
 */
export function readDriverFilters(mode: RatingMode): DriverFilters {
  if (typeof localStorage === "undefined") {
    return defaultDriverFilters(mode);
  }
  try {
    return parseDriverFilters(localStorage.getItem(STORAGE_KEY), mode);
  } catch {
    return defaultDriverFilters(mode);
  }
}

/**
 * Whether the reader has ever narrowed the pool by hand.
 *
 * The one thing a caller can ask that `readDriverFilters` cannot answer, since a
 * stored set that happens to equal the defaults is indistinguishable from none.
 * It gates the only remaining case where the app changes the filters by itself:
 * a mode switch re-lays the new mode's defaults while there is nothing to lose,
 * and never afterwards.
 */
export function hasStoredDriverFilters(): boolean {
  if (typeof localStorage === "undefined") {
    return false;
  }
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

/** Remembers a set for the next time the editor is opened, in either mode. */
export function rememberDriverFilters(filters: DriverFilters): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  } catch {
    // Remembering is a convenience; failing to is not worth surfacing.
  }
}

/** Forgets the set. Tests only — nothing on the app clears it. */
export function resetDriverFilters(): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // As above.
  }
}
