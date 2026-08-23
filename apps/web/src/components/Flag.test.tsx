import { drivers, seasons, teams } from "@alt-hist/data";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Flag, hasFlag } from "./Flag.js";

describe("flags", () => {
  it("renders an SVG for a known country", () => {
    const html = renderToStaticMarkup(<Flag country="GB" />);
    expect(html).toContain("<svg");
  });

  it("accepts lower case and stray whitespace", () => {
    expect(renderToStaticMarkup(<Flag country=" it " />)).toBe(
      renderToStaticMarkup(<Flag country="IT" />),
    );
  });

  it("renders nothing rather than a placeholder for a code it does not know", () => {
    // A missing flag is quieter than a wrong one.
    expect(renderToStaticMarkup(<Flag country="ZZ" />)).toBe("");
    expect(renderToStaticMarkup(<Flag country="GBR" />)).toBe("");
    expect(renderToStaticMarkup(<Flag country="" />)).toBe("");
  });

  it("gives a different flag to different countries", () => {
    expect(renderToStaticMarkup(<Flag country="GB" />)).not.toBe(
      renderToStaticMarkup(<Flag country="FR" />),
    );
  });

  it("covers every nationality, team base and race country in the seed data", () => {
    // The guard that matters: seed data can grow a country the UI cannot draw,
    // and a silently absent flag is easy to miss by eye.
    for (const driver of drivers) {
      expect(hasFlag(driver.nationality), `driver ${driver.id}: ${driver.nationality}`).toBe(true);
    }
    for (const team of teams) {
      expect(hasFlag(team.base), `team ${team.id}: ${team.base}`).toBe(true);
    }
    for (const season of seasons.values()) {
      for (const race of season.calendar) {
        expect(hasFlag(race.country), `${season.year} round ${race.round}: ${race.country}`).toBe(
          true,
        );
      }
    }
  });
});
