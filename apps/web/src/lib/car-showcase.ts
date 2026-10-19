/**
 * Which of a team's cars its page shows: its first of the run, its latest, and
 * one picked from the years between — each only if it looks different from the
 * ones already chosen.
 *
 * A car's look is its decade's drawing and its livery (`lookOf`): two years
 * with the same drawing in the same colours are the same picture, so the second
 * is left out rather than shown twice.
 */

/**
 * The years to draw, oldest first: at most three.
 *
 * `years` is every year the team was on the grid, oldest first. `pick` is a
 * number in [0, 1) choosing among the years between whose look differs from
 * both ends; the caller draws it, so this stays pure.
 */
export function showcaseYears(
  years: readonly number[],
  lookOf: (year: number) => string,
  pick: number,
): number[] {
  const first = years[0];
  const last = years.at(-1);
  if (first === undefined || last === undefined) {
    return [];
  }
  const ends = new Set([lookOf(first), lookOf(last)]);
  const between = years.slice(1, -1).filter((year) => !ends.has(lookOf(year)));
  const middle = between[Math.floor(pick * between.length)];
  const chosen = middle === undefined ? [first, last] : [first, middle, last];
  const seen = new Set<string>();
  return chosen.filter((year) => {
    const look = lookOf(year);
    if (seen.has(look)) {
      return false;
    }
    seen.add(look);
    return true;
  });
}
