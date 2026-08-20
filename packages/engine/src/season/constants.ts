/**
 * Every tunable number in the season model, in one place.
 *
 * Same rule as `race/constants.ts`: no literal magic numbers in the logic, and
 * the tools sweep these rather than editing source.
 */

export interface SeasonConstants {
  /**
   * Championship points by finishing position, best first: index 0 is the win.
   * A position past the end of the table scores nothing, so the length *is* how
   * many places score.
   *
   * This is deliberately a plain array rather than a fixed set of fields,
   * because the scale is the part of the sport that changed most. 1980 paid
   * 9-6-4-3-2-1 to six places; by the late 2010s it was 25-18-15-12-10-8-6-4-2-1
   * to ten, which drops in here as a different array and nothing else.
   *
   * Not modelled, on the author's call: the dropped-scores rule. 1980 counted
   * each driver's best five results from the first seven races and best five
   * from the last seven, so real 1980 totals are lower than every-race totals
   * (Jones scored 71 gross, 67 counted). Every race counts here.
   */
  readonly pointsByPosition: readonly number[];
}

/** Default constants: the 1980 scale. */
export const SEASON_CONSTANTS: SeasonConstants = Object.freeze({
  pointsByPosition: Object.freeze([9, 6, 4, 3, 2, 1]),
});
