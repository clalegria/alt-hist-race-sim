/**
 * How hard a season is on its cars, as one authored number per year.
 *
 * The car and engine ratings in a season file already carry most of the era: a
 * 1954 field is authored with far lower reliability than a 2018 one, and that
 * alone pulls retirements down as the decades pass. It does not pull them down
 * *far* enough, and it never could. Two things stop it:
 *
 *  - **The mapping from a rating to a failure probability is itself era-bound.**
 *    `mechanicalDnfAtZeroReliability` / `mechanicalDnfAtFullReliability` were
 *    shaped by an era where even a 95-rated car broke regularly. Under those
 *    endpoints a modern grid of 90-rated cars still retires around a fifth of
 *    its starters, which is roughly twice what the 2010s actually did.
 *  - **Driver error has no era term at all.** Composure is an authored career
 *    attribute, not a statement about the year, so the driver-error half of the
 *    retirement rate is the same in 1952 as in 2022. Across the whole pool it is
 *    worth something like 13% of starts on its own — which is *more than a
 *    modern season's entire retirement rate*, so a knob that only touched
 *    mechanical failures could not reach the target no matter how far it turned.
 *
 * So this is one multiplier over *both* retirement rolls, and the fine-tuning
 * layer on top of the ratings rather than a replacement for them. Real driver
 * DNFs range about 5-20% of starts across F1's history and mechanical ones about
 * 10-50%: the two move by a similar factor, which is why one number scales both
 * rather than each getting its own.
 *
 * **Level 5 is exactly 1 and load-bearing.** It returns the constants object
 * itself, by identity, so `constants.ts` still describes the model that
 * runs when a season has not been tuned away from the default — the same
 * guarantee `withRandomness` makes at level 2, and for the same reason.
 *
 * It composes with the randomness slider by construction: that one scales the
 * two noise sigmas, this one scales the two retirement risks, and neither reads
 * a constant the other writes.
 */

import { RACE_CONSTANTS, type RaceConstants } from "./constants.js";

/**
 * How hard a season is on its cars: 1 is the kindest year imaginable, 10 the
 * cruellest, 5 the constants untouched.
 *
 * A 1-10 integer rather than the multiplier itself, for the reason the points
 * scale is an array of numbers and not a formula: it is an *authored* field,
 * one per season file, and a person choosing "this year broke a lot of cars"
 * should be picking off a short scale, not typing 1.44. The mapping below is
 * the engine's business and can be re-shaped without re-authoring 77 files.
 */
export type RetirementFactor = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/** Every factor, lowest first. */
export const RETIREMENT_FACTORS: readonly RetirementFactor[] = Object.freeze([
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
]);

/**
 * What a season uses when it does not say: the constants, untouched.
 */
export const DEFAULT_RETIREMENT_FACTOR: RetirementFactor = 5;

/**
 * What each factor multiplies both retirement risks by: one step is 0.175 of
 * the constants' own rates, so the scale runs from 0.30 at the kindest year to
 * 1.875 at the cruellest, with 5 sitting exactly on 1.
 *
 * **Evenly spaced, and that is not the obvious choice.** A multiplier over a
 * probability would normally want geometric steps — the difference between
 * 0.3 and 0.45 is a much bigger change than between 1.5 and 1.65. It is spaced
 * evenly because what the factor is *for* is not the multiplier but the
 * retirement rate that comes out of it, and over the range the seed data
 * actually occupies that rate is close to linear in the multiplier: a car's
 * failure probability is small enough that two independent rolls barely
 * overlap, so doubling the risks nearly doubles the retirements. Measured on
 * the 1980 grid, the ten stops land about five points of retirement rate apart
 * — 12% at the bottom of the scale, 41% at the default, around 70% at the top —
 * which is what makes the number a usable authoring dial: one step is worth
 * about a twentieth of the field.
 *
 * **The range is set by what the seed data cannot reach on its own.** The
 * authored ratings alone move the simulated rate over a span of about fifteen
 * points across the whole of history — roughly 30% in the 2020s to 45% in the
 * mid-eighties — while the real sport ran from 11.5% in 2013 to 57% in 1968.
 * Everything outside that fifteen-point band has to come from here, which is
 * why the bottom of the scale is as low as 0.3: a modern season needs less than
 * a third of 1980's failure rates on top of ratings that are already the
 * highest on the grid. That is a statement about the two mappings the ratings
 * feed — both shaped by one era, neither with a year in it — rather than about the
 * ratings, and it is the reason this dial does more work than "fine tuning"
 * suggests at the ends of the timeline.
 */
const RETIREMENT_SCALE: Readonly<Record<RetirementFactor, number>> = Object.freeze({
  1: 0.3,
  2: 0.475,
  3: 0.65,
  4: 0.825,
  5: 1.0,
  6: 1.175,
  7: 1.35,
  8: 1.525,
  9: 1.7,
  10: 1.875,
});

/** The multiplier a factor applies to both retirement risks. */
export function retirementScale(factor: RetirementFactor): number {
  return RETIREMENT_SCALE[factor] ?? RETIREMENT_SCALE[DEFAULT_RETIREMENT_FACTOR];
}

/**
 * The constants a season with this retirement factor races on.
 *
 * Both risks are scaled where they are *defined* rather than where they are
 * rolled, so the race model needs no new parameter and no knowledge that
 * seasons differ: `mechanicalDnfEraScale` already exists for exactly this and is
 * multiplied rather than replaced, and the driver-error endpoints are scaled
 * together so the shape of the composure curve is preserved — a wild driver
 * stays proportionally as expensive as a calm one in every era.
 *
 * `simulateRace` clamps both risks into [0, 1] when it rolls them, so a high
 * factor cannot produce a probability above certainty.
 */
export function withRetirementFactor(
  factor: RetirementFactor,
  constants: RaceConstants = RACE_CONSTANTS,
): RaceConstants {
  const scale = retirementScale(factor);
  if (scale === 1) {
    return constants;
  }
  return Object.freeze({
    ...constants,
    mechanicalDnfEraScale: constants.mechanicalDnfEraScale * scale,
    driverErrorDnfAtZeroComposure: constants.driverErrorDnfAtZeroComposure * scale,
    driverErrorDnfAtFullComposure: constants.driverErrorDnfAtFullComposure * scale,
  });
}

/**
 * Narrows an arbitrary number to a factor, for the places one arrives from
 * outside the type system: a season file, a stored save, a command-line flag.
 */
export function parseRetirementFactor(value: unknown): RetirementFactor {
  return RETIREMENT_FACTORS.find((factor) => factor === value) ?? DEFAULT_RETIREMENT_FACTOR;
}
