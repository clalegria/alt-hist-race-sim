/**
 * The champion-card sprites as data: that every drawing is well formed, that
 * every decade the app covers has one, and that a wheel survives being turned.
 *
 * Nothing here asserts what a sprite looks like — the drawings are the author's
 * to redraw. Only the rules a redraw must keep.
 */

import { describe, expect, it } from "vitest";
import {
  CAR_SPRITES,
  carSpriteFor,
  PIXEL_ROLES,
  pixelRuns,
  SPRITE_HEIGHT,
  SPRITE_WIDTH,
  type Wheel,
  wheelRows,
} from "./car-sprites.js";
import { decadeOf, SEASON_DECADES, SEASON_YEARS } from "./seasons.js";

const alphabet = new Set<string>([".", ...PIXEL_ROLES]);

describe("the sprites", () => {
  it.each(CAR_SPRITES.map((sprite) => [sprite.decade, sprite] as const))(
    "draws the %is on the shared canvas, in the known alphabet",
    (_, sprite) => {
      expect(sprite.rows).toHaveLength(SPRITE_HEIGHT);
      for (const row of sprite.rows) {
        expect(row).toHaveLength(SPRITE_WIDTH);
        for (const character of row) {
          expect(alphabet.has(character), `unknown pixel "${character}"`).toBe(true);
        }
      }
    },
  );

  it("keeps every wheel on the canvas, with a single pixel at its centre", () => {
    for (const { decade, wheels } of CAR_SPRITES) {
      for (const wheel of wheels) {
        expect(wheel.size % 2, `${decade}: even wheel`).toBe(1);
        expect(wheel.rim).toBeLessThan((wheel.size - 1) / 2);
        expect(wheel.x).toBeGreaterThanOrEqual(0);
        expect(wheel.y).toBeGreaterThanOrEqual(0);
        expect(wheel.x + wheel.size).toBeLessThanOrEqual(SPRITE_WIDTH);
        expect(wheel.y + wheel.size).toBeLessThanOrEqual(SPRITE_HEIGHT);
      }
    }
  });

  it("puts every car's wheels on the same ground", () => {
    // A car whose tyres stop short of the bottom row floats above the others
    // when two cards sit side by side from different sprites.
    for (const { wheels } of CAR_SPRITES) {
      for (const wheel of wheels) {
        expect(wheel.y + wheel.size).toBe(SPRITE_HEIGHT);
      }
    }
  });

  it("draws every decade differently", () => {
    const drawings = new Set(CAR_SPRITES.map((sprite) => sprite.rows.join("\n")));
    expect(drawings.size).toBe(CAR_SPRITES.length);
  });
});

describe("choosing a car for a season", () => {
  it("has one car for every decade the app covers", () => {
    expect(CAR_SPRITES.map((sprite) => sprite.decade)).toEqual(SEASON_DECADES);
  });

  it("gives every season its own decade's car", () => {
    for (const year of SEASON_YEARS) {
      expect(carSpriteFor(year).decade).toBe(decadeOf(year));
    }
  });

  it("keeps the nearest car for a year outside the range", () => {
    const first = CAR_SPRITES[0];
    const last = CAR_SPRITES.at(-1);
    expect(carSpriteFor((first?.decade ?? 0) - 1)).toBe(first);
    expect(carSpriteFor((last?.decade ?? 0) + 25)).toBe(last);
  });
});

/** A square drawing turned a quarter turn clockwise. */
function quarterTurn(rows: readonly string[]): string[] {
  const size = rows.length;
  return rows.map((_, y) =>
    Array.from({ length: size }, (_, x) => rows[size - 1 - x]?.[y] ?? "").join(""),
  );
}

describe("a wheel", () => {
  const wheels: readonly Wheel[] = CAR_SPRITES.flatMap((sprite) => sprite.wheels);

  it("looks the same after a quarter turn, apart from its spoke", () => {
    // The wheel is animated by quarter turns. If its outline were not symmetric
    // under one, the tyre would visibly jump on every step rather than turn.
    for (const wheel of wheels) {
      const rows = wheelRows(wheel);
      const spoke = wheel.rimRole === "m" ? "x" : "m";
      const withoutSpoke = (drawing: readonly string[]) =>
        drawing.map((row) => row.replaceAll(spoke, wheel.rimRole));
      expect(withoutSpoke(quarterTurn(rows))).toEqual(withoutSpoke(rows));
    }
  });

  it("has a spoke that moves when it turns, so the turning can be seen", () => {
    for (const wheel of wheels) {
      const rows = wheelRows(wheel);
      expect(quarterTurn(rows)).not.toEqual(rows);
    }
  });
});

describe("pixel runs", () => {
  it("redraw every sprite and wheel exactly", () => {
    const drawings = CAR_SPRITES.flatMap((sprite) => [
      sprite.rows,
      ...sprite.wheels.map(wheelRows),
    ]);
    for (const rows of drawings) {
      const canvas = rows.map((row) => Array.from(row, () => "."));
      for (const [role, runs] of pixelRuns(rows)) {
        for (const { x, y, width } of runs) {
          for (let i = 0; i < width; i++) {
            const line = canvas[y];
            expect(line?.[x + i], "two runs cover one pixel").toBe(".");
            if (line !== undefined) {
              line[x + i] = role;
            }
          }
        }
      }
      expect(canvas.map((line) => line.join(""))).toEqual(rows);
    }
  });

  it("skips a character it does not know rather than drawing it", () => {
    expect([...pixelRuns(["PPq"]).keys()]).toEqual(["P"]);
  });
});
