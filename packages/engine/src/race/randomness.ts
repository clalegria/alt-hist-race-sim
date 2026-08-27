/**
 * How much the dice decide, as one setting chosen before a run starts.
 *
 * The cheapest large change in how the game feels: one number, threaded from a
 * menu control to the race score, that turns a replay into a what-if without a
 * new model, new data or a new authored field. A season simulated at the same
 * seed under two different levels is a different championship; the same seed and
 * the same level reproduce exactly.
 *
 * **It is a scale factor over the calibrated constants, never a replacement for
 * them.** `withRandomness` derives a copy of whatever it is handed; nothing here
 * edits `constants.ts`, and the balanced level returns the constants object
 * *itself*, unchanged and by identity. That is what keeps the calibration a true
 * description of the default: the measured season is still the season the model
 * runs when nobody has touched the slider. The other four levels are not
 * calibrated against anything and are not meant to be — they are a taste
 * setting, not a fit.
 *
 * **Only pace scatter moves.** The factor scales the two noise sigmas and
 * nothing else. Reliability is deliberately left alone — a chaotic season is an
 * unpredictable one, not a season of blown engines — and is expected to get its
 * own separate setting rather than being folded into this one. Grid advantage,
 * home advantage, the consistency penalty and the powertrain weights are all
 * untouched for the same reason: they are what a rating *means*, and this is a
 * knob over the noise, not over the field.
 */

import { RACE_CONSTANTS, type RaceConstants } from "./constants.js";

/**
 * The five stops on the slider, ordered from tamest to wildest.
 *
 * A number rather than a name because the ordering is the whole point of the
 * control — 4 is more than 3 in a way that "more exciting" is not obviously more
 * than "exciting" — and because a save file holding `3` needs no vocabulary to
 * survive a rename of the label above it.
 */
export type RandomnessLevel = 1 | 2 | 3 | 4 | 5;

/** Every level, in slider order. The UI's tick marks are read off this. */
export const RANDOMNESS_LEVELS: readonly RandomnessLevel[] = Object.freeze([1, 2, 3, 4, 5]);

/**
 * The level a run uses when nobody has chosen: the calibrated model exactly as
 * it was measured.
 */
export const DEFAULT_RANDOMNESS_LEVEL: RandomnessLevel = 2;

/**
 * What each level multiplies both noise sigmas by.
 *
 * Level 2 is exactly 1 and load-bearing — see the note above. Level 1 is a
 * gentle tightening rather than a different model: the field as authored is
 * closer to a replay, so the tamest setting only needs to take the edge off.
 *
 * The three above it climb steeply, and the first attempt at them (1.2 / 1.45 /
 * 1.9) did not: a *season* averages its noise away over a dozen-odd rounds, so
 * scatter that visibly changes a single afternoon barely touches who ends the
 * year on top. Measured over 1980 and 2010, the favourite took the title 49% of
 * the time at level 2 and still 39% at the old top setting — recognisably the
 * same championship. These factors are set from where that curve actually
 * moves: at 3.0 the favourite takes ~30%, twenty different drivers win a title
 * across a run of seasons rather than seven, and every car on the grid wins a
 * race sooner or later.
 *
 * Past 3.0 it flattens out rather than getting wilder, because what is left
 * concentrating the titles is reliability rather than pace — and this setting
 * deliberately does not touch that.
 *
 * Both sigmas take the same factor on purpose. `weekendFormShare` splits each
 * one into form and session luck by variance, so scaling them together moves the
 * two halves in step and leaves the calibrated split intact; scaling one alone
 * would quietly re-weight form against luck, which is a different lever.
 */
const NOISE_SCALE: Readonly<Record<RandomnessLevel, number>> = Object.freeze({
  1: 0.85,
  2: 1.0,
  3: 1.5,
  4: 2.1,
  5: 3.0,
});

/** The multiplier a level applies to the race and qualifying sigmas. */
export function randomnessNoiseScale(level: RandomnessLevel): number {
  return NOISE_SCALE[level] ?? NOISE_SCALE[DEFAULT_RANDOMNESS_LEVEL];
}

/**
 * The constants a run at this level races on.
 *
 * Returns `constants` itself at the balanced level, which is both the cheap path
 * and the guarantee: there is no arithmetic between the calibrated numbers and
 * the default season, so no rounding, no drift, and a test can assert identity
 * rather than approximate equality.
 */
export function withRandomness(
  level: RandomnessLevel,
  constants: RaceConstants = RACE_CONSTANTS,
): RaceConstants {
  const scale = randomnessNoiseScale(level);
  if (scale === 1) {
    return constants;
  }
  return Object.freeze({
    ...constants,
    qualifyingNoise: constants.qualifyingNoise * scale,
    racingNoise: constants.racingNoise * scale,
  });
}

/**
 * Narrows an arbitrary number to a level, for the two places one arrives from
 * outside the type system: a stored preference and a command-line flag.
 */
export function parseRandomnessLevel(value: unknown): RandomnessLevel {
  return RANDOMNESS_LEVELS.find((level) => level === value) ?? DEFAULT_RANDOMNESS_LEVEL;
}
