/**
 * The track along the foot of Home: how the field lines up, and the rules it
 * keeps while it laps. Driven by synthetic random sources and synthetic cars;
 * what any one source picks, or where it puts a car, is not asserted.
 */

import type { Livery } from "@alt-hist/data";
import { describe, expect, it } from "vitest";
import { randomSource } from "../test-support.js";
import { PLAYABLE_SEASONS } from "./seasons.js";
import {
  CAR_HEIGHT_PX,
  CAR_WIDTH_PX,
  carAt,
  carsFor,
  type Field,
  FORMATIONS,
  type Formation,
  gridField,
  LANE_TOPS,
  MAX_CARS,
  MAX_STEP_S,
  MIN_CARS,
  PACE_NEWEST_PX_PER_S,
  PACE_OLDEST_PX_PER_S,
  PACE_SPREAD,
  paceFor,
  START_LINE,
  spreadField,
  startField,
  stepField,
  type TrackCar,
} from "./track.js";

const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);
const WIDTHS = [360, 768, 1280, 2560];
const FRAME_S = 1 / 30;

const LIVERY: Livery = {
  primaryColor: "#aa0000",
  secondaryColor1: "#00bb00",
  secondaryColor2: "#0000cc",
  badgeStripes: 1,
};

/** A synthetic car, in clear air at its pace unless told otherwise. */
function car(id: number, fields: Partial<TrackCar> & Pick<TrackCar, "lane" | "x">): TrackCar {
  const pace = fields.pace ?? 200;
  return {
    teamId: `team-${id}`,
    year: 2000,
    livery: LIVERY,
    id,
    y: LANE_TOPS[fields.lane],
    pace,
    speed: pace,
    ...fields,
  };
}

/** Whether two cars' boxes overlap by more than a rounding error. */
function overlap(a: TrackCar, b: TrackCar): boolean {
  const e = 1e-6;
  return (
    a.x < b.x + CAR_WIDTH_PX - e &&
    b.x < a.x + CAR_WIDTH_PX - e &&
    a.y < b.y + CAR_HEIGHT_PX - e &&
    b.y < a.y + CAR_HEIGHT_PX - e
  );
}

/** Every rule a field keeps at every moment that it breaks, as words: none for a sound field. */
function faults(field: Field, width: number): string[] {
  const { cars } = field;
  const found: string[] = [];
  if (cars.length > carsFor(width)) {
    found.push(`${cars.length} cars on a track for ${carsFor(width)}`);
  }
  if (new Set(cars.map((c) => c.id)).size !== cars.length) {
    found.push("two cars share an id");
  }
  if (new Set(cars.map((c) => c.teamId)).size !== cars.length) {
    found.push("two cars of one team");
  }
  for (const c of cars) {
    if (c.id >= field.nextId) {
      found.push(`car ${c.id} at or past the next id`);
    }
    if (c.y < LANE_TOPS[0] || c.y > LANE_TOPS[1]) {
      found.push(`car ${c.id} off the lanes`);
    }
    if (c.speed < 0 || c.speed > c.pace) {
      found.push(`car ${c.id} outside its pace`);
    }
  }
  for (const [i, a] of cars.entries()) {
    for (const b of cars.slice(i + 1)) {
      if (overlap(a, b)) {
        found.push(`cars ${a.id} and ${b.id} overlap`);
      }
    }
  }
  return found;
}

function expectSound(field: Field, width: number) {
  expect(faults(field, width)).toEqual([]);
}

/** Step a field for `seconds` of frames, checking it after every one. */
function run(
  field: Field,
  {
    seconds,
    width,
    direction = 1,
    seed,
  }: { seconds: number; width: number; direction?: 1 | -1; seed: number },
): Field {
  const random = randomSource(seed);
  let current = field;
  for (let t = 0; t < seconds; t += FRAME_S) {
    current = stepField(current, { dt: FRAME_S, width, direction, random });
    // One assertion at the first fault, not one per frame: thousands of them are slow.
    if (faults(current, width).length > 0) {
      expectSound(current, width);
    }
  }
  return current;
}

describe("carsFor", () => {
  it("puts more cars on a wider track, within the fewest and the most", () => {
    let before = 0;
    for (let width = 0; width <= 4000; width += 50) {
      const count = carsFor(width);
      expect(count).toBeGreaterThanOrEqual(Math.max(MIN_CARS, before));
      expect(count).toBeLessThanOrEqual(MAX_CARS);
      before = count;
    }
  });
});

describe("paceFor", () => {
  const first = PLAYABLE_SEASONS[0] ?? 0;
  const last = PLAYABLE_SEASONS.at(-1) ?? 0;

  it("runs from the oldest season's pace to the newest's, newer faster", () => {
    const middle = () => 0.5;
    expect(paceFor(first, middle)).toBeCloseTo(PACE_OLDEST_PX_PER_S);
    expect(paceFor(last, middle)).toBeCloseTo(PACE_NEWEST_PX_PER_S);
    for (const year of PLAYABLE_SEASONS.slice(1)) {
      expect(paceFor(year, middle)).toBeGreaterThan(paceFor(year - 1, middle));
    }
  });

  it("gives each car a little of its own, never more than the spread", () => {
    for (const r of [0, 0.25, 0.999]) {
      const pace = paceFor(last, () => r);
      expect(Math.abs(pace / PACE_NEWEST_PX_PER_S - 1)).toBeLessThanOrEqual(PACE_SPREAD + 1e-9);
    }
  });
});

describe("the grid", () => {
  const formations = FORMATIONS as readonly Formation[];

  it("stands the whole field behind the start/finish line, at rest", () => {
    for (const formation of formations) {
      for (const width of WIDTHS) {
        for (const seed of SEEDS) {
          const field = gridField(randomSource(seed), width, formation);
          expect(field.cars).toHaveLength(carsFor(width));
          expectSound(field, width);
          for (const c of field.cars) {
            expect(c.x + CAR_WIDTH_PX).toBeLessThanOrEqual(START_LINE * width);
            expect(c.speed).toBe(0);
          }
        }
      }
    }
  });

  it("lines a file up in one lane, and an echelon in alternate lanes", () => {
    for (const seed of SEEDS) {
      const file = gridField(randomSource(seed), 1280, "file").cars;
      expect(new Set(file.map((c) => c.lane)).size).toBe(1);
      const echelon = [...gridField(randomSource(seed), 1280, "staggered").cars].sort(
        (a, b) => b.x - a.x,
      );
      for (const [i, c] of echelon.slice(1).entries()) {
        expect(c.lane).not.toBe(echelon[i]?.lane);
      }
    }
  });

  it("starts in either formation", () => {
    const lanesUsed = new Set(
      SEEDS.map(
        (seed) => new Set(startField(randomSource(seed), 1280).cars.map((c) => c.lane)).size,
      ),
    );
    expect([...lanesUsed].sort()).toEqual([1, 2]);
  });

  it("leaves the grid as a file: nobody pulls out while the car ahead is still picking up speed", () => {
    for (const seed of SEEDS) {
      const field = gridField(randomSource(seed), 1280, "file");
      const lane = field.cars[0]?.lane;
      let current = field;
      for (let t = 0; t < 0.5; t += FRAME_S) {
        current = stepField(current, {
          dt: FRAME_S,
          width: 1280,
          direction: 1,
          random: randomSource(seed),
        });
      }
      for (const c of current.cars) {
        expect(c.lane).toBe(lane);
      }
    }
  });
});

describe("the field standing still", () => {
  it("spreads along the track in alternate lanes, every car's middle on it", () => {
    for (const width of WIDTHS) {
      const field = spreadField(randomSource(1), width);
      expect(field.cars).toHaveLength(carsFor(width));
      expectSound(field, width);
      const sorted = [...field.cars].sort((a, b) => a.x - b.x);
      const spacing = width / sorted.length;
      for (const [i, c] of sorted.entries()) {
        expect(c.x + CAR_WIDTH_PX / 2).toBeCloseTo((i + 0.5) * spacing);
        if (i > 0) {
          expect(c.lane).not.toBe(sorted[i - 1]?.lane);
        }
      }
    }
  });
});

describe("stepField", () => {
  it("keeps the field sound off the grid and lapping, at every width", () => {
    for (const width of WIDTHS) {
      for (const seed of SEEDS.slice(0, 10)) {
        run(startField(randomSource(seed), width), { seconds: 20, width, seed });
      }
    }
  });

  it("keeps it sound driving the other way, and turned round mid-lap", () => {
    for (const seed of SEEDS.slice(0, 10)) {
      const forward = run(startField(randomSource(seed), 1280), { seconds: 8, width: 1280, seed });
      run(forward, { seconds: 12, width: 1280, direction: -1, seed });
    }
  });

  it("sends each car off the far side and brings a new pick on, until the track is full", () => {
    for (const seed of SEEDS.slice(0, 10)) {
      const start = startField(randomSource(seed), 1280);
      const later = run(start, { seconds: 30, width: 1280, seed });
      expect(later.nextId).toBeGreaterThan(start.nextId);
      expect(later.cars).toHaveLength(carsFor(1280));
      const firstIds = new Set(start.cars.map((c) => c.id));
      expect(later.cars.some((c) => !firstIds.has(c.id))).toBe(true);
    }
  });

  it("drives the cars the way it is told", () => {
    const field: Field = { cars: [car(0, { lane: 0, x: 500 })], nextId: 1 };
    const step = { dt: 0.02, width: 1280, random: randomSource(1) };
    const right = stepField(field, { ...step, direction: 1 }).cars.find((c) => c.id === 0);
    const left = stepField(field, { ...step, direction: -1 }).cars.find((c) => c.id === 0);
    expect(right?.x).toBeGreaterThan(500);
    expect(left?.x).toBeLessThan(500);
  });

  it("never jumps further than its longest step, however long the frame", () => {
    const field: Field = { cars: [car(0, { lane: 0, x: 500 })], nextId: 1 };
    const moved = stepField(field, { dt: 10, width: 1280, direction: 1, random: randomSource(1) });
    const c = moved.cars.find((c) => c.id === 0);
    expect(c?.x).toBeCloseTo(500 + 200 * MAX_STEP_S);
  });

  it("has a faster car pull out past a slower one when the other lane is clear", () => {
    const slow = car(0, { lane: 0, x: 400, pace: 150 });
    const fast = car(1, { lane: 0, x: 400 - CAR_WIDTH_PX - 60, pace: 300 });
    let field: Field = { cars: [slow, fast], nextId: 2 };
    let pulledOut = false;
    for (let t = 0; t < 4; t += FRAME_S) {
      // Wide enough that neither leaves, so no new car joins the test.
      field = stepField(field, {
        dt: FRAME_S,
        width: 100_000,
        direction: 1,
        random: randomSource(1),
      });
      expectSound(field, 100_000);
      pulledOut ||= field.cars.find((c) => c.id === 1)?.lane === 1;
    }
    const [s, f] = [0, 1].map((id) => field.cars.find((c) => c.id === id));
    expect(pulledOut).toBe(true);
    expect(f?.x).toBeGreaterThan((s?.x ?? 0) + CAR_WIDTH_PX);
  });

  it("has it wait behind when the other lane is taken alongside", () => {
    const slow = car(0, { lane: 0, x: 400, pace: 150 });
    const beside = car(2, { lane: 1, x: 300, pace: 150 });
    const fast = car(1, { lane: 0, x: 400 - CAR_WIDTH_PX - 60, pace: 300 });
    let field: Field = { cars: [slow, beside, fast], nextId: 3 };
    for (let t = 0; t < 2; t += FRAME_S) {
      field = stepField(field, {
        dt: FRAME_S,
        width: 100_000,
        direction: 1,
        random: randomSource(1),
      });
      expectSound(field, 100_000);
    }
    const f = field.cars.find((c) => c.id === 1);
    expect(f?.lane).toBe(0);
    expect(f?.speed).toBeLessThan(300);
  });
});

describe("carAt", () => {
  const upper = car(0, { lane: 0, x: 100 });
  const lower = car(1, { lane: 1, x: 150, y: LANE_TOPS[0] + 20 });
  const field: Field = { cars: [upper, lower], nextId: 2 };

  it("finds the car under a point, edges included", () => {
    expect(carAt(field, { x: 100, y: upper.y })?.id).toBe(0);
    expect(carAt(field, { x: 100 + CAR_WIDTH_PX, y: upper.y + 5 })?.id).toBe(0);
  });

  it("finds nothing off every car", () => {
    expect(carAt(field, { x: 99, y: upper.y + 5 })).toBeUndefined();
    expect(carAt(field, { x: 1000, y: 30 })).toBeUndefined();
  });

  it("of two overlapping, finds the lower, which is drawn on top", () => {
    expect(carAt(field, { x: 200, y: lower.y + 5 })?.id).toBe(1);
  });
});
