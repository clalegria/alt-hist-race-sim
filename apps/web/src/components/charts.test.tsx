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

import { authoredSeasons } from "@alt-hist/data";
import { championshipStandings, constructorStandings } from "@alt-hist/engine";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { driversEvolution, TOP_DRIVERS, TOP_TEAMS, teamsEvolution } from "../lib/evolution.js";
import { legible, liveryFor } from "../lib/livery.js";
import { driverName } from "../lib/names.js";
import { oklab, pickingOrder, type SeriesColour, seriesColours } from "../lib/series-colours.js";
import type { World } from "../store/season.js";
import { findWorld, SEED, seededWorld, shownAt, textOf, YEAR } from "../test-support.js";
import { Liveries } from "./Liveries.js";
import { SeasonOverview } from "./SeasonOverview.js";
import { SeasonStandings } from "./SeasonStandings.js";
import { SeasonView } from "./SeasonView.js";
import { dashGradient, legendColumns, plotSeries } from "./StandingsEvolution.js";

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

/** A team's picked colour, synthetic. */
function picked(hex: string): SeriesColour {
  return { css: hex, lab: oklab(hex) };
}

describe("plotSeries", () => {
  it("draws every car in its own team's colours", () => {
    // Colour follows the entity, never its position: a driver does not change
    // colour for finishing second.
    const colours: Record<string, SeriesColour> = {
      one: picked("#FFFFFF"),
      two: picked("#CC0000"),
    };
    const lines = plotSeries(
      [series("a", "one"), series("b", "two")],
      (key) => key,
      (teamId) => colours[teamId],
    );
    expect(lines.map((line) => line.colour)).toEqual([legible("#FFFFFF"), legible("#CC0000")]);
    expect(lines.map((line) => line.name)).toEqual(["a", "b"]);
  });

  it("dashes a team-mate rather than recolouring them", () => {
    // Team-mates in the top six is the ordinary case — 1950 puts three Alfas in
    // the first three places — and drawn plainly they would be one line traced
    // three times. Each car of a team takes a *different* dash, so the third
    // is not a copy of the second.
    const colours: Record<string, SeriesColour> = {
      one: picked("#FFFFFF"),
      two: picked("#CC0000"),
    };
    const lines = plotSeries(
      [series("a", "one"), series("b", "one"), series("c", "one"), series("d", "two")],
      (key) => key,
      (teamId) => colours[teamId],
    );
    const [first, second, third, other] = lines;
    expect(new Set([first, second, third].map((line) => line?.colour)).size).toBe(1);
    expect(first?.dash).toBe("");
    expect(second?.dash).not.toBe("");
    expect(third?.dash).not.toBe(second?.dash);
    // A different team starts over: it is the colour that separates them.
    expect(other?.dash).toBe("");
  });

  it("never dashes a car for another team's colours", () => {
    // Dashes say "team-mate". Two teams left in one colour stay solid, and the
    // number at each line's end tells them apart.
    const lines = plotSeries(
      [series("a", "one"), series("b", "two")],
      (key) => key,
      () => picked("#FFFFFF"),
    );
    expect(lines.map((line) => line.dash)).toEqual(["", ""]);
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

  it("says how the titles stand, not how they were won, before the season is over", () => {
    // Mid-season nobody has won anything yet.
    const midSeason = renderToStaticMarkup(
      <Liveries year={YEAR}>
        <SeasonOverview
          {...shownAt(world, { kind: "race", round: world.season.races.length - 1 })}
          finished={false}
          tab="standings"
        />
      </Liveries>,
    );
    expect(midSeason).toContain("How the drivers’ title race stands");
    expect(midSeason).toContain("How the constructors’ title race stands");
    expect(midSeason).not.toContain("title was won");
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
          label="Final"
        />
      </Liveries>,
    );
    expect(expansion).toContain("Drivers’ Championship");
    expect(expansion).not.toContain("How the drivers’ title was won");
  });

  /** The legend of one chart: everything between its heading and the next card, or the end. */
  function legend(from: string, to?: string): string {
    const start = summary.indexOf(from);
    const end = to === undefined ? summary.length : summary.indexOf(to, start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    return summary.slice(start, end);
  }

  const driversLegend = legend("How the drivers’ title was won", "Constructors’ Championship");
  // The last thing on the standings tab.
  const teamsLegend = legend("How the constructors’ title was won");

  it("names the top few of each table, in the order the table has them", () => {
    const drivers = championshipStandings(world.season, world.points).slice(0, TOP_DRIVERS);
    const text = textOf(driversLegend);
    let at = 0;
    for (const standing of drivers) {
      const found = text.indexOf(driverName(standing.driverId), at);
      expect(found, standing.driverId).toBeGreaterThan(-1);
      at = found;
    }
  });

  it("flies a flag beside every name, drivers and teams alike", () => {
    // Counted in the list itself: the chart above it draws no SVG here, and the
    // legend's swatches are CSS, so every `<svg>` is a flag.
    const flags = (html: string) => html.slice(html.indexOf("<ul")).split("<svg").length - 1;
    const drivers = championshipStandings(world.season, world.points).slice(0, TOP_DRIVERS);
    expect(flags(driversLegend)).toBe(drivers.length);
    const teams = constructorStandings(world.season, world.points).slice(0, TOP_TEAMS);
    expect(flags(teamsLegend)).toBe(teams.length);
  });

  it("puts each competitor's final total beside their name", () => {
    // The legend and the table under it are two readings of the same result
    // rows, so a total that disagreed would be a bug in one of them.
    for (const standing of constructorStandings(world.season, world.points).slice(0, TOP_TEAMS)) {
      expect(teamsLegend).toContain(`>${standing.points}</span>`);
    }
  });

  it("draws every line in a colour out of its team's own livery", () => {
    const items = teamsLegend.slice(teamsLegend.indexOf("<ul")).split("<li").slice(1);
    const standings = constructorStandings(world.season, world.points).slice(0, TOP_TEAMS);
    expect(items).toHaveLength(standings.length);
    standings.forEach((standing, index) => {
      const resolved = liveryFor(standing.teamId, YEAR);
      if (resolved === undefined) {
        return;
      }
      // Through `legible`, like every other surface a team colour reaches —
      // a raw livery loses the white and near-black teams to one theme or the
      // other. Which of the team's colours is `seriesColours`' call.
      const item = items[index] ?? "";
      expect(item, standing.teamId).toContain("color-mix(in oklab, ");
      const own = [resolved.primaryColor, resolved.secondaryColor1, resolved.secondaryColor2];
      expect(
        own.some((hex) => item.includes(hex)),
        standing.teamId,
      ).toBe(true);
    });
  });

  it("draws a team in one colour on both charts", () => {
    // Searched for: a season where picking each chart's colours on its own
    // would draw a team on both charts in two colours. Most seasons agree
    // either way, and those would let a per-chart pick pass unnoticed.
    const differs = (candidate: World) => {
      const drivers = driversEvolution(candidate.season, candidate.points);
      const teams = teamsEvolution(candidate.season, candidate.points);
      const css = (order: string[]) => {
        const picks = seriesColours(order.map((teamId) => liveryFor(teamId, candidate.year)));
        return new Map(order.map((teamId, index) => [teamId, picks[index]?.css]));
      };
      const driversAlone = css(pickingOrder(drivers, []));
      const teamsAlone = css(pickingOrder([], teams));
      return [...teamsAlone].some(
        ([teamId, colour]) => driversAlone.has(teamId) && driversAlone.get(teamId) !== colour,
      );
    };
    const found = authoredSeasons
      .map((year) => {
        try {
          return findWorld(differs, { seeds: 5, year });
        } catch {
          return undefined;
        }
      })
      .find((candidate) => candidate !== undefined);
    expect(found).toBeDefined();
    if (found === undefined) {
      return;
    }
    const html = renderToStaticMarkup(
      <Liveries year={found.year}>
        <SeasonView {...shownAt(found, { kind: "summary" })} />
      </Liveries>,
    );
    const section = (from: string, to?: string) =>
      html.slice(html.indexOf(from), to === undefined ? undefined : html.indexOf(to));
    /** Each legend row's mark, in legend order. */
    const marks = (legendHtml: string) =>
      legendHtml
        .slice(legendHtml.indexOf("<ul"))
        .split("<li")
        .slice(1)
        .map((item) => item.match(/style="background:([^"]*)"/)?.[1]);
    const driverMarks = marks(
      section("How the drivers’ title was won", "Constructors’ Championship"),
    );
    const teamMarks = marks(section("How the constructors’ title was won"));
    const driverTeams = driversEvolution(found.season, found.points).map((line) => line.teamId);
    const teamIds = teamsEvolution(found.season, found.points).map((line) => line.teamId);
    let compared = 0;
    teamIds.forEach((teamId, index) => {
      // A team's first car in the drivers' legend is its solid line: its plain colour.
      const first = driverTeams.indexOf(teamId);
      if (first === -1) {
        return;
      }
      expect(driverMarks[first], teamId).toBe(teamMarks[index]);
      compared++;
    });
    expect(compared).toBeGreaterThan(0);
  });

  it("keeps the chart's own colours out of the SVG attributes", () => {
    // `stroke="var(--…)"` is silently ignored by every browser, which shows up
    // as a chart with no lines on it. The colours travel as custom properties
    // and are applied by a CSS rule instead.
    expect(driversLegend).toContain("--series-0:");
  });
});
