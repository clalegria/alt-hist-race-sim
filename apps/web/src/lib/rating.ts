/**
 * The display-only overall rating, re-exported.
 *
 * The weights live in `@alt-hist/data` because the progression tool needs the
 * same number and two copies would be two answers. This module stays so the app
 * keeps one import path for it, and so the reason is written down where a
 * component author looks.
 *
 * `compareByRating` comes with them: the rule for putting drivers or teams in
 * order of how good they are — overall first, racing second — which the editor's
 * bulk rearrangements apply as well as the lists on screen, and which would be
 * two answers for the same reason the weights would be.
 */

export { carOverall, carRacing, compareByRating, driverOverall, type Rated } from "@alt-hist/data";
