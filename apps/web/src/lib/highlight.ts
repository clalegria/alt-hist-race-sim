/**
 * The accent given to whoever won the thing on screen.
 *
 * Pole on the grid, the winner of a race, and each champion on the summary are
 * the same idea shown four ways, so they share one definition rather than three
 * near-copies that drift apart. Change the look here and it changes everywhere.
 */

/** For anything that draws its own border: a grid slot, a card. */
export const STANDOUT_SURFACE = "border-primary/40 bg-primary/5";

/**
 * For a table row, which cannot carry a rounded border of its own — so the fill
 * does the whole job and is set stronger than the bordered surface's.
 */
export const STANDOUT_ROW = "bg-primary/10";

/** The matching text accent, for the numbers and labels inside. */
export const STANDOUT_TEXT = "text-primary";

/**
 * Second and third: the same accent, one step down.
 *
 * A podium is worth marking — it is what the points table is built around — but
 * it is not the win, so the two must be told apart at a glance. The gradient is
 * the whole design: the winner's fill, then a little under half of it, then
 * nothing. Deliberately *not* a fraction of `STANDOUT_ROW`'s own string, so the
 * accent-counting tests can still tell the two apart by substring.
 *
 * `PODIUM_TEXT` does contain `STANDOUT_TEXT`; anything counting occurrences of
 * the latter in a classification has to account for that.
 */
export const PODIUM_ROW = "bg-primary/[0.045]";
export const PODIUM_TEXT = "text-primary/70";
