/**
 * The accent given to whoever won the thing on screen.
 *
 * Pole on the grid, the winner of a race, and each champion on the summary are
 * the same idea shown four ways, so they share one definition rather than three
 * near-copies that drift apart. Change the look here and it changes everywhere.
 */

/** For anything that draws its own border: a grid slot, a card. */
export const STANDOUT_SURFACE = "border-primary/40 bg-primary/5";

/** For a table row, which cannot carry a rounded border of its own. */
export const STANDOUT_ROW = "bg-primary/5";

/** The matching text accent, for the numbers and labels inside. */
export const STANDOUT_TEXT = "text-primary";
