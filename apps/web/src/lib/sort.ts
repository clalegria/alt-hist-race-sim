/**
 * How a list of teams or drivers is ordered on screen.
 *
 * A *display* choice and nothing more: it reorders a list, it does not change
 * who is in it, and nothing here reaches the simulation. The two orders answer
 * two different questions — "where is Tyrrell in this list" and "who is quick
 * this year" — and the first is the one the grid opens on, because the pecking
 * order is not something the opening page should give away.
 *
 * The rule is a pure function so it can be tested against synthetic ratings,
 * the way `lib/people.ts` tests the pool filters: what an order does is a rule,
 * and a test that reads a real rating fails the day the data is tuned.
 */

import { compareByRating } from "./rating.js";

export type SortOrder = "name" | "overall";

/** What every list opens on. Alphabetical — see the note above. */
export const DEFAULT_SORT_ORDER: SortOrder = "name";

/**
 * Ordered: by name ascending, or by rating descending — best first, because
 * "sorted by rating" means "show me the front of the grid".
 *
 * By rating is `compareByRating`, the app's one ranking rule: **overall first,
 * racing second**. The same rule the run's settings reseat a grid by
 * (*Who drives where*), so a list and a reseat of it cannot disagree about who is quicker.
 * Racing breaks the tie because an overall is a rounded weighted average and
 * racing is most of its weight — ratings are integers on a 1-100 scale, so two
 * cars on 84 are ordinary rather than exotic, and the one with the racing rating
 * is the one the season will treat as the quicker.
 *
 * Name is the last word, and it comes free from sorting by name first and then
 * by rating, since `Array.prototype.sort` is stable. Two rows equal on both
 * ratings then hold still instead of trading places between renders.
 */
export function sortBy<T>(
  items: readonly T[],
  order: SortOrder,
  name: (item: T) => string,
  overall: (item: T) => number,
  racing: (item: T) => number,
): readonly T[] {
  const byName = [...items].sort((a, b) => name(a).localeCompare(name(b)));
  if (order === "name") {
    return byName;
  }
  return byName.sort((a, b) =>
    compareByRating(
      { overall: overall(a), racing: racing(a) },
      { overall: overall(b), racing: racing(b) },
    ),
  );
}
