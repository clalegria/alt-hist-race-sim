/**
 * The car on the champion cards: that it wears the team's colours by the same
 * rule the badge does, that its wheels are the only thing that moves, and that
 * both cards carry one.
 *
 * Synthetic liveries throughout; the real ones are seed data.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Livery } from "@alt-hist/data";
import { championshipStandings, constructorStandings } from "@alt-hist/engine";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CAR_SPRITES, SPRITE_HEIGHT, SPRITE_WIDTH } from "../lib/car-sprites.js";
import { driverName } from "../lib/names.js";
import { seededWorld, YEAR } from "../test-support.js";
import { ChampionCar } from "./ChampionCar.js";
import { Liveries } from "./Liveries.js";
import { SeasonView } from "./SeasonView.js";

const PRIMARY = "#aa0000";
const ACCENT_1 = "#00bb00";
const ACCENT_2 = "#0000cc";

function livery(badgeStripes: number): Livery {
  return {
    primaryColor: PRIMARY,
    secondaryColor1: ACCENT_1,
    secondaryColor2: ACCENT_2,
    badgeStripes,
  };
}

/** How many of the car's paths are filled with `colour`. */
function pathsIn(html: string, colour: string): number {
  return html.split(`fill:${colour}`).length - 1;
}

/** Every sprite, in one livery. */
function cars(stripes: number): string[] {
  return CAR_SPRITES.map((sprite) =>
    renderToStaticMarkup(<ChampionCar sprite={sprite} livery={livery(stripes)} />),
  );
}

/** The marker of a car in a rendered tree: its canvas. */
const CANVAS = `viewBox="0 0 ${SPRITE_WIDTH} ${SPRITE_HEIGHT}"`;

describe("the car's colours", () => {
  it("paints the body in the primary colour", () => {
    for (const html of cars(0)) {
      expect(pathsIn(html, PRIMARY)).toBeGreaterThan(0);
    }
  });

  it("wears both accents as stripes when the badge has two", () => {
    for (const html of cars(2)) {
      expect(pathsIn(html, ACCENT_2)).toBeGreaterThan(0);
    }
  });

  it("wears only the first accent when the badge has one stripe", () => {
    for (const html of cars(1)) {
      expect(pathsIn(html, ACCENT_1)).toBeGreaterThan(1);
      expect(pathsIn(html, ACCENT_2)).toBe(0);
    }
  });

  it("wears no stripe when the badge has none, keeping the accent for the helmet", () => {
    for (const html of cars(0)) {
      expect(pathsIn(html, ACCENT_2)).toBe(0);
      expect(pathsIn(html, ACCENT_1)).toBe(1);
    }
  });

  it("is hidden from screen readers, since the card names the team in words", () => {
    for (const html of cars(1)) {
      expect(html).toContain('aria-hidden="true"');
    }
  });
});

describe("the car's animation", () => {
  const css = readFileSync(fileURLToPath(new URL("../index.css", import.meta.url)), "utf-8");

  it("turns every wheel, and only for a reader who has not asked for less motion", () => {
    CAR_SPRITES.forEach((sprite, i) => {
      const html = cars(1)[i] ?? "";
      expect(html.split("motion-safe:animate-wheel").length - 1).toBe(sprite.wheels.length);
      expect(html).not.toMatch(/(?<!motion-safe:)animate-wheel/);
    });
  });

  it("turns them a quarter at a time, the only rotation pixel art survives", () => {
    const declaration = css.match(/--animate-wheel: *([^;]+);/)?.[1] ?? "";
    expect(declaration).toContain("wheel-turn");
    expect(declaration).toContain("steps(4)");
    expect(css).toContain("@keyframes wheel-turn");
  });
});

describe("the champion cards", () => {
  const world = seededWorld();
  const summary = renderToStaticMarkup(
    <Liveries year={YEAR}>
      <SeasonView world={world} view={{ kind: "summary" }} />
    </Liveries>,
  );

  it("draw a car on both", () => {
    expect(summary.split(CANVAS).length - 1).toBe(2);
  });

  it("draw each car after the words, at the card's right-hand edge", () => {
    const champion = championshipStandings(world.season, world.points)[0];
    const topTeam = constructorStandings(world.season, world.points)[0];
    if (champion === undefined || topTeam === undefined) {
      throw new Error("seeded world crowned nobody");
    }
    const drivers = summary.indexOf("Drivers’ champion");
    const constructors = summary.indexOf("Constructors’ champion");
    const driversCard = summary.slice(drivers, constructors);
    expect(driversCard.indexOf(CANVAS)).toBeGreaterThan(
      driversCard.indexOf(driverName(champion.driverId)),
    );
    const constructorsCard = summary.slice(constructors);
    expect(constructorsCard.indexOf(CANVAS)).toBeGreaterThan(
      constructorsCard.indexOf(`${topTeam.points} points`),
    );
  });
});
