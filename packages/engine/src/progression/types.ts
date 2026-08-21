/**
 * The authored shape of a driver's career, as the ageing curve needs it.
 *
 * Declared here rather than imported from `@alt-hist/data` because the engine
 * imports nothing outside itself. `packages/data` builds one of these from its
 * JSON and passes it in — the same type-only seam `buildField` already uses.
 */

import type { DriverRatings } from "../model/index.js";

/** A career-ending step down that the normal decline curve would not produce. */
export interface SteepDecline {
  /** The first season the drop applies to. It persists from then on. */
  readonly season: number;
  /** 0–1, scaled by `steepDeclineMaxDrop`. */
  readonly severity: number;
}

/** A single season below the driver's own standard. Does not persist. */
export interface OffSeason {
  readonly season: number;
  /** 0–1, scaled by `offSeasonMaxDrop`. */
  readonly severity: number;
}

export interface DriverCareer {
  /** First season in the sport. Carries an extra rookie penalty on its own. */
  readonly debutSeason: number;
  /** The single season the driver is at 100% of the ratings below. */
  readonly peakSeason: number;
  /**
   * How many seasons the driver spends at or very near their peak, centred on
   * `peakSeason`. 1 means a single season; 7 means three either side.
   */
  readonly peakSeasons: number;
  /** 1–10. Shapes the rise from debut to plateau; see `ageing.ts`. */
  readonly developmentSpeed: number;
  /** 1–10. How fast ability falls away once the plateau ends. */
  readonly declineSpeed: number;
  /** The ratings the driver holds in `peakSeason`, before any modifier. */
  readonly peak: DriverRatings;
  readonly steepDecline?: SteepDecline;
  readonly offSeasons?: readonly OffSeason[];
}

/** The window a driver spends at or near peak, inclusive at both ends. */
export interface PeakWindow {
  readonly start: number;
  readonly end: number;
}
