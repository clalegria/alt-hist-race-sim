/**
 * Component-level rendering checks.
 *
 * The expanded race classification cannot be reached from `App` in a static
 * render — opening it is a click, and there is no DOM here — so it is rendered
 * directly instead. Same for the grid, which is worth checking on its own
 * because it is the only place raw ratings are shown.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { driverName } from "../lib/names.js";
import { createWorld } from "../store/season.js";
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
  const html = renderToStaticMarkup(<SeasonGrid field={world.field} />);

  it("groups every driver under their team", () => {
    expect(html).toContain("Williams");
    expect(html).toContain("Alan Jones");
    expect(html).toContain("Carlos Reutemann");
    expect(html).toContain("Shadow");
    expect(html).toContain("David Kennedy");
  });

  it("shows the ratings the season actually ran on", () => {
    const jones = world.field.find((entrant) => entrant.driverId === "jones");
    if (jones === undefined) {
      throw new Error("Jones is not on the grid");
    }
    // Every one of his five ratings must appear as a cell value.
    for (const rating of Object.values(jones.driver)) {
      expect(html).toContain(`>${rating}<`);
    }
    expect(html).toContain(`>${jones.car.reliability}<`);
  });

  it("says what adaptability is for, since nothing reads it yet", () => {
    expect(html).toContain("Adaptability is authored but not yet read");
  });
});
