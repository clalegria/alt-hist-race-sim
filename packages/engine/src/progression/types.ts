/**
 * The authored shape of a driver's career, as the ageing curve needs it.
 *
 * Declared here rather than imported from `@alt-hist/data` because the engine
 * imports nothing outside itself. `packages/data` builds one of these from its
 * JSON and passes it in — the same type-only seam `buildField` already uses.
 */

import type { DriverRatings } from "../model/index.js";

/** A career-ending step down that the normal decline curve would not produce. */
export interface StepDown {
  /** The first season the drop applies to. It persists from then on. */
  readonly season: number;
  /** 0–1, scaled by `stepDownMaxDrop`. */
  readonly severity: number;
}

/** A single season below the driver's own standard. Does not persist. */
export interface OffSeason {
  readonly season: number;
  /**
   * Scaled by `offSeasonMaxDrop`, and **not capped at 1**: 1 is one full
   * off-season's worth of drop, 2 is twice that, and an author who wants a
   * driver unrecognisable for a year can say so. Negative is meaningless and
   * treated as 0.
   */
  readonly severity: number;
}

export interface DriverCareer {
  /**
   * The year of birth, which is what makes the curve an *age* curve.
   *
   * The population shape in `constants.ts` is defined against age, so every
   * season has to be turned into one before anything else can happen. It is
   * carried here rather than derived from the debut because age and experience
   * are separate axes: a 28-year-old rookie and a 19-year-old rookie sit in very
   * different places on the ability curve and in the same place on the other.
   */
  readonly birthYear: number;
  /** First season in the sport. Carries an extra rookie penalty on its own. */
  readonly debutSeason: number;
  /** The single season the driver is at 100% of the ratings below. */
  readonly peakSeason: number;
  /**
   * How many seasons the driver spends at or very near their peak, centred on
   * `peakSeason`. A literal count: 1 means a single season, 7 means seven, and
   * `peakWindow` returns exactly that many. An even span puts its extra season
   * after the peak rather than before.
   */
  readonly peakSeasons: number;
  /** 1–10. Shapes the rise from debut to plateau; see `ageing.ts`. */
  readonly developmentSpeed: number;
  /** 1–10. How fast ability falls away once the plateau ends. */
  readonly declineSpeed: number;
  /** The ratings the driver holds in `peakSeason`, before any modifier. */
  readonly peak: DriverRatings;
  readonly stepDown?: StepDown;
  readonly offSeasons?: readonly OffSeason[];
}

/** The window a driver spends at or near peak, inclusive at both ends. */
export interface PeakWindow {
  readonly start: number;
  readonly end: number;
}
