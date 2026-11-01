/**
 * A team's car: that it wears the team's colours by the same rule the badge
 * does, where it appears, that it is one size everywhere but the champion
 * cards, and that only there (and on the home screen's track, tested in
 * `home-track.test.tsx`) do its wheels turn.
 *
 * Synthetic liveries throughout; the real ones are seed data.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Livery } from "@alt-hist/data";
import { championshipStandings, constructorStandings } from "@alt-hist/engine";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CANVAS_HEIGHT, CANVAS_WIDTH, CAR_DRAWINGS, carDrawingFor } from "../lib/car-drawings.js";
import { driverName } from "../lib/names.js";
import { seededWorld, shownAt, textOf, YEAR } from "../test-support.js";
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
  return CAR_DRAWINGS.map((drawing) =>
    renderToStaticMarkup(
      <LiveryCar livery={livery(stripes)} year={drawing.decade} animated={animated} />,
    ),
  );
}

/** The marker of a car in a rendered tree: its canvas. */
const CANVAS = `viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}"`;

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
      textOf(cell)
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

  it("wears no accent at all when the badge has no stripe, the helmet included", () => {
    for (const html of cars(0)) {
      expect(pathsIn(html, ACCENT_2)).toBe(0);
      expect(pathsIn(html, ACCENT_1)).toBe(0);
    }
  });

  it("is hidden from screen readers, since the team is named in words beside it", () => {
    for (const html of cars(1)) {
      expect(html).toContain('aria-hidden="true"');
    }
  });
});

describe("the car's outline", () => {
  const car = (size: "small" | "large" | "card") =>
    renderToStaticMarkup(<LiveryCar livery={livery(1)} year={YEAR} size={size} />);

  it("holds its width on screen at the app's two sizes", () => {
    expect(car("small")).toContain('vector-effect="non-scaling-stroke"');
    expect(car("large")).toContain('vector-effect="non-scaling-stroke"');
  });

  it("grows with the share card's car, which its band sizes", () => {
    expect(car("card")).not.toContain("non-scaling-stroke");
    expect(car("card")).toContain(`aspect-ratio:${CANVAS_WIDTH} / ${CANVAS_HEIGHT}`);
  });
});

describe("the car's animation", () => {
  const css = readFileSync(fileURLToPath(new URL("../index.css", import.meta.url)), "utf-8");

  it("turns every wheel when asked, and only for a reader who has not asked for less motion", () => {
    CAR_DRAWINGS.forEach((drawing, i) => {
      const html = cars(1, true)[i] ?? "";
      expect(html.split("motion-safe:animate-wheel").length - 1).toBe(drawing.wheels.length);
      expect(html).not.toMatch(/(?<!motion-safe:)animate-wheel/);
    });
  });

  it("stands still unless asked", () => {
    for (const html of cars(1)) {
      expect(html).not.toContain("animate-wheel");
    }
  });

  it("spins them smoothly and steadily, never in steps", () => {
    const declaration = css.match(/--animate-wheel: *([^;]+);/)?.[1] ?? "";
    expect(declaration).toContain("wheel-turn");
    expect(declaration).toContain("linear");
    expect(declaration).not.toContain("steps(");
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
      <SeasonView {...shownAt(world, { kind: "race", round: 0 })} />,
    );
    // The podium's large cars aside: those are its own, not the table's.
    const rows = carClasses(screen).filter((classes) => hasSize(classes, CAR_SIZES.small));
    expect(rows).toHaveLength(race.entries.length);
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
      <SeasonView {...shownAt(world, { kind: "summary" })} />
    </Liveries>,
  );

  it("draw a car on both, large and turning, and are the only ones that are", () => {
    const large = carClasses(summary).filter((classes) => hasSize(classes, CAR_SIZES.large));
    expect(large).toHaveLength(2);
    // Every turning wheel on the page belongs to one of those two cars.
    const wheels = carDrawingFor(YEAR).wheels.length;
    expect(summary.split("motion-safe:animate-wheel").length - 1).toBe(2 * wheels);
  });

  it("draw each car in the band beside the label, and the words beneath", () => {
    // The car's place never depends on how long the name is: it rides in the
    // band, the same in both cards, and the name and detail are the body's.
    const champion = championshipStandings(world.season, world.points)[0];
    const topTeam = constructorStandings(world.season, world.points)[0];
    if (champion === undefined || topTeam === undefined) {
      throw new Error("seeded world crowned nobody");
    }
    const cards = [
      { label: "Drivers’ champion", words: driverName(champion.driverId) },
      { label: "Constructors’ champion", words: `${topTeam.points} points` },
    ];
    for (const { label, words } of cards) {
      const start = summary.lastIndexOf("<header", summary.indexOf(label));
      const end = summary.indexOf("</header>", start);
      const band = summary.slice(start, end);
      expect(textOf(band)).toBe(label);
      expect(band).toContain(CANVAS);
      expect(summary.indexOf(words, end)).toBeGreaterThan(end);
    }
  });
});

describe("the championship tables", () => {
  const world = seededWorld();
  const summary = renderToStaticMarkup(
    <Liveries year={YEAR}>
      <SeasonView {...shownAt(world, { kind: "summary" })} />
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
        <SeasonStandings season={world.season} calendar={[]} points={world.points} label="Final" />
      </Liveries>,
    );
    expect(carClasses(expansion)).toHaveLength(0);
  });
});
