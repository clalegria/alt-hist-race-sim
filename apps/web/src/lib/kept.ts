/**
 * What *Teams and seats: Keep the starting grid* did to one year, for the grid
 * to say: which teams are ghosts and whose car they race, who kept a seat from
 * last year, who was signed, and which teams are short of drivers.
 *
 * Read off the world's own record — `kept` before the signings, `keptSeats`
 * after — and the year's seed file, never re-derived. Pure.
 */

import type { World } from "../store/season.js";
import { seasonSeed } from "./seasons.js";

export interface KeptNotes {
  /** The era's first year, whose grid every year keeps. */
  readonly from: number;
  /** The ghost entries: team id to the season whose car it races. */
  readonly ghosts: Readonly<Record<string, number>>;
  /** Drivers back in a seat they held last year, where history had someone else or nobody. */
  readonly carried: ReadonlySet<string>;
  /** Drivers signed for a seat that was still empty. */
  readonly signed: ReadonlySet<string>;
  /** Teams running fewer cars than the first year did, and how many; 0 sits the year out. */
  readonly short: readonly { readonly teamId: string; readonly cars: number }[];
}

type KeptInputs = Pick<World, "year" | "gridKeptFrom" | "kept" | "keptSeats">;

const notes = new WeakMap<KeptInputs, KeptNotes | null>();

/**
 * What Keep did to the world's year, or null for a year it did nothing to: a
 * run that does not keep its grid, or an era's first year. Memoised per world.
 */
export function keptNotes(world: KeptInputs): KeptNotes | null {
  const known = notes.get(world);
  if (known !== undefined) {
    return known;
  }
  const { kept, keptSeats, gridKeptFrom } = world;
  const found =
    kept === null || keptSeats === null || gridKeptFrom === null
      ? null
      : (() => {
          const history = new Map(
            seasonSeed(world.year).entries.map((entry) => [entry.teamId, entry.drivers]),
          );
          const carried = new Set<string>();
          const signed = new Set<string>();
          const short: { teamId: string; cars: number }[] = [];
          for (const [teamId, seats] of Object.entries(keptSeats)) {
            const real = history.get(teamId) ?? [];
            const before = kept.seats[teamId] ?? [];
            for (const driverId of seats) {
              if (driverId === null || real.includes(driverId)) {
                continue;
              }
              (before.includes(driverId) ? carried : signed).add(driverId);
            }
            const cars = seats.filter((driverId) => driverId !== null).length;
            if (cars < seats.length) {
              short.push({ teamId, cars });
            }
          }
          return { from: gridKeptFrom, ghosts: kept.ghosts, carried, signed, short };
        })();
  notes.set(world, found);
  return found;
}
