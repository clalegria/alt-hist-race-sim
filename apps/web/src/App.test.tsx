/**
 * The reveal flow, stage by stage.
 *
 * `SeasonView` takes the world and the cursor as props, so every stage can be
 * rendered directly with `renderToStaticMarkup` — no DOM, no store, and no need
 * to click through fourteen rounds to see what round fourteen looks like. The
 * buttons are covered separately through `actionsFor`, which is the whole of the
 * navigation logic.
 */

import { championshipStandings, constructorStandings } from "@alt-hist/engine";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { actionsFor } from "./App.js";
import { SeasonView } from "./components/SeasonView.js";
import { driverName, teamName } from "./lib/names.js";
import { createWorld, type View } from "./store/season.js";

const world = createWorld(3);
const ROUNDS = world.season.races.length;

function render(view: View): string {
  return renderToStaticMarkup(<SeasonView world={world} view={view} />);
}

describe("the opening grid", () => {
  const html = render({ kind: "grid" });

  it("shows the teams and their drivers", () => {
    expect(html).toContain("Williams");
    expect(html).toContain("Alan Jones");
    expect(html).toContain("Nelson Piquet");
  });

  it("reveals nothing about the season yet", () => {
    // The point of starting here: no results, no standings, no championship.
    expect(html).not.toContain("Championship");
    expect(html).not.toContain("Qualifying");
    expect(html).not.toContain("Argentine GP");
    expect(html).not.toContain("Pts");
  });
});

describe("a qualifying session", () => {
  const html = render({ kind: "qualifying", round: 0 });

  it("is titled with the round it belongs to", () => {
    expect(html).toContain("Argentine GP");
    expect(html).toContain("Buenos Aires");
    expect(html).toContain("Qualifying");
  });

  it("forms up the whole entry list, pole first", () => {
    expect(html).toContain("pole");
    expect(html.split("<li").length - 1).toBe(28); // 26 on the grid, 2 alongside
    expect(html).toContain("Did not qualify");
  });

  it("does not leak the race that follows", () => {
    expect(html).not.toContain("Championship");
    expect(html).not.toContain("Retired");
  });
});

describe("a race", () => {
  const html = render({ kind: "race", round: 0 });

  it("shows the classification", () => {
    expect(html).toContain("Argentine GP");
    expect(html).toContain("winner");
    expect(html).toContain("Retired");
  });

  it("shows both championships as they stand after it", () => {
    expect(html).toContain("Drivers");
    expect(html).toContain("Constructors");
    expect(html).toContain("Championship after 1 round");
  });

  it("says how much of the season is left to run", () => {
    expect(html).toContain("Championship after 1 round (13 remaining)");
    expect(render({ kind: "race", round: 3 })).toContain(
      "Championship after 4 rounds (10 remaining)",
    );
    // Nothing remains after the last one, and "(0 remaining)" reads badly.
    expect(render({ kind: "race", round: ROUNDS - 1 })).not.toContain("remaining");
  });

  it("shows movement arrows from round two onward, never on round one", () => {
    // The contract as a reader meets it, rather than as a prop: on the opening
    // round there is nothing to have moved from.
    expect(html).not.toContain("▲");
    expect(html).not.toContain("▼");
    const later = render({ kind: "race", round: 3 });
    expect(later).toContain("▲");
    expect(later).toContain("▼");
  });

  it("counts only the rounds run so far", () => {
    // Standings mid-season are just the championship over fewer results — if
    // this said 14 rounds, the reveal would be showing the finished table.
    expect(render({ kind: "race", round: 4 })).toContain("Championship after 5 rounds");
    expect(render({ kind: "race", round: ROUNDS - 1 })).toContain(
      `Championship after ${ROUNDS} rounds`,
    );
  });

  it("carries points alongside the result, and nothing else", () => {
    // The sidebar exists to be scannable: after one round the full table's
    // wins, podiums, poles and DNF counts are almost all zeroes.
    for (const column of ["Wins", "Pods", "Poles", "DNF", "DNQ"]) {
      expect(html, `${column} should not be in the race sidebar`).not.toContain(`>${column}<`);
    }
    // The winner leads on the 9 points they just scored.
    expect(html).toContain(">9<");
  });

  it("does not show the calendar of races still to come", () => {
    expect(html).not.toContain("Watkins Glen");
  });
});

describe("the season summary", () => {
  const html = render({ kind: "summary" });

  it("names both champions", () => {
    expect(html).toContain("Drivers’ champion");
    expect(html).toContain("Constructors’ champion");
    expect(html).toMatch(/points from \d+ wins?\./);
  });

  it("lists every round with its pole and winner", () => {
    expect(html).toContain("Argentine GP");
    expect(html).toContain("Watkins Glen");
  });

  it("shows the final standings in full, not the compact sidebar", () => {
    expect(html).toContain("Final classification.");
    expect(html).not.toContain("Championship after");
    // The summary is where the full breakdown belongs.
    expect(html).toContain(">Wins<");
    expect(html).toContain(">Poles<");
  });

  it("still ends with the grid, in the same simplified form", () => {
    expect(html).toContain("Select any name for its full ratings");
  });
});

describe("flags", () => {
  /** The markup between two landmarks, so a count cannot stray into the next card. */
  const between = (html: string, from: string, to: string): string => {
    const start = html.indexOf(from);
    expect(start, `"${from}" not rendered`).toBeGreaterThan(-1);
    const end = html.indexOf(to, start);
    expect(end, `"${to}" not rendered after "${from}"`).toBeGreaterThan(start);
    return html.slice(start, end);
  };

  it("flies a flag on every name on the race page", () => {
    const html = render({ kind: "race", round: 0 });
    // One for the round, 28 down the classification, then the collapsed
    // sidebar: eight drivers and eight teams.
    expect((html.match(/<svg/g) ?? []).length).toBe(1 + 28 + 8 + 8);
  });

  it("flies a flag beside every driver in qualifying", () => {
    const html = render({ kind: "qualifying", round: 0 });
    expect((html.match(/<svg/g) ?? []).length).toBe(29); // 28 drivers plus the round
  });

  it("keeps the non-qualifiers off the starting grid", () => {
    // Cars outside the cut never form up, so they are listed apart rather than
    // taking a slot that would shift everyone behind them onto the wrong side.
    const html = render({ kind: "qualifying", round: 0 });
    const grid = html.slice(0, html.indexOf("Did not qualify"));
    expect(grid.split("<li").length - 1).toBe(26);
  });

  it("flies a flag on both champion cards", () => {
    const html = render({ kind: "summary" });
    const champion = championshipStandings(world.season)[0];
    const topTeam = constructorStandings(world.season)[0];
    if (champion === undefined || topTeam === undefined) {
      throw new Error("seeded world crowned nobody");
    }
    // Between the card's label and the name it announces there must be a flag.
    expect(between(html, "Drivers’ champion", driverName(champion.driverId))).toContain("<svg");
    expect(between(html, "Constructors’ champion", teamName(topTeam.teamId))).toContain("<svg");
  });

  it("flies a flag on every row of both championship tables", () => {
    const html = render({ kind: "summary" });
    const drivers = between(html, "Drivers’ Championship", "Constructors’ Championship");
    expect((drivers.match(/<svg/g) ?? []).length).toBe(28);
    const teams = between(html, "Constructors’ Championship", "Grid");
    expect((teams.match(/<svg/g) ?? []).length).toBe(15);
  });
});

describe("the buttons", () => {
  it("offers a step and a skip on the grid, and no way back", () => {
    expect(actionsFor({ kind: "grid" }, ROUNDS)).toEqual({
      next: "Simulate next session",
      skip: "Simulate full season",
    });
  });

  it("offers a step and a skip through the season", () => {
    for (const round of [0, 5, ROUNDS - 2]) {
      expect(actionsFor({ kind: "qualifying", round }, ROUNDS).next).toBe("Simulate next session");
      expect(actionsFor({ kind: "race", round }, ROUNDS).skip).toBe("Simulate rest of the season");
    }
    // Qualifying for the last round still has a race left to skip past.
    expect(actionsFor({ kind: "qualifying", round: ROUNDS - 1 }, ROUNDS).skip).toBe(
      "Simulate rest of the season",
    );
  });

  it("drops the skip after the last race and offers the summary", () => {
    expect(actionsFor({ kind: "race", round: ROUNDS - 1 }, ROUNDS)).toEqual({
      next: "Show season summary",
      skip: null,
    });
  });

  it("offers nothing forward from the summary", () => {
    expect(actionsFor({ kind: "summary" }, ROUNDS)).toEqual({ next: null, skip: null });
  });
});
