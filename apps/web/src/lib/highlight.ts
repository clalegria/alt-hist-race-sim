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
 * For a table row with no position block (the roll of honour's year), which
 * cannot carry a border of its own — so the fill does the whole job and is set
 * stronger than the bordered surface's. A row that has a block carries the
 * accent there instead, and no tint.
 */
export const STANDOUT_ROW = "bg-primary/10";

/** The matching text accent, for the numbers and labels inside. */
export const STANDOUT_TEXT = "text-primary";

/**
 * The position block (`TablePosition`) of the row that won, filled with the
 * accent, like the leader's line on a timing screen.
 *
 * Contains `STANDOUT_TEXT` (`text-primary-foreground`), so a test telling the
 * podium's blocks from the winner's checks for this string's absence.
 */
export const STANDOUT_POSITION = "bg-primary text-primary-foreground";

/**
 * Second and third: the accent one step down, the number alone in the accent on
 * a plain block.
 *
 * A podium is worth marking — it is what the points table is built around — but
 * it is not the win, so the two must be told apart at a glance: filled, then
 * coloured, then nothing. The accent's own text colour rather than a faded one:
 * the block sits on the header's fill, where anything fainter falls below 4.5:1
 * on the light theme.
 */
export const PODIUM_POSITION = STANDOUT_TEXT;
