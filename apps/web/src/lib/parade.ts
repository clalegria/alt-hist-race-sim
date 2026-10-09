/**
 * The home screen's parade: every so often, a few cars from anywhere in the
 * game's history drive across the background, behind the menu.
 *
 * Decoration only. It reads the seed data and never the world, and nothing it
 * does is kept, so it is free to use `Math.random()` — but it takes its random
 * source as a parameter, so the tests can drive it.
 */

import { type Livery, seasons } from "@alt-hist/data";
import { liveryFor } from "./livery.js";

/** How many cars in a pass. */
export const PARADE_SIZE = 3;

/** How long after the home screen opens the first pass sets off, in ms. */
export const FIRST_PASS_MS = 4_000;

/** How often a pass sets off after that, in ms. */
export const PASS_INTERVAL_MS = 30_000;

/**
 * How fast a car crosses the screen, in px per second. A speed rather than a
 * duration, so the gaps between the cars are the same on a phone and on a
 * wide monitor.
 */
export const DRIVE_SPEED_PX_PER_S = 600;

/** The `large` car's width in px (`w-36`, 3× the sprite's 48 pixels). */
export const CAR_WIDTH_PX = 144;

/**
 * The band the lane is drawn from, as fractions of the window's height: clear
 * of the top nav, and leaving room under it for the staggered cars.
 */
export const LANE_TOP = 0.15;
export const LANE_BOTTOM = 0.75;

/** How the cars are spaced: one lane in a line, or three lanes in echelon. */
export type Formation = "file" | "staggered";

/** One car's place in a formation: when it sets off (s), and how far below the lane (rem). */
export interface Slot {
  delay: number;
  offset: number;
}

export const FORMATIONS: Record<Formation, readonly Slot[]> = {
  file: [
    { delay: 0, offset: 0 },
    { delay: 0.45, offset: 0 },
    { delay: 0.9, offset: 0 },
  ],
  staggered: [
    { delay: 0, offset: 0 },
    { delay: 0.15, offset: 3 },
    { delay: 0.3, offset: 6 },
  ],
};

/** One car in a pass: a team in one season, in that season's colours. */
export interface ParadeCar {
  teamId: string;
  year: number;
  livery: Livery;
}

/** Everything one pass needs, decided when it sets off. */
export interface Pass {
  cars: readonly ParadeCar[];
  formation: Formation;
  /** The lane's top, as a fraction of the window's height. */
  lane: number;
  /** How long one car takes to cross, in s. */
  duration: number;
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
function below(n: number, random: () => number): number {
  return Math.min(n - 1, Math.floor(random() * n));
}

/**
 * `PARADE_SIZE` cars from anywhere in history, every one a different team.
 *
 * Drawn uniformly over every entry of every season. A team already in the pass
 * moves the draw on to the next entry rather than drawing again, so it ends
 * whatever the random source does.
 */
export function pickParade(random: () => number): ParadeCar[] {
  const all = paradePool();
  const picked: ParadeCar[] = [];
  while (picked.length < PARADE_SIZE) {
    const start = below(all.length, random);
    let next: ParadeCar | undefined;
    for (let step = 0; step < all.length && next === undefined; step++) {
      const car = all[(start + step) % all.length];
      if (car !== undefined && !picked.some((p) => p.teamId === car.teamId)) {
        next = car;
      }
    }
    // Fewer teams in the whole history than a pass holds.
    if (next === undefined) {
      break;
    }
    picked.push(next);
  }
  return picked;
}

/** A whole pass: the cars, how they are spaced, where, and how fast for this window. */
export function planPass(random: () => number, viewportWidth: number): Pass {
  const formations = Object.keys(FORMATIONS) as Formation[];
  return {
    cars: pickParade(random),
    formation: formations[below(formations.length, random)] ?? "file",
    lane: LANE_TOP + random() * (LANE_BOTTOM - LANE_TOP),
    duration: (viewportWidth + CAR_WIDTH_PX) / DRIVE_SPEED_PX_PER_S,
  };
}
