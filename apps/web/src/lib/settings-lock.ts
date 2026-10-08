import { isUntouched, type Run } from "../store/season.js";

/** Why the grid's settings dialog is read-only while the grid editor is open. */
export const EDITING_LOCK = "Finish or cancel the grid edit first.";

/**
 * Why a run's settings can no longer be changed from its grid, or null while
 * they still can: the run is untouched (`isUntouched`) — its first grid, as
 * entered. The reason names the way back where there is one: an edited first
 * grid becomes changeable again once its edits are cleared.
 *
 * The grid editor being open is the page's own state, not the run's, so the
 * page adds `EDITING_LOCK` on top of this.
 */
export function settingsLock(run: Run): string | null {
  if (isUntouched(run)) {
    return null;
  }
  const firstGrid =
    run.cursor.kind === "grid" && (run.kind === "season" || run.run.seasons.length === 0);
  return firstGrid
    ? "Fixed while the grid is edited. Clear all edits to change them."
    : `Fixed once the ${run.kind} is under way.`;
}
