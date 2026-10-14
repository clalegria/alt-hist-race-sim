/**
 * The team cars as data: that every drawing is well formed, that every decade
 * the app covers has one, and that cars side by side stand level.
 *
 * Nothing here asserts what a car looks like — the drawings are the author's
 * to redraw. Only the rules a redraw must keep.
 */

import { describe, expect, it } from "vitest";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  CAR_DRAWINGS,
  type CarDrawing,
  type CarRole,
  carDrawingFor,
  GROUND,
} from "./car-drawings.js";
import { decadeOf, SEASON_DECADES, SEASON_YEARS } from "./seasons.js";

const ROLES = new Set<CarRole>(["o", "P", "p", "1", "2", "h", "v", "c", "x", "m", "w"]);

/** Every part of a drawing, in the order it is painted. */
function partsOf(drawing: CarDrawing) {
  return [...drawing.under, ...drawing.over, ...drawing.top];
}

/** Every number in a path. Its x and y are not told apart, so only the wider bound holds. */
function numbersIn(d: string): number[] {
  return (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
}

describe("the drawings", () => {
  it.each(CAR_DRAWINGS.map((drawing) => [drawing.decade, drawing] as const))(
    "%i is a well-formed drawing",
    (_, drawing) => {
      for (const d of [drawing.body, ...partsOf(drawing).map((part) => part.d)]) {
        expect(d, "a path uses only path commands and numbers").toMatch(
          /^[MLHVCQAZmlhvcqaz\d\s,.-]+$/,
        );
      }
      for (const part of partsOf(drawing)) {
        expect(ROLES.has(part.role), `unknown role "${part.role}"`).toBe(true);
      }
      const [stripe1, stripe2, end] = drawing.stripes;
      expect(stripe1).toBeLessThan(stripe2);
      expect(stripe2).toBeLessThan(end);
      // The stripes run above the shadow, so a shadow never paints over one.
      expect(end).toBeLessThanOrEqual(drawing.shade);
      expect(drawing.shade).toBeLessThan(CANVAS_HEIGHT);
      if (drawing.stripeSpan !== undefined) {
        const [from, to] = drawing.stripeSpan;
        expect(from).toBeGreaterThanOrEqual(0);
        expect(to).toBeGreaterThan(from);
        expect(to).toBeLessThanOrEqual(CANVAS_WIDTH);
      }
    },
  );

  it("keeps every body on the canvas", () => {
    for (const { body } of CAR_DRAWINGS) {
      for (const n of numbersIn(body)) {
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThanOrEqual(CANVAS_WIDTH);
      }
    }
  });

  it("keeps every helmet and wheel on the canvas", () => {
    for (const { helmet, wheels } of CAR_DRAWINGS) {
      for (const { cx, cy, r } of [helmet, ...wheels]) {
        expect(cx - r).toBeGreaterThanOrEqual(0);
        expect(cx + r).toBeLessThanOrEqual(CANVAS_WIDTH);
        expect(cy - r).toBeGreaterThanOrEqual(0);
        expect(cy + r).toBeLessThanOrEqual(CANVAS_HEIGHT);
      }
    }
  });

  it("puts every car's wheels on the same ground", () => {
    // A car whose tyres stop short of the ground floats above the others when
    // two cards sit side by side from different decades.
    for (const { wheels } of CAR_DRAWINGS) {
      for (const wheel of wheels) {
        expect(wheel.cy + wheel.r).toBe(GROUND);
      }
    }
  });

  it("gives every wheel a rim inside its tyre and spokes to see it turn by", () => {
    for (const wheel of CAR_DRAWINGS.flatMap((drawing) => drawing.wheels)) {
      expect(wheel.rim).toBeGreaterThan(0);
      expect(wheel.rim).toBeLessThan(1);
      expect(wheel.spokes).toBeGreaterThan(0);
    }
  });

  it("draws every decade differently", () => {
    const bodies = new Set(CAR_DRAWINGS.map((drawing) => drawing.body));
    expect(bodies.size).toBe(CAR_DRAWINGS.length);
  });
});

describe("choosing a car for a season", () => {
  it("has one car for every decade the app covers", () => {
    expect(CAR_DRAWINGS.map((drawing) => drawing.decade)).toEqual(SEASON_DECADES);
  });

  it("gives every season its own decade's car", () => {
    for (const year of SEASON_YEARS) {
      expect(carDrawingFor(year).decade).toBe(decadeOf(year));
    }
  });

  it("keeps the nearest car for a year outside the range", () => {
    const first = CAR_DRAWINGS[0];
    const last = CAR_DRAWINGS.at(-1);
    expect(carDrawingFor((first?.decade ?? 0) - 1)).toBe(first);
    expect(carDrawingFor((last?.decade ?? 0) + 25)).toBe(last);
  });
});
