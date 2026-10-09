/**
 * The home screen's parade: what it picks, and how a pass is laid out. Driven
 * by synthetic random sources; what any one of them picks is not asserted.
 */

import { seasonSeed } from "@alt-hist/data";
import { describe, expect, it } from "vitest";
import { liveryFor } from "./livery.js";
import {
  type Box,
  CAR_HEIGHT_PX,
  CAR_WIDTH_PX,
  DRIVE_SPEED_PX_PER_S,
  FORMATIONS,
  type Formation,
  FRONT_LANE_BOTTOM,
  FRONT_LANE_TOP,
  MIN_VISIBLE_SHARE,
  openLanes,
  PARADE_SIZE,
  pickParade,
  planPass,
  visibleShare,
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

const VIEWPORT = { width: 400, height: 800 };

/** A cover across `[left, right)` of the window, from `top` to `bottom`. */
function box(top: number, bottom: number, left = 0, right = VIEWPORT.width): Box {
  return { top, bottom, left, right };
}

/** How far down each formation reaches below its lane. */
function depth(formation: Formation): number {
  return Math.max(...FORMATIONS[formation].map((slot) => slot.offset)) + CAR_HEIGHT_PX;
}

describe("visibleShare", () => {
  it("is the whole width with nothing in the way, and none under a full-width cover", () => {
    expect(visibleShare(100, [], VIEWPORT.width)).toBe(1);
    expect(visibleShare(100, [box(0, 800)], VIEWPORT.width)).toBe(0);
  });

  it("counts only the covers overlapping the row, and an overlap between covers once", () => {
    const covers = [box(0, 50, 0, 100), box(100, 200, 50, 150), box(120, 160, 100, 200)];
    expect(visibleShare(300, covers, VIEWPORT.width)).toBe(1);
    expect(visibleShare(110, covers, VIEWPORT.width)).toBeCloseTo(1 - 150 / 400);
  });

  it("ignores what a cover hangs off the window", () => {
    expect(visibleShare(0, [box(0, 50, -100, 100)], VIEWPORT.width)).toBeCloseTo(0.75);
  });
});

describe("openLanes", () => {
  const formations = Object.keys(FORMATIONS) as Formation[];

  it("finds lanes only where every car of the formation is enough in the open", () => {
    // A phone: the heading open, cards from 300 down, wall to wall but a sliver.
    const sliver = (MIN_VISIBLE_SHARE / 2) * VIEWPORT.width;
    const covers = [box(0, 60), box(300, 800, sliver, VIEWPORT.width - sliver)];
    for (const formation of formations) {
      const lanes = openLanes(formation, covers, VIEWPORT);
      expect(lanes.length).toBeGreaterThan(0);
      for (const lane of lanes) {
        expect(lane).toBeGreaterThanOrEqual(60);
        expect(lane + depth(formation)).toBeLessThanOrEqual(300);
      }
    }
  });

  it("takes a row past a cover that leaves enough of the width open", () => {
    // A desktop: cards down the middle, with sides open either way, a little
    // less than enough and a little more.
    const side = MIN_VISIBLE_SHARE * VIEWPORT.width;
    const narrower = [box(0, 800, side / 2 - 1, VIEWPORT.width - side / 2 + 1)];
    expect(openLanes("file", narrower, VIEWPORT)).toEqual([]);
    const wider = [box(0, 800, side / 2 + 1, VIEWPORT.width - side / 2 - 1)];
    expect(openLanes("file", wider, VIEWPORT).length).toBeGreaterThan(0);
  });

  it("keeps the whole formation inside the window", () => {
    for (const formation of formations) {
      for (const lane of openLanes(formation, [], VIEWPORT)) {
        expect(lane).toBeGreaterThanOrEqual(0);
        expect(lane + depth(formation)).toBeLessThanOrEqual(VIEWPORT.height);
      }
    }
  });

  it("finds none for a formation too deep for the only gap", () => {
    const gap = depth("file") + 4;
    expect(depth("staggered")).toBeGreaterThan(gap);
    const covers = [box(0, 200), box(200 + gap, 800)];
    expect(openLanes("file", covers, VIEWPORT).length).toBeGreaterThan(0);
    expect(openLanes("staggered", covers, VIEWPORT)).toEqual([]);
  });
});

describe("planPass", () => {
  it("draws both formations, behind the page in an open lane when there is one", () => {
    const covers = [box(0, 60), box(300, 800)];
    const seen = new Set<Formation>();
    for (const seed of SEEDS) {
      const pass = planPass(seeded(seed), VIEWPORT, covers);
      seen.add(pass.formation);
      expect(pass.inFront).toBe(false);
      expect(openLanes(pass.formation, covers, VIEWPORT)).toContain(pass.lane);
    }
    expect([...seen].sort()).toEqual(Object.keys(FORMATIONS).sort());
  });

  it("runs in front of the page, inside the front band, when no lane is open", () => {
    for (const seed of SEEDS) {
      const pass = planPass(seeded(seed), VIEWPORT, [box(0, 800)]);
      expect(pass.inFront).toBe(true);
      expect(pass.lane).toBeGreaterThanOrEqual(FRONT_LANE_TOP * VIEWPORT.height);
      expect(pass.lane).toBeLessThanOrEqual(FRONT_LANE_BOTTOM * VIEWPORT.height);
    }
  });

  it("gives every formation a slot per car", () => {
    for (const slots of Object.values(FORMATIONS)) {
      expect(slots).toHaveLength(PARADE_SIZE);
    }
  });

  it("keeps the speed, not the duration, whatever the window's width", () => {
    for (const width of [360, 1280, 2560]) {
      const pass = planPass(seeded(1), { width, height: 800 }, []);
      expect(((width + CAR_WIDTH_PX) / pass.duration).toFixed(6)).toBe(
        DRIVE_SPEED_PX_PER_S.toFixed(6),
      );
    }
  });
});
