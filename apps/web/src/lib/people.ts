/**
 * Ages and the pool filters, re-exported.
 *
 * The rules live in `@alt-hist/data` because the grid's bulk rules need the same
 * answer to "which drivers is this reader playing with" — `arrange.ts` reads
 * `matchesFilters` against the very same set the pool list is narrowed by, and
 * two copies of it would be two answers. This module stays so the app keeps one
 * import path for them, and so the reason is written down where a component
 * author looks. Exactly the arrangement `lib/rating.ts` has.
 */

export {
  AGE_RANGE,
  ageInSeason,
  clampAge,
  DEFAULT_DRIVER_FILTERS,
  type DriverFilters,
  defaultDriverFilters,
  filterDrivers,
  matchesFilters,
  peakAge,
  ratedAge,
  withAge,
} from "@alt-hist/data";
