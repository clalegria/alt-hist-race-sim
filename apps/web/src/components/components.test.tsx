/**
 * Component-level rendering checks.
 *
 * The expanded race classification cannot be reached from `App` in a static
 * render — opening it is a click, and there is no DOM here — so it is rendered
 * directly instead. Same for the grid, which is worth checking on its own
 * because it is the only place raw ratings are shown.
 */

import { championshipStandings, constructorStandings } from "@alt-hist/engine";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { driverName } from "../lib/names.js";
import { carOverall, driverOverall } from "../lib/rating.js";
import { positionsOf } from "../lib/standings.js";
import { createWorld } from "../store/season.js";
import { CompactStandings } from "./CompactStandings.js";
import { QualifyingResults } from "./QualifyingResults.js";
import { RaceClassification } from "./RaceClassification.js";
import { SeasonGrid } from "./SeasonGrid.js";

const world = createWorld(3);

describe("the race classification", () => {
  const race = world.season.races[0];
  if (race === undefined) {
    throw new Error("seeded world has no races");
  }
  const html = renderToStaticMarkup(<RaceClassification race={race} />);

  it("lists every car that entered, not just the finishers", () => {
    expect(race.entries).toHaveLength(28);
    for (const entry of race.entries) {
      expect(html, `missing ${entry.driverId}`).toContain(driverName(entry.driverId));
    }
    // And one row each, so nobody is listed twice.
    expect(html.split("<tr").length - 1).toBe(29); // 28 cars plus the header
  });

  it("shows what each finish was worth, and leaves the rest blank", () => {
    const rows = html.split("<tr").slice(1);
    const rowFor = (driverId: string): string => {
      const row = rows.find((candidate) => candidate.includes(driverName(driverId)));
      if (row === undefined) {
        throw new Error(`no row rendered for ${driverId}`);
      }
      return row;
    };
    const classified = [...race.entries]
      .filter((entry) => entry.finishPosition !== null)
      .sort((a, b) => (a.finishPosition ?? 0) - (b.finishPosition ?? 0));

    // The top six score 9-6-4-3-2-1 and each shows its own total.
    for (const [index, points] of [9, 6, 4, 3, 2, 1].entries()) {
      const entry = classified[index];
      if (entry === undefined) {
        throw new Error("fewer than six finishers in the seeded race");
      }
      expect(rowFor(entry.driverId), `P${index + 1}`).toContain(`>${points}<`);
    }
    // Seventh scored nothing, and a column of zeroes helps nobody.
    const seventh = classified[6];
    if (seventh === undefined) {
      throw new Error("fewer than seven finishers in the seeded race");
    }
    expect(rowFor(seventh.driverId)).not.toMatch(/>\d+<\/td><\/tr>/);
    expect(html).toContain(">Pts<");
  });

  it("gives no points to a car that did not finish", () => {
    const rows = html.split("<tr").slice(1);
    for (const entry of race.entries) {
      if (entry.finishPosition !== null) {
        continue;
      }
      const row = rows.find((candidate) => candidate.includes(driverName(entry.driverId)));
      expect(row, `no row for ${entry.driverId}`).toBeDefined();
      expect(row ?? "", `${entry.driverId} was awarded points`).not.toMatch(
        />[1-9]\d*<\/td>\s*<\/tr>/,
      );
    }
  });

  it("marks the winner and shows gaps for the rest", () => {
    expect(html).toContain("winner");
    expect(html).toMatch(/\+\d+\.\d{3}s/);
  });

  it("distinguishes retirements from non-qualifiers", () => {
    const retired = race.entries.some((entry) => entry.retired);
    const dnq = race.entries.some((entry) => !entry.started);
    expect(retired).toBe(true);
    expect(dnq).toBe(true);
    expect(html).toContain("Retired");
    expect(html).toContain("Did not qualify");
  });

  it("never prints a gap on a row that did not finish", () => {
    // A retirement is not "n seconds behind" — it stopped. Asserting on the
    // rendered row rather than on the data, because the data is the engine's
    // business and it is this component that could still print a lie.
    const rows = html.split("<tr").slice(1);
    const rowFor = (driverId: string): string => {
      const name = driverName(driverId);
      const row = rows.find((candidate) => candidate.includes(name));
      if (row === undefined) {
        throw new Error(`no row rendered for ${driverId}`);
      }
      return row;
    };

    let checked = 0;
    for (const entry of race.entries) {
      if (entry.finishPosition !== null) {
        continue;
      }
      const row = rowFor(entry.driverId);
      expect(row, `${entry.driverId} was given a gap`).not.toMatch(/\+\d/);
      expect(row).toContain("—");
      checked += 1;
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe("the season grid", () => {
  const html = renderToStaticMarkup(<SeasonGrid field={world.field} seasonYear={1980} />);

  it("groups every driver under their team", () => {
    expect(html).toContain("Williams");
    expect(html).toContain("Alan Jones");
    expect(html).toContain("Carlos Reutemann");
    expect(html).toContain("Shadow");
    expect(html).toContain("David Kennedy");
  });

  it("draws a flag for every driver and every team", () => {
    // 28 drivers plus 15 teams, each with an inline SVG flag.
    expect(html.split("<svg").length - 1).toBe(43);
  });

  it("shows each driver's age beside their name, not next to their rating", () => {
    // "Alan Jones (34y)  89" reads; "Alan Jones  34 89" reads as two ratings.
    expect(html).toContain("(34y)"); // Jones, born 1946
    expect(html).toContain("(22y)"); // de Angelis, born 1958
  });

  it("shows an overall for every driver and every car", () => {
    // One per driver, one per team: the number you can scan the grid by.
    const jones = world.field.find((entrant) => entrant.driverId === "jones");
    if (jones === undefined) {
      throw new Error("Jones is not on the grid");
    }
    expect(html).toContain(`>${driverOverall(jones.driver)}<`);
    expect(html).toContain(`>${carOverall(jones.car)}<`);
  });

  it("keeps the individual ratings out of sight until a name is selected", () => {
    // The point of the reveal: the opening page shows one number per driver, not
    // the breakdown. Popover contents are not rendered while closed.
    expect(html).not.toContain("Reliability");
    expect(html).not.toContain("Adaptability");
    expect(html).not.toContain("Composure");
  });

  it("orders teams alphabetically, not by pace", () => {
    // Sorting by car rating would give the season away before it started.
    const positionOf = (name: string): number => html.indexOf(`>${name}<`);
    expect(positionOf("Alfa Romeo")).toBeLessThan(positionOf("Williams"));
    expect(positionOf("ATS")).toBeLessThan(positionOf("Brabham"));
  });
});

describe("the compact standings", () => {
  const drivers = championshipStandings(world.season);
  const teams = constructorStandings(world.season);
  const driverHtml = renderToStaticMarkup(<CompactStandings title="Drivers" standings={drivers} />);
  const teamHtml = renderToStaticMarkup(
    <CompactStandings title="Constructors" standings={teams} />,
  );

  it("shows only the top eight until it is expanded", () => {
    expect(drivers.length).toBe(28);
    expect(teams.length).toBe(15);
    // One row each, and one flag per row, so counting flags counts rows.
    expect((driverHtml.match(/<svg/g) ?? []).length).toBe(8);
    expect((teamHtml.match(/<svg/g) ?? []).length).toBe(8);
    // The ninth-placed driver is out of sight.
    const ninth = drivers[8];
    if (ninth === undefined) {
      throw new Error("expected more than eight drivers");
    }
    expect(driverHtml).not.toContain(driverName(ninth.driverId));
  });

  it("offers a way to see the rest, naming how many there are", () => {
    expect(driverHtml).toContain("Show all 28");
    expect(teamHtml).toContain("Show all 15");
    expect(driverHtml).toContain('aria-expanded="false"');
  });

  it("does not offer to expand a table that already fits", () => {
    const short = renderToStaticMarkup(
      <CompactStandings title="Drivers" standings={drivers.slice(0, 5)} />,
    );
    expect(short).not.toContain("Show all");
    expect((short.match(/<svg/g) ?? []).length).toBe(5);
  });

  it("marks who gained and who lost places since the previous round", () => {
    // Positions after round 1 against positions after round 2: anyone whose
    // number went down climbed, and must carry an up arrow.
    const afterOne = championshipStandings({ races: world.season.races.slice(0, 1) });
    const afterTwo = championshipStandings({ races: world.season.races.slice(0, 2) });
    const previous = positionsOf(afterOne);
    const moved = afterTwo
      .map((standing, index) => ({
        name: driverName(standing.driverId),
        places: (previous.get(standing.driverId) ?? 0) - (index + 1),
      }))
      .slice(0, 8);
    expect(
      moved.some((row) => row.places > 0),
      "nobody climbed between rounds",
    ).toBe(true);
    expect(
      moved.some((row) => row.places < 0),
      "nobody dropped between rounds",
    ).toBe(true);

    const withArrows = renderToStaticMarkup(
      <CompactStandings title="Drivers" standings={afterTwo} previousPositions={previous} />,
    );
    expect((withArrows.match(/▲/g) ?? []).length).toBe(
      moved.filter((row) => row.places > 0).length,
    );
    expect((withArrows.match(/▼/g) ?? []).length).toBe(
      moved.filter((row) => row.places < 0).length,
    );
    expect(withArrows).toContain("text-gain");
    expect(withArrows).toContain("text-loss");
  });

  it("shows no arrows at all when there is no previous round", () => {
    // Round one: everyone would otherwise read as having climbed from nowhere.
    expect(driverHtml).not.toContain("▲");
    expect(driverHtml).not.toContain("▼");
  });

  it("says which way and how far, not just colour", () => {
    // An arrow distinguished only by hue tells a colourblind reader nothing.
    const afterOne = championshipStandings({ races: world.season.races.slice(0, 1) });
    const afterTwo = championshipStandings({ races: world.season.races.slice(0, 2) });
    const html = renderToStaticMarkup(
      <CompactStandings
        title="Drivers"
        standings={afterTwo}
        previousPositions={positionsOf(afterOne)}
      />,
    );
    expect(html).toMatch(/title="(Up|Down) \d+ places?"/);
  });

  it("names each driver's team, and carries points but no other column", () => {
    expect(driverHtml).toContain("Williams");
    expect(driverHtml).toContain("Brabham");
    for (const column of ["Wins", "Pods", "Poles", "DNF", "DNQ"]) {
      expect(driverHtml, `${column} should not be here`).not.toContain(`>${column}<`);
    }
  });
});

describe("the starting grid layout", () => {
  const race = world.season.races[0];
  if (race === undefined) {
    throw new Error("seeded world has no races");
  }
  const html = renderToStaticMarkup(<QualifyingResults race={race} />);

  it("sets back the even slots, and only those", () => {
    // The offset rides an `even:` variant, so the class string is identical on
    // every slot and CSS decides which ones move. Two things are checkable from
    // the markup: that the variant is `even` and not `odd` — swapping them puts
    // pole on the back row — and that every slot on the grid carries it, so no
    // car was left out of the formation.
    expect(html).toContain("sm:even:translate-y-");
    expect(html).not.toContain("odd:translate-y-");

    const grid = html.slice(0, html.indexOf("Did not qualify"));
    const slots = grid.split("<li").slice(1);
    expect(slots).toHaveLength(26);
    for (const [index, slot] of slots.entries()) {
      expect(slot.includes("even:translate-y"), `slot ${index + 1} is not in formation`).toBe(true);
    }
  });

  it("does not stagger the cars that failed to qualify", () => {
    // They never form up, so a staggered pair there would be pure decoration.
    const dnq = html.slice(html.indexOf("Did not qualify"));
    expect(dnq).not.toContain("even:translate-y");
  });

  it("offsets by exactly half a row, so the cars are evenly spaced", () => {
    // The geometry invariant. Car N sits at (N-1) x step/2 down the page only
    // while the offset is half the row height; drift them apart and P2 ends up
    // nearer P1 than P3 is, which stops looking like a grid.
    const rowHeight = html.match(/auto-rows-\[([\d.]+)rem\]/)?.[1];
    const offset = html.match(/even:translate-y-\[([\d.]+)rem\]/)?.[1];
    expect(rowHeight, "row height class missing").toBeDefined();
    expect(offset, "offset class missing").toBeDefined();
    expect(Number(offset)).toBeCloseTo(Number(rowHeight) / 2, 5);
  });

  it("marks pole and shows everyone else's gap to it", () => {
    expect(html).toContain("pole");
    expect(html).toMatch(/\+\d+\.\d{3}s/);
  });

  it("names every car's team on the grid", () => {
    expect(html).toContain("Renault");
    expect(html).toContain("Williams");
    expect(html).toContain("Shadow");
  });
});
