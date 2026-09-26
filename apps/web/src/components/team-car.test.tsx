/**
 * A team's car: that it wears the team's colours by the same rule the badge
 * does, where it appears, that it is one size everywhere but the champion
 * cards, and that only there do its wheels turn.
 *
 * Synthetic liveries throughout; the real ones are seed data.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Livery } from "@alt-hist/data";
import { championshipStandings, constructorStandings } from "@alt-hist/engine";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CAR_SPRITES, carSpriteFor, SPRITE_HEIGHT, SPRITE_WIDTH } from "../lib/car-sprites.js";
import { driverName } from "../lib/names.js";
import { seededWorld, YEAR } from "../test-support.js";
import { Liveries } from "./Liveries.js";
import { QualifyingResults } from "./QualifyingResults.js";
import { RaceClassification } from "./RaceClassification.js";
import { SeasonStandings } from "./SeasonStandings.js";
import { SeasonView } from "./SeasonView.js";
import { CAR_SIZES, LiveryCar } from "./TeamCar.js";

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

/** Every decade's car, in one livery. */
function cars(stripes: number, animated = false): string[] {
  return CAR_SPRITES.map((sprite) =>
    renderToStaticMarkup(
      <LiveryCar livery={livery(stripes)} year={sprite.decade} animated={animated} />,
    ),
  );
}

/** The marker of a car in a rendered tree: its canvas. */
const CANVAS = `viewBox="0 0 ${SPRITE_WIDTH} ${SPRITE_HEIGHT}"`;

/** The class list of every car in a rendered tree. */
function carClasses(html: string): string[] {
  return html
    .split(CANVAS)
    .slice(1)
    .map((after) => after.match(/class="([^"]*)"/)?.[1] ?? "");
}

/**
 * The table cells in a rendered tree that hold a car, as their text: a car in a
 * column of its own has none, a car sharing a cell with a name has the name.
 */
function carCellTexts(html: string): string[] {
  return html
    .split("<td")
    .slice(1)
    .map((cell) => cell.slice(0, cell.indexOf("</td>")))
    .filter((cell) => cell.includes(CANVAS))
    .map((cell) =>
      cell
        .replace(/<[^>]*>/g, "")
        .replace(/^[^>]*>/, "")
        .trim(),
    );
}

/** Whether a class list carries a size, as a whole: both its classes. */
function hasSize(classes: string, size: string): boolean {
  const own = classes.split(" ");
  return size.split(" ").every((part) => own.includes(part));
}

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

  it("is hidden from screen readers, since the team is named in words beside it", () => {
    for (const html of cars(1)) {
      expect(html).toContain('aria-hidden="true"');
    }
  });
});

describe("the car's animation", () => {
  const css = readFileSync(fileURLToPath(new URL("../index.css", import.meta.url)), "utf-8");

  it("turns every wheel when asked, and only for a reader who has not asked for less motion", () => {
    CAR_SPRITES.forEach((sprite, i) => {
      const html = cars(1, true)[i] ?? "";
      expect(html.split("motion-safe:animate-wheel").length - 1).toBe(sprite.wheels.length);
      expect(html).not.toMatch(/(?<!motion-safe:)animate-wheel/);
    });
  });

  it("stands still unless asked", () => {
    for (const html of cars(1)) {
      expect(html).not.toContain("animate-wheel");
    }
  });

  it("turns them a quarter at a time, the only rotation pixel art survives", () => {
    const declaration = css.match(/--animate-wheel: *([^;]+);/)?.[1] ?? "";
    expect(declaration).toContain("wheel-turn");
    expect(declaration).toContain("steps(4)");
    expect(css).toContain("@keyframes wheel-turn");
  });
});

describe("the race screens", () => {
  const world = seededWorld();
  const race = world.season.races[0];
  if (race === undefined) {
    throw new Error("seeded world has no races");
  }
  const qualifying = renderToStaticMarkup(
    <Liveries year={YEAR}>
      <QualifyingResults race={race} />
    </Liveries>,
  );
  const classification = (car: boolean) =>
    renderToStaticMarkup(
      <Liveries year={YEAR}>
        <RaceClassification race={race} points={world.points} badge car={car} />
      </Liveries>,
    );

  it("put a car in every qualifying slot", () => {
    // Counted off the entry list: a non-qualifier's slot has one too.
    expect(carClasses(qualifying)).toHaveLength(race.entries.length);
  });

  it("put a car on every row of the race sheet that asks for one, and none otherwise", () => {
    expect(carClasses(classification(true))).toHaveLength(race.entries.length);
    expect(carClasses(classification(false))).toHaveLength(0);
  });

  it("give the race sheet's cars a column of their own, so they line up past the longest name", () => {
    const cells = carCellTexts(classification(true));
    expect(cells).toHaveLength(race.entries.length);
    expect(cells.every((text) => text === "")).toBe(true);
  });

  it("ask for them on the race screen itself", () => {
    // The sheet is also opened out of the calendar, where it draws none; the
    // screen is the call site that has to ask.
    const screen = renderToStaticMarkup(
      <SeasonView world={world} view={{ kind: "race", round: 0 }} />,
    );
    expect(carClasses(screen)).toHaveLength(race.entries.length);
  });

  it("draw every one at the shared small size, standing still", () => {
    const both = qualifying + classification(true);
    for (const classes of carClasses(both)) {
      expect(hasSize(classes, CAR_SIZES.small)).toBe(true);
    }
    expect(both).not.toContain("animate-wheel");
  });
});

describe("the champion cards", () => {
  const world = seededWorld();
  const summary = renderToStaticMarkup(
    <Liveries year={YEAR}>
      <SeasonView world={world} view={{ kind: "summary" }} />
    </Liveries>,
  );

  it("draw a car on both, large and turning, and are the only ones that are", () => {
    const large = carClasses(summary).filter((classes) => hasSize(classes, CAR_SIZES.large));
    expect(large).toHaveLength(2);
    // Every turning wheel on the page belongs to one of those two cars.
    const wheels = carSpriteFor(YEAR).wheels.length;
    expect(summary.split("motion-safe:animate-wheel").length - 1).toBe(2 * wheels);
  });

  it("draw no rule under their words", () => {
    // A header's bottom rule separates it from a body, and these cards have
    // none. Two cards side by side stretch to one height, so on the one with
    // fewer words the rule floated across the middle of the card.
    for (const label of ["Drivers’ champion", "Constructors’ champion"]) {
      const header = summary.slice(0, summary.indexOf(label)).split("<header").at(-1) ?? "";
      const classes = header.match(/class="([^"]*)"/)?.[1]?.split(" ") ?? [];
      expect(classes).toContain("border-b-0");
      expect(classes).not.toContain("border-b");
    }
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

describe("the championship tables", () => {
  const world = seededWorld();
  const summary = renderToStaticMarkup(
    <Liveries year={YEAR}>
      <SeasonView world={world} view={{ kind: "summary" }} />
    </Liveries>,
  );
  const between = (from: string, to: string) =>
    summary.slice(summary.indexOf(from), summary.indexOf(to, summary.indexOf(from)));

  it("put a small car on every row of both tables on the season summary", () => {
    const drivers = championshipStandings(world.season, world.points).length;
    const teams = constructorStandings(world.season, world.points).length;
    const driverCars = carClasses(between("Drivers’ Championship", "Constructors’ Championship"));
    const teamCars = carClasses(between("Constructors’ Championship", "Grid"));
    expect(driverCars).toHaveLength(drivers);
    expect(teamCars).toHaveLength(teams);
    for (const classes of [...driverCars, ...teamCars]) {
      expect(hasSize(classes, CAR_SIZES.small)).toBe(true);
    }
  });

  it("give the cars a column of their own, so they line up past the longest name", () => {
    const cells = carCellTexts(between("Drivers’ Championship", "Grid"));
    expect(cells.length).toBeGreaterThan(0);
    expect(cells.every((text) => text === "")).toBe(true);
  });

  it("draw none where they are opened out of the roll of honour", () => {
    // `SeasonStandings` with no `car`, as `EraChampions` renders it.
    const expansion = renderToStaticMarkup(
      <Liveries year={YEAR}>
        <SeasonStandings
          season={world.season}
          calendar={[]}
          points={world.points}
          description="Final classification."
        />
      </Liveries>,
    );
    expect(carClasses(expansion)).toHaveLength(0);
  });
});
