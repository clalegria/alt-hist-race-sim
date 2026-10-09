/**
 * The home screen's parade: what it picks, and how a pass is laid out. Driven
 * by synthetic random sources; what any one of them picks is not asserted.
 */

import { seasonSeed } from "@alt-hist/data";
import { describe, expect, it } from "vitest";
import { liveryFor } from "./livery.js";
import {
  CAR_WIDTH_PX,
  DRIVE_SPEED_PX_PER_S,
  FORMATIONS,
  type Formation,
  LANE_BOTTOM,
  LANE_TOP,
  PARADE_SIZE,
  pickParade,
  planPass,
} from "./parade.js";

/** A small seeded generator (mulberry32), numbers in `[0, 1)`. */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);

describe("pickParade", () => {
  it("picks a full pass of different teams, whatever the random source", () => {
    const sources = [...SEEDS.map(seeded), () => 0, () => 0.999_999_9];
    for (const random of sources) {
      const cars = pickParade(random);
      expect(cars).toHaveLength(PARADE_SIZE);
      expect(new Set(cars.map((car) => car.teamId)).size).toBe(PARADE_SIZE);
    }
  });

  it("picks only a team entered that season, in that season's colours", () => {
    for (const seed of SEEDS) {
      for (const car of pickParade(seeded(seed))) {
        expect(seasonSeed(car.year).entries.map((entry) => entry.teamId)).toContain(car.teamId);
        expect(car.livery).toEqual(liveryFor(car.teamId, car.year));
      }
    }
  });

  it("reaches more than one season", () => {
    const years = new Set(SEEDS.flatMap((seed) => pickParade(seeded(seed)).map((car) => car.year)));
    expect(years.size).toBeGreaterThan(1);
  });
});

describe("planPass", () => {
  it("draws both formations, and a lane inside the band", () => {
    const seen = new Set<Formation>();
    for (const seed of SEEDS) {
      const pass = planPass(seeded(seed), 1000);
      seen.add(pass.formation);
      expect(pass.lane).toBeGreaterThanOrEqual(LANE_TOP);
      expect(pass.lane).toBeLessThanOrEqual(LANE_BOTTOM);
    }
    expect([...seen].sort()).toEqual(Object.keys(FORMATIONS).sort());
  });

  it("gives every formation a slot per car", () => {
    for (const slots of Object.values(FORMATIONS)) {
      expect(slots).toHaveLength(PARADE_SIZE);
    }
  });

  it("keeps the speed, not the duration, whatever the window's width", () => {
    for (const width of [360, 1280, 2560]) {
      const pass = planPass(seeded(1), width);
      expect(((width + CAR_WIDTH_PX) / pass.duration).toFixed(6)).toBe(
        DRIVE_SPEED_PX_PER_S.toFixed(6),
      );
    }
  });
});
