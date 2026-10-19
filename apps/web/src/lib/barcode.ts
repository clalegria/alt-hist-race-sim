/**
 * The livery barcode's years: one stripe per season of a team's life, from its
 * first season to the year the run has reached, and the decade ticks under it.
 *
 * A team's life starts before the run where history has it racing earlier: the
 * years before the run's first come off the authored entry lists, the run's own
 * off its revealed grids. Nothing past the cursor is ever a stripe.
 */

import { authoredSeasons, seasonSeed } from "@alt-hist/data";

/** One season of the strip; `raced` is false for a year the team sat out. */
export interface Stripe {
  readonly year: number;
  readonly raced: boolean;
}

/** One decade under the strip; `label` is false where its year would run off the end. */
export interface Tick {
  readonly year: number;
  readonly label: boolean;
}

/**
 * Stripes a tick's label needs after it to fit before the strip ends: four
 * mono digits, on the narrowest strip a phone draws.
 */
const LABEL_STRIPES = 6;

let entered: ReadonlyMap<string, readonly number[]> | undefined;

/** Every authored season each team is entered in, oldest first, built once on first use. */
function enteredYears(): ReadonlyMap<string, readonly number[]> {
  if (entered === undefined) {
    const found = new Map<string, number[]>();
    for (const year of authoredSeasons) {
      for (const { teamId } of seasonSeed(year).entries) {
        const years = found.get(teamId) ?? [];
        if (years.at(-1) !== year) {
          years.push(year);
        }
        found.set(teamId, years);
      }
    }
    entered = found;
  }
  return entered;
}

/** The authored seasons before `year` that `teamId` raced in, oldest first. */
export function seasonsBefore(teamId: string, year: number): number[] {
  return (enteredYears().get(teamId) ?? []).filter((each) => each < year);
}

/** Every year from the first `raced` to `now`, each marked raced or sat out. */
export function stripesOf(raced: ReadonlySet<number>, now: number): Stripe[] {
  const first = Math.min(...raced);
  if (!Number.isFinite(first) || first > now) {
    return [];
  }
  return Array.from({ length: now - first + 1 }, (_, offset) => ({
    year: first + offset,
    raced: raced.has(first + offset),
  }));
}

/** The decades from `first` to `last`, each labelled where its year fits before the end. */
export function decadeTicks(first: number, last: number): Tick[] {
  const ticks: Tick[] = [];
  for (let year = Math.ceil(first / 10) * 10; year <= last; year += 10) {
    ticks.push({ year, label: last - year + 1 >= LABEL_STRIPES });
  }
  return ticks;
}
