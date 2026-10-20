/**
 * The track along the foot of Home and the parade lapping it: where each car
 * is, how fast it goes, when it pulls out to pass, and who comes on when one
 * leaves.
 *
 * A small simulation stepped once a frame (`stepField`) rather than a CSS
 * animation per car, because the cars react to one another: a faster car
 * closes on a slower one, pulls into the other lane if it is clear, and waits
 * behind if not. Plain data in, plain data out, so the tests step it without a
 * browser. Like the picks (`parade.ts`), it never reads the world and takes
 * its random source as a parameter.
 *
 * Positions are in px on the tarmac: `x` is a car's left edge from the
 * tarmac's left, `y` its top from the tarmac's top. A car's sprite faces right;
 * driving right to left, it is drawn mirrored in the same box.
 */

import { below, type ParadeCar, pickCars } from "./parade.js";
import { PLAYABLE_SEASONS } from "./seasons.js";

/** The `large` car's size in px (`w-36 h-10.5`, 3× the sprite's 48×14 pixels). */
export const CAR_WIDTH_PX = 144;
export const CAR_HEIGHT_PX = 42;

/**
 * The tarmac's height in px: `h-28` in `HomeTrack`, `h-24` on a short window.
 * The page measures it; this is the height a field is laid out for when not told.
 */
export const TARMAC_HEIGHT_PX = 112;

/** Of the tarmac the two lanes leave free, the gap between them gets this many times each edge's share. */
export const LANE_GAP_TO_EDGE = 1.5;

/** Each lane's top in px on tarmac `height` high: either side of the dashed line down its middle. */
export function laneTops(height: number): LaneTops {
  const edge = Math.round((height - 2 * CAR_HEIGHT_PX) / (2 + LANE_GAP_TO_EDGE));
  return [edge, height - edge - CAR_HEIGHT_PX];
}

/** Each lane's top on the tarmac at its full height. */
export const LANE_TOPS = laneTops(TARMAC_HEIGHT_PX);

export type Lane = 0 | 1;

export type LaneTops = readonly [number, number];

/** Where the start/finish line is, as a share of the track's width. */
export const START_LINE = 0.22;

/** How much of the track's width each car on it has, in px, and the fewest and most cars. */
export const PX_PER_CAR = 250;
export const MIN_CARS = 3;
export const MAX_CARS = 6;

/**
 * A car's pace in px/s: from the oldest season's to the newest's by its year,
 * so the newer cars come through, give or take `PACE_SPREAD` of it either way.
 * A speed rather than a lap time, so a phone and a wide monitor see the same cars.
 */
export const PACE_OLDEST_PX_PER_S = 170;
export const PACE_NEWEST_PX_PER_S = 320;
export const PACE_SPREAD = 0.1;

/** How fast a car picks up speed off the grid or out of a queue, in px/s². */
export const ACCELERATION_PX_PER_S2 = 160;

/** The gap a car keeps to the car ahead in its lane, in px. */
export const FOLLOW_GAP_PX = 20;

/** How hard a car closes up to that gap: px/s faster than the car ahead per px of gap beyond it. */
export const FOLLOW_GAIN = 2;

/** How close behind a slower car a faster one pulls out to pass, in px. */
export const PASS_LOOK_PX = 80;

/** How fast a car moves across into the other lane, in px/s. */
export const LANE_CHANGE_PX_PER_S = 90;

/** The gap between two cars in a lane on the grid, in px. */
export const GRID_GAP_PX = 16;

/** Kept clear either side of where a new car comes on, in px. */
export const ENTRY_GAP_PX = 40;

/** The longest step taken at once, in s: a tab left in the background does not jump the field. */
export const MAX_STEP_S = 0.05;

/** How the field lines up behind the start/finish line: in one lane, or in alternate lanes. */
export type Formation = "file" | "staggered";

export const FORMATIONS: readonly Formation[] = ["file", "staggered"];

/** One car on the track. */
export interface TrackCar extends ParadeCar {
  /** Unique on the field over a whole visit, so React keeps each car's element. */
  id: number;
  /** The lane it is in, or moving into. */
  lane: Lane;
  x: number;
  y: number;
  /** The speed it runs at in clear air, in px/s. */
  pace: number;
  /** Its speed now, in px/s. */
  speed: number;
}

/** Every car on the track. */
export interface Field {
  cars: readonly TrackCar[];
  /** The next car's `id`. */
  nextId: number;
  /** Each lane's top, for the tarmac the field is on (`laneTops`). */
  lanes: LaneTops;
}

/** How many cars run on a track this wide. */
export function carsFor(width: number): number {
  return Math.min(MAX_CARS, Math.max(MIN_CARS, Math.round(width / PX_PER_CAR)));
}

/** A car's pace by its year, newer faster, with a little of its own either way. */
export function paceFor(year: number, random: () => number): number {
  const first = PLAYABLE_SEASONS[0] ?? year;
  const last = PLAYABLE_SEASONS.at(-1) ?? year;
  const share = last > first ? Math.min(1, Math.max(0, (year - first) / (last - first))) : 1;
  const pace = PACE_OLDEST_PX_PER_S + share * (PACE_NEWEST_PX_PER_S - PACE_OLDEST_PX_PER_S);
  return pace * (1 + PACE_SPREAD * (2 * random() - 1));
}

/** A field of freshly picked cars, each placed by its index. */
function fieldOf(
  random: () => number,
  count: number,
  height: number,
  place: (index: number) => { lane: Lane; x: number },
  speed: (pace: number) => number,
): Field {
  const lanes = laneTops(height);
  const cars = pickCars(random, count).map((car, id): TrackCar => {
    const { lane, x } = place(id);
    const pace = paceFor(car.year, random);
    return { ...car, id, lane, x, y: lanes[lane], pace, speed: speed(pace) };
  });
  return { cars, nextId: cars.length, lanes };
}

/**
 * The field on the grid, standing behind the start/finish line in `formation`:
 * nose to tail in one lane, or each car half a length behind the one before,
 * in the other lane. The grid runs back off the left of a narrow track.
 */
export function gridField(
  random: () => number,
  width: number,
  formation: Formation,
  height = TARMAC_HEIGHT_PX,
): Field {
  const front = START_LINE * width - CAR_WIDTH_PX;
  const first: Lane = random() < 0.5 ? 0 : 1;
  return fieldOf(
    random,
    carsFor(width),
    height,
    (i) =>
      formation === "file"
        ? { lane: first, x: front - i * (CAR_WIDTH_PX + GRID_GAP_PX) }
        : { lane: ((first + i) % 2) as Lane, x: front - i * (CAR_WIDTH_PX / 2 + GRID_GAP_PX) },
    () => 0,
  );
}

/** The field on the grid in either formation, as the track first shows it. */
export function startField(random: () => number, width: number, height = TARMAC_HEIGHT_PX): Field {
  return gridField(random, width, FORMATIONS[below(FORMATIONS.length, random)] ?? "file", height);
}

/** The field standing still, spread evenly along the track in alternate lanes: for reduced motion. */
export function spreadField(random: () => number, width: number, height = TARMAC_HEIGHT_PX): Field {
  const count = carsFor(width);
  return fieldOf(
    random,
    count,
    height,
    (i) => ({ lane: (i % 2) as Lane, x: ((i + 0.5) * width) / count - CAR_WIDTH_PX / 2 }),
    () => 0,
  );
}

/**
 * The field moved onto tarmac `height` high, when the window makes the track
 * taller or shorter: every car straight into its lane, the same field if
 * nothing changes.
 */
export function refitField(field: Field, height: number): Field {
  const lanes = laneTops(height);
  if (lanes[0] === field.lanes[0] && lanes[1] === field.lanes[1]) {
    return field;
  }
  return { ...field, lanes, cars: field.cars.map((car) => ({ ...car, y: lanes[car.lane] })) };
}

/** Whether a car takes up any of a lane: in it, moving into it, or still partly across it. */
function occupies(car: TrackCar, lane: Lane, lanes: LaneTops): boolean {
  return car.lane === lane || Math.abs(car.y - lanes[lane]) < CAR_HEIGHT_PX;
}

const LANES: readonly Lane[] = [0, 1];

/**
 * Advance the field by `dt` seconds, driving `direction` (1 rightwards, -1
 * leftwards). A car that has left the far side is gone; while the track holds
 * fewer cars than `carsFor(width)`, a new pick comes on at the near side, in a
 * lane clear of the cars there.
 */
export function stepField(
  field: Field,
  {
    dt,
    width,
    direction,
    random,
  }: { dt: number; width: number; direction: 1 | -1; random: () => number },
): Field {
  const step = Math.min(Math.max(0, dt), MAX_STEP_S);
  const { lanes } = field;
  // Distances along the direction of travel: a car's rear, measured so that
  // ahead is always larger, whichever way the field is driving.
  const rear = (car: TrackCar) => (direction === 1 ? car.x : -(car.x + CAR_WIDTH_PX));
  const now = new Map(field.cars.map((car) => [car.id, car]));
  const others = (car: TrackCar) => [...now.values()].filter((other) => other.id !== car.id);
  // The nearest car ahead taking up any of these lanes, with the gap to it.
  const leader = (car: TrackCar, among: readonly Lane[]) => {
    let nearest: { car: TrackCar; gap: number } | undefined;
    for (const other of others(car)) {
      const gap = rear(other) - rear(car) - CAR_WIDTH_PX;
      if (
        rear(other) > rear(car) &&
        among.some((lane) => occupies(other, lane, lanes)) &&
        (nearest === undefined || gap < nearest.gap)
      ) {
        nearest = { car: other, gap };
      }
    }
    return nearest;
  };
  // The car at the front of the queue `car` is in: the car ahead, the car ahead
  // of that, and so on while each is close behind the next in its lane.
  const head = (car: TrackCar) => {
    let front = car;
    for (let n = 0; n < field.cars.length; n++) {
      const next = leader(front, [front.lane]);
      if (next === undefined || next.gap >= PASS_LOOK_PX) {
        break;
      }
      front = next.car;
    }
    return front;
  };
  // Whether no other car takes up any of `lane` between these two rears.
  const clear = (car: TrackCar, lane: Lane, from: number, to: number) =>
    others(car).every(
      (other) =>
        !occupies(other, lane, lanes) || rear(other) + CAR_WIDTH_PX <= from || rear(other) >= to,
    );

  // Front first, so each car sees the cars ahead where they have just moved to.
  // A car pulls out only when the queue ahead of it is led by a car at its own
  // pace, so a file leaves the grid as a file and breaks up once it is moving.
  const order = [...field.cars].sort((a, b) => rear(b) - rear(a));
  for (const start of order) {
    let car = start;
    const across = car.y !== lanes[car.lane];
    const ahead = leader(car, [car.lane]);
    if (
      !across &&
      ahead !== undefined &&
      ahead.gap < PASS_LOOK_PX &&
      ahead.car.speed < car.pace &&
      head(car).speed >= head(car).pace &&
      clear(
        car,
        car.lane === 0 ? 1 : 0,
        rear(car) - CAR_WIDTH_PX - FOLLOW_GAP_PX,
        rear(car) + 2 * CAR_WIDTH_PX + PASS_LOOK_PX,
      )
    ) {
      car = { ...car, lane: car.lane === 0 ? 1 : 0 };
    }
    // Whatever is ahead in any lane the car takes up, so it never runs into a car mid-move.
    const queue = leader(
      car,
      LANES.filter((lane) => occupies(car, lane, lanes)),
    );
    const limit =
      queue === undefined
        ? car.pace
        : Math.min(car.pace, queue.car.speed + (queue.gap - FOLLOW_GAP_PX) * FOLLOW_GAIN);
    const target = Math.max(0, limit);
    const speed =
      target < car.speed ? target : Math.min(target, car.speed + ACCELERATION_PX_PER_S2 * step);
    const laneTop = lanes[car.lane];
    const y =
      car.y < laneTop
        ? Math.min(laneTop, car.y + LANE_CHANGE_PX_PER_S * step)
        : Math.max(laneTop, car.y - LANE_CHANGE_PX_PER_S * step);
    now.set(car.id, { ...car, speed, y, x: car.x + direction * speed * step });
  }

  const cars = [...now.values()].filter((car) =>
    direction === 1 ? car.x < width : car.x + CAR_WIDTH_PX > 0,
  );
  let nextId = field.nextId;
  if (cars.length < carsFor(width)) {
    const entry = direction === 1 ? -CAR_WIDTH_PX : width;
    const open = LANES.filter((lane) =>
      cars.every(
        (car) =>
          !occupies(car, lane, lanes) ||
          car.x + CAR_WIDTH_PX + ENTRY_GAP_PX <= entry ||
          car.x >= entry + CAR_WIDTH_PX + ENTRY_GAP_PX,
      ),
    );
    const lane = open[below(open.length, random)];
    const [pick] =
      lane === undefined
        ? []
        : pickCars(
            random,
            1,
            cars.map((car) => car.teamId),
          );
    if (lane !== undefined && pick !== undefined) {
      const pace = paceFor(pick.year, random);
      cars.push({
        ...pick,
        id: nextId,
        lane,
        x: entry,
        y: lanes[lane],
        pace,
        speed: pace,
      });
      nextId += 1;
    }
  }
  return { cars, nextId, lanes };
}

/**
 * The car under a point on the tarmac (px from its top left), if any: of two
 * overlapping, the lower one, which is drawn on top.
 */
export function carAt(field: Field, point: { x: number; y: number }): TrackCar | undefined {
  let hit: TrackCar | undefined;
  for (const car of field.cars) {
    if (
      point.x >= car.x &&
      point.x <= car.x + CAR_WIDTH_PX &&
      point.y >= car.y &&
      point.y <= car.y + CAR_HEIGHT_PX &&
      (hit === undefined || car.y > hit.y)
    ) {
      hit = car;
    }
  }
  return hit;
}
