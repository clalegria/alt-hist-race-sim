/**
 * Choices the reader makes that outlive a season.
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

/** Where the choice is remembered between visits. */
const STORAGE_KEY = "alt-hist-rating-mode";

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
