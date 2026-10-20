/**
 * The home screen's parade: what it picks, its hidden game and its label.
 * Driven by synthetic random sources; what any one of them picks is not asserted.
 */

import { seasonSeed } from "@alt-hist/data";
import { describe, expect, it } from "vitest";
import { randomSource as seeded } from "../test-support.js";
import { liveryFor } from "./livery.js";
import { teamName } from "./names.js";
import { carLabel, nextGame, PARADE_START, type ParadeGame, pickCars } from "./parade.js";

const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);

describe("pickCars", () => {
  it("picks as many cars as asked, every one a different team, whatever the random source", () => {
    const sources = [...SEEDS.map(seeded), () => 0, () => 0.999_999_9];
    for (const random of sources) {
      for (const count of [1, 3, 6]) {
        const cars = pickCars(random, count);
        expect(cars).toHaveLength(count);
        expect(new Set(cars.map((car) => car.teamId)).size).toBe(count);
      }
    }
  });

  it("never picks a team already taken", () => {
    for (const seed of SEEDS) {
      const taken = pickCars(seeded(seed), 4).map((car) => car.teamId);
      for (const car of pickCars(seeded(seed + 1000), 3, taken)) {
        expect(taken).not.toContain(car.teamId);
      }
    }
  });

  it("picks only a team entered that season, in that season's colours", () => {
    for (const seed of SEEDS) {
      for (const car of pickCars(seeded(seed), 3)) {
        expect(seasonSeed(car.year).entries.map((entry) => entry.teamId)).toContain(car.teamId);
        expect(car.livery).toEqual(liveryFor(car.teamId, car.year));
      }
    }
  });

  it("reaches more than one season", () => {
    const years = new Set(
      SEEDS.flatMap((seed) => pickCars(seeded(seed), 3).map((car) => car.year)),
    );
    expect(years.size).toBeGreaterThan(1);
  });
});

describe("the parade's hidden game", () => {
  const GAMES: ParadeGame[] = [false, true].flatMap((reversed) =>
    [false, true].map((pressed) => ({ pressed, reversed })),
  );

  it("starts unpressed, the right way round", () => {
    expect(PARADE_START).toEqual({ pressed: false, reversed: false });
  });

  it("turns on each release of a press, each way in turn", () => {
    let game = PARADE_START;
    for (const reversed of [true, false, true, false]) {
      game = nextGame(game, "press");
      expect(game).toEqual({ pressed: true, reversed: !reversed });
      game = nextGame(game, "release");
      expect(game).toEqual({ pressed: false, reversed });
    }
  });

  it("does not turn on the press itself, nor on a press that is cancelled", () => {
    for (const reversed of [false, true]) {
      const pressed = nextGame({ pressed: false, reversed }, "press");
      expect(pressed.reversed).toBe(reversed);
      expect(nextGame(pressed, "cancel")).toEqual({ pressed: false, reversed });
    }
  });

  it("does nothing else: a release or cancel with no press, a press while pressed", () => {
    for (const game of GAMES) {
      if (game.pressed) {
        expect(nextGame(game, "press")).toBe(game);
      } else {
        expect(nextGame(game, "release")).toBe(game);
        expect(nextGame(game, "cancel")).toBe(game);
      }
    }
  });
});

describe("carLabel", () => {
  it("names a car as its team was called that year, with the year", () => {
    for (const seed of SEEDS.slice(0, 20)) {
      for (const car of pickCars(seeded(seed), 3)) {
        expect(carLabel(car)).toBe(`${teamName(car.teamId, car.year)} (${car.year})`);
      }
    }
  });

  it("takes the team's name from the namer it is given", () => {
    const nameOf = (teamId: string, year: number) => `${teamId}@${year}`;
    expect(carLabel({ teamId: "t1", year: 1970 }, nameOf)).toBe("t1@1970 (1970)");
  });
});
