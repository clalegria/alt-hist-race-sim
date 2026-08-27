/**
 * Choices the reader makes that outlive a season.
 *
 * Two of them so far, and both are *simulation* inputs rather than display
 * ones — which ratings the field is built from, and how much the dice decide.
 * That is what separates this module from `sort-preference.ts`: those are ways
 * of reading a list, these are answers the next season is run against.
 *
 * Which drivers to race — authored peaks or their ability in the season — is a
 * decision about how someone wants to play, not a property of one championship.
 * Picking "at their age" and then being handed peak ratings by the next season
 * they start is the app forgetting something it was told.
 *
 * The world still owns the mode it was *built* with; this is only the seed for
 * the next one. That split matters: a finished season must keep reporting the
 * ratings it actually raced, whatever the reader has chosen since.
 *
 * Storage access is wrapped exactly as `theme.ts` wraps it — it throws outright
 * in Safari's private browsing and in embeddings that block third-party storage,
 * and is simply absent under Vitest, which runs without a DOM.
 */

import { DEFAULT_RATING_MODE, RATING_MODES, type RatingMode } from "@alt-hist/data";
import {
  DEFAULT_RANDOMNESS_LEVEL,
  parseRandomnessLevel,
  type RandomnessLevel,
} from "@alt-hist/engine";

/** Where the choice is remembered between visits. */
const STORAGE_KEY = "alt-hist-rating-mode";

/** The same, for how much the dice decide. */
const RANDOMNESS_KEY = "alt-hist-randomness";

/**
 * Reads a stored value, falling back for anything that is not a known mode.
 *
 * Derived from `RATING_MODES` rather than listing the modes again, so a third
 * one becomes valid here the moment the data package declares it.
 */
export function parseRatingMode(raw: string | null): RatingMode {
  return RATING_MODES.find((mode) => mode === raw) ?? DEFAULT_RATING_MODE;
}

/** The mode a newly started season should use. */
export function readRatingMode(): RatingMode {
  if (typeof localStorage === "undefined") {
    return DEFAULT_RATING_MODE;
  }
  try {
    return parseRatingMode(localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_RATING_MODE;
  }
}

/** Remembers a mode for the next season started. */
export function rememberRatingMode(mode: RatingMode): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Remembering is a convenience; failing to is not worth surfacing.
  }
}

/**
 * How random the next run should be.
 *
 * Kept beside the ability mode rather than with the display preferences,
 * because it is the same *kind* of choice: not how a table is drawn but what
 * gets simulated. Both are read once, when a season or an era is started, and
 * both belong to the reader rather than to any one championship — a season
 * already run keeps the level it actually raced at, whatever is chosen after.
 *
 * `localStorage` for that reason too: someone who plays chaotic should be handed
 * chaotic next time, not walked back to the default by closing a tab.
 *
 * Stored as its digit, so a level survives any renaming of the words drawn above
 * the slider. Anything else in the slot — a level that no longer exists, a value
 * from another version — falls back to the default rather than throwing.
 */
export function readRandomness(): RandomnessLevel {
  if (typeof localStorage === "undefined") {
    return DEFAULT_RANDOMNESS_LEVEL;
  }
  try {
    return parseRandomnessLevel(Number(localStorage.getItem(RANDOMNESS_KEY)));
  } catch {
    return DEFAULT_RANDOMNESS_LEVEL;
  }
}

/** Remembers a level for the next season or era started. */
export function rememberRandomness(level: RandomnessLevel): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  try {
    localStorage.setItem(RANDOMNESS_KEY, String(level));
  } catch {
    // Remembering is a convenience; failing to is not worth surfacing.
  }
}
