/**
 * How much the dice decide, as one setting chosen before a run starts.
 *
 * The cheapest large change in how the game feels: one number, threaded from a
 * menu control to the race score, that turns a replay into a what-if without a
 * new model, new data or a new authored field. A season simulated at the same
 * seed under two different levels is a different championship; the same seed and
 * the same level reproduce exactly.
 *
 * **It is a scale factor over the constants, never a replacement for them.**
 * `withRandomness` derives a copy of whatever it is handed; nothing here edits
 * `constants.ts`, and `UNSCALED_RANDOMNESS_LEVEL` hands back the constants
 * object *itself* — no arithmetic at all between `constants.ts` and the race.
 *
 * **Only pace scatter moves.** The factor scales the two noise sigmas and
 * nothing else. Reliability is deliberately left alone — a chaotic season is an
 * unpredictable one, not a season of blown engines — and has settings of its own
 * (`breakdowns.ts`, and the retirement factor). Grid advantage,
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
 * The level anything that has not been told otherwise runs at: `Realistic`.
 *
 * **This is the reference level.** Every measurement worth making about the
 * model — a harness run, a sweep, a driver's season, a figure quoted in a rule
 * file — is made here unless it says otherwise, because it is the setting that
 * asks the model to be a plausible history rather than a good story. The tools
 * take it as their default for exactly that reason.
 *
 * **The web app deliberately opens one stop higher.** A reader arriving at the
 * setup screen is offered `STARTING_RANDOMNESS_LEVEL` (`apps/web/src/lib/
 * preferences.ts`), which is a claim about what makes a good first season and
 * not about what the model is worth. Nothing outside that screen reads it, and
 * nothing inside the engine knows it exists.
 */
export const DEFAULT_RANDOMNESS_LEVEL: RandomnessLevel = 1;

/**
 * The one stop whose scale is exactly 1, and where `withRandomness` therefore
 * hands back the constants object itself rather than a copy of it.
 *
 * A fact about the arithmetic, and worth a name because it is the level to reach
 * for when something needs the constants *as written* — a test asserting the
 * identity, or a comparison that wants the slider taken out of the picture.
 */
export const UNSCALED_RANDOMNESS_LEVEL: RandomnessLevel = 2;

/**
 * What each level multiplies both noise sigmas by.
 *
 * Level 2 is exactly 1 and load-bearing — see the note above. Level 1, the
 * reference level, is a gentle tightening rather than a different model: the
 * field as authored is already close to a replay, so the tamest setting only
 * needs to take the edge off.
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
 * Both sigmas take the same factor on purpose. The three-way form split divides
 * each one by variance, so scaling them together moves all three parts in step
 * and leaves the variance split intact; scaling one alone would quietly
 * re-weight form against luck, which is a different lever.
 */
const NOISE_SCALE: Readonly<Record<RandomnessLevel, number>> = Object.freeze({
  1: 0.85,
  2: 1.0,
  3: 1.25,
  4: 1.65,
  5: 2.5,
});

/**
 * What the top two levels additionally do to the *team* half of the noise.
 *
 * Scaling both sigmas uniformly does not scale upsets uniformly, because the
 * two signals the noise competes against are not the same size. A car gap is
 * worth `weightCarRacing` times itself and a driver gap only
 * `weightDriverRacing` times itself, so the driver signal is much the smaller
 * of the two and a uniform increase drowns it first. Turning the dice up
 * therefore produced mostly *teammate* upsets — a weaker second driver beating
 * a stronger first — when what a chaotic setting should mean is that you cannot
 * tell which car will be quick on Sunday.
 *
 * Boosting the team term specifically buys that. Measured over 2002 and 2011 at
 * level 5, it roughly doubles how often the title goes to a car that is not the
 * best on the grid while moving teammate upsets by two or three points.
 *
 * Left at 1 for levels 1-3, so the shape of the randomness only changes once a
 * run has already opted out of being realistic. This is a multiplier on the
 * team *weight*, not a redistribution, so at 4 and 5 the total noise is a
 * little above the nominal scale — deliberately, since that is the level's
 * whole purpose.
 */
const TEAM_FORM_BOOST: Readonly<Record<RandomnessLevel, number>> = Object.freeze({
  1: 1.0,
  2: 1.0,
  3: 1.0,
  4: 1.2,
  5: 1.35,
});

/** The multiplier a level applies to the race and qualifying sigmas. */
export function randomnessNoiseScale(level: RandomnessLevel): number {
  return NOISE_SCALE[level] ?? NOISE_SCALE[DEFAULT_RANDOMNESS_LEVEL];
}

/** The extra multiplier a level applies to the team-form weight alone. */
export function randomnessTeamFormBoost(level: RandomnessLevel): number {
  return TEAM_FORM_BOOST[level] ?? TEAM_FORM_BOOST[DEFAULT_RANDOMNESS_LEVEL];
}

/**
 * The constants a run at this level races on.
 *
 * Returns `constants` itself at `UNSCALED_RANDOMNESS_LEVEL`, which is both the
 * cheap path and the guarantee: there is no arithmetic between `constants.ts`
 * and the season that runs, so no rounding, no drift, and a test can assert
 * identity rather than approximate equality.
 */
export function withRandomness(
  level: RandomnessLevel,
  constants: RaceConstants = RACE_CONSTANTS,
): RaceConstants {
  const scale = randomnessNoiseScale(level);
  const boost = randomnessTeamFormBoost(level);
  if (scale === 1 && boost === 1) {
    return constants;
  }
  return Object.freeze({
    ...constants,
    qualifyingNoise: constants.qualifyingNoise * scale,
    racingNoise: constants.racingNoise * scale,
    teamFormBoost: constants.teamFormBoost * boost,
  });
}

/**
 * Narrows an arbitrary number to a level, for the two places one arrives from
 * outside the type system: a stored preference and a command-line flag.
 */
export function parseRandomnessLevel(value: unknown): RandomnessLevel {
  return RANDOMNESS_LEVELS.find((level) => level === value) ?? DEFAULT_RANDOMNESS_LEVEL;
}
