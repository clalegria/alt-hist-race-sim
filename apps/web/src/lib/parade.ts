/**
 * The home screen's parade: cars from anywhere in the game's history, lapping
 * the track along the foot of Home (`track.ts` moves them), with a hidden game
 * for whoever presses one.
 *
 * Decoration only. It reads the seed data and never the world, and nothing it
 * does is kept, so it is free to use `Math.random()` — but it takes its random
 * source as a parameter, so the tests can drive it.
 */

import { type Livery, seasons } from "@alt-hist/data";
import { liveryFor } from "./livery.js";
import { teamName } from "./names.js";

/** One car in the parade: a team in one season, in that season's colours. */
export interface ParadeCar {
  teamId: string;
  year: number;
  livery: Livery;
}

let pool: readonly ParadeCar[] | undefined;

/** Every team's entry in every authored season, built once on first use. */
function paradePool(): readonly ParadeCar[] {
  if (pool === undefined) {
    const cars: ParadeCar[] = [];
    for (const [year, seed] of seasons) {
      for (const { teamId } of seed.entries) {
        const livery = liveryFor(teamId, year);
        if (livery !== undefined) {
          cars.push({ teamId, year, livery });
        }
      }
    }
    pool = cars;
  }
  return pool;
}

/** A whole number in `[0, n)` from a source of numbers in `[0, 1)`. */
export function below(n: number, random: () => number): number {
  return Math.min(n - 1, Math.floor(random() * n));
}

/**
 * `count` cars from anywhere in history, every one a different team and none
 * of the teams in `taken` (the ones already on track).
 *
 * Drawn uniformly over every entry of every season. A team already picked
 * moves the draw on to the next entry rather than drawing again, so it ends
 * whatever the random source does.
 */
export function pickCars(
  random: () => number,
  count: number,
  taken: readonly string[] = [],
): ParadeCar[] {
  const all = paradePool();
  const teams = new Set(taken);
  const picked: ParadeCar[] = [];
  while (picked.length < count) {
    const start = below(all.length, random);
    let next: ParadeCar | undefined;
    for (let step = 0; step < all.length && next === undefined; step++) {
      const car = all[(start + step) % all.length];
      if (car !== undefined && !teams.has(car.teamId)) {
        next = car;
      }
    }
    // Every team in the whole history is already taken.
    if (next === undefined) {
      break;
    }
    picked.push(next);
    teams.add(next.teamId);
  }
  return picked;
}

/**
 * The parade's hidden game. Pointing at a car names it (the tooltip, which is
 * the component's); a press on a car stops the field and pins that tooltip
 * where it was pressed, and letting go turns the cars round. Every press and
 * release turns them again. A press that is cancelled (the page scrolled, the
 * window lost focus) turns nothing.
 */
export interface ParadeGame {
  /** A press that began on a car and has not yet been let go. */
  pressed: boolean;
  /** Driving right to left, the cars drawn mirrored. */
  reversed: boolean;
}

export const PARADE_START: ParadeGame = { pressed: false, reversed: false };

/**
 * The game after a press on a car, a release anywhere, or a cancelled press:
 * the same object when nothing changes.
 */
export function nextGame(game: ParadeGame, event: "press" | "release" | "cancel"): ParadeGame {
  if (event === "press") {
    return game.pressed ? game : { ...game, pressed: true };
  }
  if (!game.pressed) {
    return game;
  }
  return { pressed: false, reversed: event === "release" ? !game.reversed : game.reversed };
}

/**
 * What a car's tooltip says: its team as named that year, and the year. A run's
 * page passes its own `nameOf`, which knows a team renamed in the run.
 */
export function carLabel(
  car: Pick<ParadeCar, "teamId" | "year">,
  nameOf: (teamId: string, year: number) => string = teamName,
): string {
  return `${nameOf(car.teamId, car.year)} (${car.year})`;
}
