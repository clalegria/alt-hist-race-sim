/**
 * The display-only overall rating, re-exported.
 *
 * The weights live in `@alt-hist/data` because the progression tool needs the
 * same number and two copies would be two answers. This module stays so the app
 * keeps one import path for it, and so the reason is written down where a
 * component author looks.
 */

export { carOverall, driverOverall } from "@alt-hist/data";
