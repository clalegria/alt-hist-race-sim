/**
 * Choices the reader makes that outlive a season.
 *
 * All of them are *simulation* inputs rather than display ones — which ratings
 * the field is built from, how much the dice decide, the run settings, and
 * which year a picker opens on.
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
import { parseRandomnessLevel, RANDOMNESS_LEVELS, type RandomnessLevel } from "@alt-hist/engine";
import { HISTORICAL_SETTINGS, parseRunSettings, type RunSettings } from "./run-settings.js";
import { DEFAULT_SEASON_YEAR, isPlayable } from "./seasons.js";

/** Where the choice is remembered between visits. */
const STORAGE_KEY = "alt-hist-rating-mode";

/** The same, for how much the dice decide. */
const RANDOMNESS_KEY = "alt-hist-randomness";

/**
 * The level the setup screen opens on, for a reader who has never chosen one.
 *
 * **Deliberately not the engine's `DEFAULT_RANDOMNESS_LEVEL`.** That one is the
 * reference level, the setting every measurement of the model is made at; this
 * one answers a different question — what makes a good first season for someone
 * who has not yet met the slider — and the answer is one stop up, where the
 * order still holds but is not a foregone conclusion. A reader who moves the
 * slider is remembered and never sees this again.
 *
 * It lives here rather than in the engine because it is a claim about the app.
 * The engine has no opinion about what is fun.
 */
export const STARTING_RANDOMNESS_LEVEL: RandomnessLevel = RANDOMNESS_LEVELS[1] ?? 2;

/** The run settings, as JSON. */
const RUN_SETTINGS_KEY = "alt-hist-run-settings";

/** And for the year a picker opens on — shared by both pickers, see below. */
const YEAR_KEY = "alt-hist-season-year";

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
 * from another version — falls back to `STARTING_RANDOMNESS_LEVEL` rather than
 * throwing. That fallback is the app's opening offer and not the engine's
 * default, which is why `parseRandomnessLevel` is asked for a level and then
 * checked rather than trusted with the fallback itself: it answers with the
 * engine's, which is a different question.
 */
export function readRandomness(): RandomnessLevel {
  if (typeof localStorage === "undefined") {
    return STARTING_RANDOMNESS_LEVEL;
  }
  try {
    const stored = Number(localStorage.getItem(RANDOMNESS_KEY));
    const level = parseRandomnessLevel(stored);
    return level === stored ? level : STARTING_RANDOMNESS_LEVEL;
  } catch {
    return STARTING_RANDOMNESS_LEVEL;
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

/**
 * The year the picker opens on.
 *
 * A third preference of the same kind: not how a table is drawn but what gets
 * simulated. It was deliberately *not* remembered for a while — the year is the
 * question the screen is asking, and opening on wherever someone was last time
 * is a different feature — but that reasoning only held while a run was a
 * one-off. Coming back to the picker to try 1981 after 1980 and being handed
 * 1950 every time is the app forgetting something it was just told, which is
 * exactly what the other two preferences exist to prevent.
 *
 * One key for both pickers rather than one each. A season and an era ask the
 * same question of the same years, and someone who has just been reading the
 * eighties means the eighties whichever mode they start next; splitting it
 * would mean two answers to "which year was I on" and no way to tell which one
 * a screen would use.
 *
 * Validated against the playable list on the way out, not just parsed as a
 * number: a year stored before its season file was removed — or a decade the
 * range no longer draws — must fall back rather than reach `seasonSeed`, which
 * throws on a year nobody authored.
 */
export function readSeasonYear(): number {
  if (typeof localStorage === "undefined") {
    return DEFAULT_SEASON_YEAR;
  }
  try {
    const stored = Number(localStorage.getItem(YEAR_KEY));
    return Number.isInteger(stored) && isPlayable(stored) ? stored : DEFAULT_SEASON_YEAR;
  } catch {
    return DEFAULT_SEASON_YEAR;
  }
}

/** Remembers the year for the next visit to a picker. */
export function rememberSeasonYear(year: number): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  try {
    localStorage.setItem(YEAR_KEY, String(year));
  } catch {
    // Remembering is a convenience; failing to is not worth surfacing.
  }
}

/**
 * The run settings the next run's setup screen opens on.
 *
 * Remembered for the reason the randomness level is: a reader replaying the
 * same what-if should not have to choose it again. Checked with
 * `parseRunSettings`, as the recipe is, so a table that is no longer authored,
 * or anything else in the slot, falls back to the historical settings.
 */
export function readRunSettings(): RunSettings {
  if (typeof localStorage === "undefined") {
    return HISTORICAL_SETTINGS;
  }
  try {
    const stored = localStorage.getItem(RUN_SETTINGS_KEY);
    return (stored === null ? null : parseRunSettings(JSON.parse(stored))) ?? HISTORICAL_SETTINGS;
  } catch {
    return HISTORICAL_SETTINGS;
  }
}

/** Remembers the run settings for the next season or era started. */
export function rememberRunSettings(settings: RunSettings): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  try {
    localStorage.setItem(RUN_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Remembering is a convenience; failing to is not worth surfacing.
  }
}
