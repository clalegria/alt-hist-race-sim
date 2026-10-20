/**
 * The app's areas, as the top nav lists them.
 *
 * Data rather than markup, for the reasons `modes.ts` is: an area that is not
 * built yet is a greyed-out entry the reader can see, a future one (Market,
 * Inbox, My team) is a row here rather than a change to the layout, and the nav
 * can be tested without a DOM.
 *
 * **One entry per mode, in the order the menu lists them**, then the pages that
 * are not a mode. The nav and the menu cards are two ways into the same
 * things, so they name the same things in the same order.
 *
 * An area that is the way into a mode **shares that mode's availability**
 * rather than stating its own, so the menu card and the nav entry cannot
 * disagree: the editor's entry lights up the day `edit-ratings` does. It still
 * needs a page to open — `to` — and the route tree types it, so an entry
 * pointing at a URL with no route behind it fails `pnpm typecheck`.
 */

import type { FileRoutesByTo } from "../routeTree.gen.js";
import { MODES, type ModeId } from "./modes.js";

export interface Area {
  readonly label: string;
  /** The page it opens. Absent for an area with no page yet. */
  readonly to?: keyof FileRoutesByTo;
  /** The mode this area is the way into, if any. */
  readonly mode?: ModeId;
}

export const AREAS: readonly Area[] = [
  { label: "Season", to: "/season/new", mode: "season" },
  { label: "Era", to: "/era/new", mode: "era-basic" },
  { label: "Advanced era", mode: "era-advanced" },
  { label: "Game", mode: "game" },
  { label: "Editor", mode: "edit-ratings" },
  // A stub until *publish it*, like the footer's link to it.
  { label: "About" },
];

/** Whether an entry can be followed: it has a page, and its mode is built. */
export function isAvailable(area: Area): boolean {
  if (area.to === undefined) {
    return false;
  }
  const mode = area.mode;
  return (
    mode === undefined || MODES.some((candidate) => candidate.id === mode && candidate.available)
  );
}
