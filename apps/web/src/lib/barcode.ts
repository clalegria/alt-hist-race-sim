/**
 * The livery barcode's years: one stripe per season of a team's or a driver's
 * life, from its first season to the year the run has reached, and the decade
 * ticks under it.
 *
 * A life starts before the run where history has it racing earlier: the years
 * before the run's first come off the authored entry lists, the run's own off
 * its revealed grids. Nothing past the cursor is ever a stripe.
 */

import { authoredSeasons, seasonSeed } from "@alt-hist/data";

/** One season of the strip: the team raced for, or undefined for a year sat out. */
export interface Stripe {
  readonly year: number;
  readonly teamId: string | undefined;
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

/** Each team's and each driver's authored seasons, year to team, oldest first. */
interface Entered {
  readonly teams: ReadonlyMap<string, readonly number[]>;
  readonly drivers: ReadonlyMap<string, ReadonlyMap<number, string>>;
}

let entered: Entered | undefined;

/** Every authored season each team and driver is entered in, built once on first use. */
function enteredSeasons(): Entered {
  if (entered === undefined) {
    const teams = new Map<string, number[]>();
    const drivers = new Map<string, Map<number, string>>();
    for (const year of authoredSeasons) {
      for (const { teamId, drivers: driverIds } of seasonSeed(year).entries) {
        const years = teams.get(teamId) ?? [];
        if (years.at(-1) !== year) {
          years.push(year);
        }
        teams.set(teamId, years);
        for (const driverId of driverIds) {
          const career = drivers.get(driverId) ?? new Map<number, string>();
          // One team a year, as the roster has it: the first entry they are listed in.
          if (!career.has(year)) {
            career.set(year, teamId);
          }
          drivers.set(driverId, career);
        }
      }
    }
    entered = { teams, drivers };
  }
  return entered;
}

/** The authored seasons before `year` that `teamId` raced in, oldest first. */
export function seasonsBefore(teamId: string, year: number): number[] {
  return (enteredSeasons().teams.get(teamId) ?? []).filter((each) => each < year);
}

/** The authored seasons before `year` that `driverId` raced in, each to the team they drove for. */
export function driverSeasonsBefore(driverId: string, year: number): Map<number, string> {
  const career = enteredSeasons().drivers.get(driverId) ?? new Map<number, string>();
  return new Map([...career].filter(([each]) => each < year));
}

/** Every year from the first in `raced` to `now`, each with the team raced for or none. */
export function stripesOf(raced: ReadonlyMap<number, string>, now: number): Stripe[] {
  const first = Math.min(...raced.keys());
  if (!Number.isFinite(first) || first > now) {
    return [];
  }
  return Array.from({ length: now - first + 1 }, (_, offset) => ({
    year: first + offset,
    teamId: raced.get(first + offset),
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
