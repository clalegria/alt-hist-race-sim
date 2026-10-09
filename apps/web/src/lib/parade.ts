/**
 * The home screen's parade: every so often, a few cars from anywhere in the
 * game's history drive across the screen — behind the menu where there is room
 * to see them, in front of it where there is not.
 *
 * Decoration only. It reads the seed data and never the world, and nothing it
 * does is kept, so it is free to use `Math.random()` — but it takes its random
 * source as a parameter, so the tests can drive it.
 */

import { type Livery, seasons } from "@alt-hist/data";
import { liveryFor } from "./livery.js";
import { teamName } from "./names.js";

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

/** The `large` car's size in px (`w-36 h-10.5`, 3× the sprite's 48×14 pixels). */
export const CAR_WIDTH_PX = 144;
export const CAR_HEIGHT_PX = 42;

/**
 * How much of a car's crossing must be in the open for its lane to run behind
 * the page, as a share of the window's width. The rest is behind the opaque
 * covers (`PARADE_COVER`).
 */
export const MIN_VISIBLE_SHARE = 0.2;

/** How finely the window's height is searched for an open lane, in px. */
export const LANE_STEP_PX = 4;

/**
 * Where a pass runs in front of the page, having found no open lane behind it,
 * as fractions of the window's height: clear of the top nav, and leaving room
 * under it for the staggered cars.
 */
export const FRONT_LANE_TOP = 0.15;
export const FRONT_LANE_BOTTOM = 0.75;

/**
 * Marks an element a car behind the page cannot be seen through — the mode
 * cards, the resume card, the top nav. Spread onto the element.
 */
export const PARADE_COVER = { "data-parade-cover": "" } as const;
export const PARADE_COVER_SELECTOR = "[data-parade-cover]";

/** How the cars are spaced: one lane in a line, or three lanes in echelon. */
export type Formation = "file" | "staggered";

/** One car's place in a formation: when it sets off (s), and how far below the lane (px). */
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
    { delay: 0.15, offset: 48 },
    { delay: 0.3, offset: 96 },
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
  /** The lane's top, in px from the top of the window. */
  lane: number;
  /** Over the page rather than under it: no lane behind it was open. */
  inFront: boolean;
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

/** Where an element sits in the window, in px, as `getBoundingClientRect` gives it. */
export interface Box {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * The share of a car's crossing at `top` that is in the open: the window's
 * width less what the covers overlapping that row hide of it.
 */
export function visibleShare(top: number, covers: readonly Box[], viewportWidth: number): number {
  const spans = covers
    .filter((box) => box.top < top + CAR_HEIGHT_PX && box.bottom > top)
    .map((box) => [Math.max(0, box.left), Math.min(viewportWidth, box.right)] as const)
    .filter(([left, right]) => right > left)
    .sort((a, b) => a[0] - b[0]);
  let hidden = 0;
  let reached = 0;
  for (const [left, right] of spans) {
    hidden += Math.max(0, right - Math.max(left, reached));
    reached = Math.max(reached, right);
  }
  return viewportWidth > 0 ? 1 - hidden / viewportWidth : 0;
}

/** Every lane in the window where each car of the formation is enough in the open. */
export function openLanes(
  formation: Formation,
  covers: readonly Box[],
  viewport: { width: number; height: number },
): number[] {
  const slots = FORMATIONS[formation];
  const depth = Math.max(...slots.map((slot) => slot.offset)) + CAR_HEIGHT_PX;
  const lanes: number[] = [];
  for (let top = 0; top + depth <= viewport.height; top += LANE_STEP_PX) {
    if (
      slots.every(
        (slot) => visibleShare(top + slot.offset, covers, viewport.width) >= MIN_VISIBLE_SHARE,
      )
    ) {
      lanes.push(top);
    }
  }
  return lanes;
}

/**
 * A whole pass: the cars, how they are spaced, where, and how fast for this
 * window. Behind the page in an open lane if there is one; otherwise in front
 * of it, somewhere in the front band.
 */
export function planPass(
  random: () => number,
  viewport: { width: number; height: number },
  covers: readonly Box[],
): Pass {
  const formations = Object.keys(FORMATIONS) as Formation[];
  const formation = formations[below(formations.length, random)] ?? "file";
  const open = openLanes(formation, covers, viewport);
  const behind = open.length > 0 ? open[below(open.length, random)] : undefined;
  return {
    cars: pickParade(random),
    formation,
    lane:
      behind ??
      viewport.height * (FRONT_LANE_TOP + random() * (FRONT_LANE_BOTTOM - FRONT_LANE_TOP)),
    inFront: behind === undefined,
    duration: (viewport.width + CAR_WIDTH_PX) / DRIVE_SPEED_PX_PER_S,
  };
}

/**
 * The parade's hidden game, one pass at a time, round and round: press on a car
 * and the pass stops while held; let go and it drives on; press on a car again
 * and it turns round. The next press holds it again, the one after turns it back,
 * and so on until it leaves by either side. A new pass starts at `PARADE_START`.
 */
export interface ParadeGame {
  /** Driving and not yet stopped, held still, or let go and waiting for the press that turns it. */
  phase: "driving" | "held" | "released";
  /** Driving right to left, the cars drawn mirrored. */
  reversed: boolean;
}

export const PARADE_START: ParadeGame = { phase: "driving", reversed: false };

/** The game after a press on a car or a release anywhere: the same object when nothing changes. */
export function nextGame(game: ParadeGame, event: "press" | "release"): ParadeGame {
  if (event === "release") {
    return game.phase === "held" ? { ...game, phase: "released" } : game;
  }
  if (game.phase === "driving") {
    return { ...game, phase: "held" };
  }
  if (game.phase === "released") {
    return { phase: "driving", reversed: !game.reversed };
  }
  return game;
}

/** Whether a point (px, in the window) is inside any of the boxes, edges included. */
export function hitsAny(point: { x: number; y: number }, boxes: readonly Box[]): boolean {
  return boxes.some(
    (box) =>
      point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom,
  );
}

/** What the held pass's tooltip says: each car's team as named that year, and the year, lead car first. */
export function paradeLabel(cars: readonly ParadeCar[]): string[] {
  return cars.map((car) => `${teamName(car.teamId, car.year)} (${car.year})`);
}
