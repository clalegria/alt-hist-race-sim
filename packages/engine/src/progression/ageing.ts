/**
 * The driver ageing curve.
 *
 * One population curve, read at a driver's own pace. `CANONICAL_ABILITY` in
 * `constants.ts` says what an average career looks like against age — a climb
 * that eases the whole way in, a flat stretch through the early thirties, a
 * gentle slope to the early forties, then a fall that keeps steepening. That
 * shape is fixed. What a driver's authored traits do is warp the *age axis*
 * underneath it:
 *
 * ```
 *   real age    22   24   26  27···30···34   36   38   40   43
 *                 \    \   |   |    |    |    |    |    |    |
 *   canonical    22   24   26  27···30···34   36   38   40   43   (an 8-season plateau)
 *   canonical    24   26   27  27···30···34   37   40   43   47   (a 3-season plateau)
 * ```
 *
 * Both rows read the same curve. `peakSeasons` decides how much of the real
 * timeline the plateau covers, and the rise and fall pick up from its edges — so
 * the driver on the second row is at his best for three seasons rather than
 * eight, and everything outside that arrives sooner.
 *
 * `developmentSpeed` and `declineSpeed` then set how fast each row runs outside
 * the plateau. They cannot make the fall from peak steeper than the population's,
 * and that is deliberate: the old model derived the whole shape from the traits,
 * so an ordinary `declineSpeed` could put a 40-year-old 40% below his peak.
 *
 * On top of the age curve sits a second, independent axis — **experience**,
 * counted from the debut season, because being new to the sport is not the same
 * thing as being young — and three authored events: an optional persistent step
 * down, and any number of one-off off-form seasons.
 *
 * Deterministic by design — no `Rng` parameter, and none is coming without a
 * decision from the author. See `constants.ts`.
 */

import type { DriverRatings } from "../model/index.js";
import { AGEING_CONSTANTS, type AgeingConstants } from "./constants.js";
import type { DriverCareer, PeakWindow } from "./types.js";

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

/**
 * A 1–10 trait onto a rate, through its value at 1, 5 and 10.
 *
 * Two straight segments rather than one, because 5 is the nominal driver and has
 * to land exactly on the nominal rate — a single line from 1 to 10 would put the
 * average career slightly off the canonical curve, which is the one property
 * this model is built to guarantee.
 */
function traitRate(trait: number, atOne: number, atFive: number, atTen: number): number {
  const value = clamp(trait, 1, 10);
  return value <= 5 ? lerp(atOne, atFive, (value - 1) / 4) : lerp(atFive, atTen, (value - 5) / 5);
}

/** Half the width, in years, of this driver's own plateau. */
/**
 * The driver's own plateau, in seasons either side of the peak season.
 *
 * `peakSeasons` is a count and is used as one: author 7 and the driver holds a
 * seven-season plateau. An even span cannot be centred exactly; the extra season
 * goes after the peak rather than before, since a driver holds form on longer
 * than they take to find it. Below 1 is treated as 1 — every driver has at least
 * the season they peak in.
 */
function plateauSpan(career: DriverCareer): { before: number; after: number } {
  const seasons = Math.max(1, Math.round(career.peakSeasons));
  const before = Math.floor((seasons - 1) / 2);
  return { before, after: seasons - 1 - before };
}

/** The seasons a driver spends at or near peak — exactly `peakSeasons` of them. */
export function peakWindow(career: DriverCareer): PeakWindow {
  const { before, after } = plateauSpan(career);
  return { start: career.peakSeason - before, end: career.peakSeason + after };
}

/**
 * A real season translated onto the canonical curve's age axis.
 *
 * Four segments, pinned at three points: the driver's plateau start lands on the
 * canonical plateau start, their peak age on the canonical peak, their plateau
 * end on the canonical plateau end. Outside the plateau the axis runs at the
 * driver's own rise or decline rate.
 *
 * The authored plateau is therefore *compressed onto* the canonical one rather
 * than measured against it — which is what lets `peakSeasons` stay a literal
 * count. A three-season plateau squeezes the canonical curve's own flat top into
 * three real years; an eight-season one lays it out one-for-one.
 *
 * Exported because it is the number to look at when a career is not behaving:
 * the progression tool prints it, and "why is he still quick at 44" is answered
 * by "because 44 reads as 38".
 */
export function canonicalAge(
  career: DriverCareer,
  season: number,
  constants: AgeingConstants = AGEING_CONSTANTS,
): number {
  const { plateauStart, peak, plateauEnd } = constants.canonical;
  const age = season - career.birthYear;
  const peakAge = career.peakSeason - career.birthYear;
  const { before, after } = plateauSpan(career);
  const startAge = peakAge - before;
  const endAge = peakAge + after;

  if (age < startAge) {
    const rate = traitRate(
      career.developmentSpeed,
      constants.riseRateAtSpeedOne,
      constants.riseRateAtSpeedFive,
      constants.riseRateAtSpeedTen,
    );
    return plateauStart - (startAge - age) * rate;
  }
  if (age < peakAge) {
    // Reachable only when `before` is above zero: with a plateau that opens on
    // the peak season, `startAge` is `peakAge` and the branch above has it.
    return lerp(plateauStart, peak, (age - startAge) / before);
  }
  if (age <= endAge) {
    return after === 0 ? peak : lerp(peak, plateauEnd, (age - peakAge) / after);
  }
  const rate = traitRate(
    career.declineSpeed,
    constants.declineRateAtSpeedOne,
    constants.declineRateAtSpeedFive,
    constants.declineRateAtSpeedTen,
  );
  return plateauEnd + (age - endAge) * rate;
}

/**
 * The population curve at a canonical age: ability as a fraction of peak.
 *
 * Linear between anchors and flat beyond both ends. The flat ends matter — a
 * career swept from age 18 can warp well off the bottom of the table, and
 * without the clamp the whole column bottoms out at the rating floor.
 */
export function canonicalAbility(
  age: number,
  constants: AgeingConstants = AGEING_CONSTANTS,
): number {
  const anchors = constants.canonicalAbility;
  const first = anchors[0];
  const last = anchors[anchors.length - 1];
  if (first === undefined || last === undefined) {
    return 1;
  }
  if (age <= first.age) {
    return first.ability;
  }
  if (age >= last.age) {
    return last.ability;
  }
  for (let index = 1; index < anchors.length; index += 1) {
    const to = anchors[index];
    const from = anchors[index - 1];
    if (from === undefined || to === undefined || age > to.age) {
      continue;
    }
    return lerp(from.ability, to.ability, (age - from.age) / (to.age - from.age));
  }
  return last.ability;
}

/**
 * How far below peak a driver sits for being new to the sport.
 *
 * Full in the debut season and in every season before it, then fading linearly.
 * Both the size and the fade are set by `developmentSpeed`: this is the axis
 * that makes a rookie season a jumping-off point for one driver and a formality
 * for another. It is always spent by the peak season, whatever the trait says.
 */
function inexperience(career: DriverCareer, season: number, constants: AgeingConstants): number {
  const relief =
    1 - constants.rookieReliefAtSpeedTen * clamp((career.developmentSpeed - 1) / 9, 0, 1);
  // Never past the peak season: a driver cannot still be learning the job in
  // the season he was at his best, and the authored peak has to stay reachable
  // exactly. Without the cap, anyone who peaks inside his first few seasons can
  // never be rated what he is authored at.
  const span = Math.min(
    traitRate(
      career.developmentSpeed,
      constants.adaptationSeasonsAtSpeedOne,
      constants.adaptationSeasonsAtSpeedFive,
      constants.adaptationSeasonsAtSpeedTen,
    ),
    career.peakSeason - career.debutSeason,
  );
  if (span <= 0) {
    return 0;
  }
  const seasonsRacing = season - career.debutSeason;
  const remaining = clamp(1 - seasonsRacing / span, 0, 1);
  return constants.rookieSeasonPenalty * relief * remaining;
}

/** The three buckets a season's shortfall is split across, before sensitivities. */
interface Deficits {
  readonly development: number;
  readonly decline: number;
  readonly form: number;
}

/**
 * The raw shortfall for a season, split by cause.
 *
 * The age curve's shortfall goes to `development` before the peak and to
 * `decline` after it, because those two are the same number meaning opposite
 * things: short of peak on the way up is a driver who has not arrived, short of
 * it on the way down is one who is going, and the sensitivity tables read them
 * differently. Inexperience joins `development` — its story is the same one, and
 * consistency and composure are the last things a newcomer finds.
 *
 * Exported because the terminal tool reports which phase a season is in, and
 * re-deriving that from the ratings would be guesswork.
 */
export function seasonDeficits(
  career: DriverCareer,
  season: number,
  constants: AgeingConstants = AGEING_CONSTANTS,
): Deficits {
  const age = season - career.birthYear;
  const peakAge = career.peakSeason - career.birthYear;
  const shortfall = 1 - canonicalAbility(canonicalAge(career, season, constants), constants);

  let development = inexperience(career, season, constants);
  let decline = 0;
  let form = 0;

  if (age < peakAge) {
    development += shortfall;
  } else {
    decline += shortfall;
  }

  if (career.stepDown !== undefined && season >= career.stepDown.season) {
    decline += clamp(career.stepDown.severity, 0, 1) * constants.stepDownMaxDrop;
  }

  for (const off of career.offSeasons ?? []) {
    if (off.season === season) {
      form += clamp(off.severity, 0, 1) * constants.offSeasonMaxDrop;
    }
  }

  return { development, decline, form };
}

const ATTRIBUTES = [
  "racing",
  "qualifying",
  "consistency",
  "adaptability",
  "composure",
] as const satisfies readonly (keyof DriverRatings)[];

/**
 * A driver's ratings in a given season.
 *
 * Seasons outside the career are answered rather than refused: the terminal tool
 * sweeps whole lifetimes, and a career is a window on a curve that exists either
 * side of it. Before the debut the curve keeps falling away as it goes back, so
 * a driver is never better in the years before his first race than in it.
 */
export function ratingsForSeason(
  career: DriverCareer,
  season: number,
  constants: AgeingConstants = AGEING_CONSTANTS,
): DriverRatings {
  const deficits = seasonDeficits(career, season, constants);

  const rated = {} as Record<keyof DriverRatings, number>;
  for (const attribute of ATTRIBUTES) {
    const deficit =
      deficits.development * constants.developmentSensitivity[attribute] +
      deficits.decline * constants.declineSensitivity[attribute] +
      deficits.form;
    rated[attribute] = Math.round(
      clamp(career.peak[attribute] * (1 - deficit), constants.minRating, constants.maxRating),
    );
  }

  return rated;
}
