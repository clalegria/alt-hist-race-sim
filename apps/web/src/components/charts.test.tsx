/**
 * The standings evolution charts, as far as a DOM-less render can see them.
 *
 * **Recharts draws nothing without a DOM** — a static render produces the card,
 * the heading and an empty container, whether or not the chart is given a fixed
 * size. That is why the fold lives in `lib/evolution.ts` (tested there, on its
 * own) and why the legend is plain HTML rather than Recharts' own: the names,
 * their order and their totals are the half of the card that can still be
 * asserted, and they are also the half a reader on a phone gets.
 *
 * Nothing here names a driver, a team or a colour out of the seed data. What is
 * checked is that the legend agrees with the championship table under it, and
 * that a line's colour is the one `lib/livery.ts` resolves for its team.
 */

import { championshipStandings, constructorStandings } from "@alt-hist/engine";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TOP_DRIVERS, TOP_TEAMS } from "../lib/evolution.js";
import { legible, liveryFor } from "../lib/livery.js";
import { driverName } from "../lib/names.js";
import { SEED, seededWorld, shownAt, YEAR } from "../test-support.js";
import { Liveries } from "./Liveries.js";
import { SeasonStandings } from "./SeasonStandings.js";
import { SeasonView } from "./SeasonView.js";
import { dashGradient, endLabelNudges, legendColumns, plotSeries } from "./StandingsEvolution.js";

const world = seededWorld();
const summary = renderToStaticMarkup(
  <Liveries year={YEAR}>
    <SeasonView {...shownAt(world, { kind: "summary" })} />
  </Liveries>,
);

/** A series as the fold hands it over, with only what `plotSeries` reads set. */
function series(key: string, teamId: string) {
  return { key, teamId, points: [0] };
}

describe("plotSeries", () => {
  it("draws every car in its own team's colours", () => {
    // Colour follows the entity, never its position: a driver does not change
    // colour for finishing second.
    const lines = plotSeries(
      [series("a", "one"), series("b", "two")],
      (key) => key,
      (teamId) => `colour-of-${teamId}`,
    );
    expect(lines.map((line) => line.colour)).toEqual(["colour-of-one", "colour-of-two"]);
    expect(lines.map((line) => line.name)).toEqual(["a", "b"]);
  });

  it("dashes a team-mate rather than recolouring them", () => {
    // Team-mates in the top six is the ordinary case — 1950 puts three Alfas in
    // the first three places — and drawn plainly they would be one line traced
    // three times. Each car of a team takes a *different* dash, so the third
    // is not a copy of the second.
    const lines = plotSeries(
      [series("a", "one"), series("b", "one"), series("c", "one"), series("d", "two")],
      (key) => key,
      () => "a-colour",
    );
    const [first, second, third, other] = lines;
    expect(first?.dash).toBe("");
    expect(second?.dash).not.toBe("");
    expect(third?.dash).not.toBe(second?.dash);
    // A different team starts over: it is the colour that separates them.
    expect(other?.dash).toBe("");
  });

  it("draws the legend's mark with the line's own dash pattern", () => {
    // One set of numbers behind both, so the mark beside a name cannot come to
    // describe a different line from the one on the chart.
    expect(dashGradient("red", "")).toBe("red");
    const gradient = dashGradient("red", "5 4");
    expect(gradient).toContain("red 0px 5px");
    expect(gradient).toContain("transparent 5px 9px");
    // An odd-length pattern alternates on its second pass, so a whole cycle is
    // twice the numbers written down.
    expect(dashGradient("red", "1 4 2").match(/red/g)).toHaveLength(3);
  });

  it("still draws a line for a team it has no colours for", () => {
    // A missing badge is quieter than a wrong one; a missing *line* would drop
    // a competitor off the chart without saying so.
    const [line] = plotSeries(
      [series("a", "nobody")],
      (key) => key,
      () => undefined,
    );
    expect(line?.colour).toBeTruthy();
  });
});

describe("endLabelNudges", () => {
  it("leaves a line alone when nothing finished level with it", () => {
    expect(endLabelNudges([30, 24, 11])).toEqual([0, 0, 0]);
  });

  it("stacks the numbers of lines that end on the same total", () => {
    // A tie is the season most worth looking at, and two numbers printed in one
    // place is a smudge rather than a result.
    const [first, second, third] = endLabelNudges([24, 24, 24]);
    expect(first).toBe(0);
    expect(second).toBeGreaterThan(0);
    expect(third).toBeGreaterThan(second ?? 0);
  });

  it("counts each total's stack separately", () => {
    // Two ties at different heights are two stacks, not one of four.
    const [first, second, third, fourth] = endLabelNudges([24, 18, 24, 18]);
    expect([first, second]).toEqual([0, 0]);
    expect(third).toBeGreaterThan(0);
    expect(fourth).toBe(third);
  });
});

describe("legendColumns", () => {
  it("puts three names across a row", () => {
    // Six of unequal length wrapped five-and-one before this, which reads as a
    // mistake rather than as a legend.
    expect(legendColumns(6)).toBe(3);
    expect(legendColumns(3)).toBe(3);
    expect(legendColumns(5)).toBe(3);
  });

  it("drops to two rather than strand one name on the last row", () => {
    expect(legendColumns(4)).toBe(2);
  });

  it("still uses a full row for a legend that fits in one", () => {
    expect(legendColumns(1)).toBe(3);
  });
});

describe("the season summary", () => {
  it("charts both championships", () => {
    expect(summary).toContain("How the drivers’ title was won");
    expect(summary).toContain("How the constructors’ title was won");
  });

  it("draws each chart under the table it explains", () => {
    // The table says who won and the chart under it says when: one answer, and
    // a reader should not have to carry six names between the two.
    const at = (text: string) => {
      const index = summary.indexOf(text);
      expect(index, text).toBeGreaterThan(-1);
      return index;
    };
    expect(at("Drivers’ Championship")).toBeLessThan(at("How the drivers’ title was won"));
    expect(at("How the drivers’ title was won")).toBeLessThan(at("Constructors’ Championship"));
    expect(at("Constructors’ Championship")).toBeLessThan(
      at("How the constructors’ title was won"),
    );
  });

  it("leaves them off a year opened out of the roll of honour", () => {
    // There the pair of tables is itself the expansion of a row, and a chart
    // inside an expansion repeats the screen the reader just left.
    const expansion = renderToStaticMarkup(
      <Liveries year={YEAR}>
        <SeasonStandings
          season={world.season}
          calendar={SEED.calendar}
          points={world.points}
          description="Final classification."
        />
      </Liveries>,
    );
    expect(expansion).toContain("Drivers’ Championship");
    expect(expansion).not.toContain("How the drivers’ title was won");
  });

  /** The legend of one chart: everything between its heading and the next card. */
  function legend(from: string, to: string): string {
    const start = summary.indexOf(from);
    const end = summary.indexOf(to, start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    return summary.slice(start, end);
  }

  const driversLegend = legend("How the drivers’ title was won", "Constructors’ Championship");
  const teamsLegend = legend("How the constructors’ title was won", "Grid");

  it("names the top few of each table, in the order the table has them", () => {
    const drivers = championshipStandings(world.season, world.points).slice(0, TOP_DRIVERS);
    let at = 0;
    for (const standing of drivers) {
      const found = driversLegend.indexOf(driverName(standing.driverId), at);
      expect(found, standing.driverId).toBeGreaterThan(-1);
      at = found;
    }
  });

  it("puts each competitor's final total beside their name", () => {
    // The legend and the table under it are two readings of the same result
    // rows, so a total that disagreed would be a bug in one of them.
    for (const standing of constructorStandings(world.season, world.points).slice(0, TOP_TEAMS)) {
      expect(teamsLegend).toContain(`>${standing.points}</span>`);
    }
  });

  it("gives every line the colours its team is drawn in everywhere else", () => {
    for (const standing of constructorStandings(world.season, world.points).slice(0, TOP_TEAMS)) {
      const resolved = liveryFor(standing.teamId, YEAR);
      if (resolved === undefined) {
        continue;
      }
      // Through `legible`, like every other surface a team colour reaches —
      // a raw livery loses the white and near-black teams to one theme or the
      // other.
      expect(teamsLegend, standing.teamId).toContain(legible(resolved.primaryColor));
    }
  });

  it("keeps the chart's own colours out of the SVG attributes", () => {
    // `stroke="var(--…)"` is silently ignored by every browser, which shows up
    // as a chart with no lines on it. The colours travel as custom properties
    // and are applied by a CSS rule instead.
    expect(driversLegend).toContain("--series-0:");
  });
});
