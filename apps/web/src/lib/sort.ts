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

export type SortOrder = "name" | "overall";

/** What every list opens on. Alphabetical — see the note above. */
export const DEFAULT_SORT_ORDER: SortOrder = "name";

/**
 * Ordered: by name ascending, or by overall rating descending — best first,
 * because "sorted by rating" means "show me the front of the grid".
 *
 * Name is always the tie-break. Ratings are integers on a 1-100 scale, so ties
 * are common rather than exotic, and two cars on 84 that trade places between
 * renders is the kind of flicker nobody can explain. Sorting by name first and
 * then by rating gets that for free: `Array.prototype.sort` is stable.
 */
export function sortBy<T>(
  items: readonly T[],
  order: SortOrder,
  name: (item: T) => string,
  overall: (item: T) => number,
): readonly T[] {
  const byName = [...items].sort((a, b) => name(a).localeCompare(name(b)));
  return order === "name" ? byName : byName.sort((a, b) => overall(b) - overall(a));
}
