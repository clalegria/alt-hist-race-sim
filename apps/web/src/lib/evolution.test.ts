/**
 * The championship, round by round.
 *
 * Everything the chart is built on is checked here rather than in the
 * component, because Recharts renders nothing at all without a DOM — a static
 * render of the card produces its heading, its legend and an empty container.
 * So the fold carries the tests and the component stays a thin drawing of it.
 *
 * Nothing below names a driver, a team or a number out of the seed data: the
 * assertions are that the last column of the chart *is* the final table, that
 * the running total only ever goes up, and that round one agrees with an
 * independent walk over the result rows.
 */

import { championshipStandings, constructorStandings } from "@alt-hist/engine";
import { describe, expect, it } from "vitest";
import { seededWorld } from "../test-support.js";
import {
  driversEvolution,
  evolutionRows,
  standingsEvolution,
  TOP_DRIVERS,
  TOP_TEAMS,
  teamsEvolution,
} from "./evolution.js";
import { pointsFor } from "./results.js";
import { standingKey } from "./standings.js";

const world = seededWorld();
const season = world.season;
const points = world.points;

describe("standingsEvolution", () => {
  const drivers = driversEvolution(season, points);
  const teams = teamsEvolution(season, points);

  it("draws the top few of each table, however many that is", () => {
    // Never more than asked for, never more than the table holds — a season
    // with three scoring drivers has three lines.
    expect(drivers).toHaveLength(
      Math.min(TOP_DRIVERS, championshipStandings(season, points).length),
    );
    expect(teams).toHaveLength(Math.min(TOP_TEAMS, constructorStandings(season, points).length));
  });

  it("takes the series in the order the final table has them", () => {
    const final = championshipStandings(season, points).slice(0, TOP_DRIVERS);
    expect(drivers.map((series) => series.key)).toEqual(final.map(standingKey));
  });

  it("gives every series a point for every round", () => {
    for (const series of [...drivers, ...teams]) {
      expect(series.points).toHaveLength(season.races.length);
    }
  });

  it("ends where the final table says it ends", () => {
    // The whole point of deriving both from the same result rows: the last
    // value on the chart and the number on the table row are one fact.
    const total = new Map(
      championshipStandings(season, points).map((row) => [row.driverId, row.points]),
    );
    for (const series of drivers) {
      expect(series.points.at(-1)).toBe(total.get(series.key));
    }
    const teamTotal = new Map(
      constructorStandings(season, points).map((row) => [row.teamId, row.points]),
    );
    for (const series of teams) {
      expect(series.points.at(-1)).toBe(teamTotal.get(series.key));
    }
  });

  it("never goes down", () => {
    // A cumulative total that fell would mean the fold was reading a round
    // rather than the season up to it.
    for (const series of [...drivers, ...teams]) {
      for (let round = 1; round < series.points.length; round += 1) {
        expect(series.points[round]).toBeGreaterThanOrEqual(series.points[round - 1] ?? 0);
      }
    }
  });

  it("starts each line on what its competitor scored in the opening round", () => {
    // Walked off the result rows directly, so this is an independent check of
    // the first column rather than the same call to the engine again.
    const opener = season.races[0];
    if (opener === undefined) {
      throw new Error("the seeded season has no rounds");
    }
    for (const series of drivers) {
      const scored = opener.entries
        .filter((entry) => entry.driverId === series.key)
        .reduce((total, entry) => total + pointsFor(entry, points), 0);
      expect(series.points[0]).toBe(scored);
    }
    for (const series of teams) {
      const scored = opener.entries
        .filter((entry) => entry.teamId === series.key)
        .reduce((total, entry) => total + pointsFor(entry, points), 0);
      expect(series.points[0]).toBe(scored);
    }
  });

  it("wears the colours of the team on the standings row", () => {
    const teamOf = new Map(
      championshipStandings(season, points).map((row) => [row.driverId, row.teamId]),
    );
    for (const series of drivers) {
      expect(series.teamId).toBe(teamOf.get(series.key));
    }
    // A constructor is its own livery.
    for (const series of teams) {
      expect(series.teamId).toBe(series.key);
    }
  });

  it("has nothing to draw for a season nobody has raced", () => {
    expect(standingsEvolution({ races: [] }, points, championshipStandings, TOP_DRIVERS)).toEqual(
      [],
    );
  });

  it("counts a competitor who had not yet entered as nought, not as absent", () => {
    // Every line runs the width of the chart. A season where the second round
    // is the first anyone scored still has a value at round one.
    const first = season.races[0];
    if (first === undefined) {
      throw new Error("the seeded season has no rounds");
    }
    const later = standingsEvolution(
      { races: [{ ...first, entries: [] }, ...season.races.slice(1)] },
      points,
      championshipStandings,
      TOP_DRIVERS,
    );
    for (const series of later) {
      expect(series.points[0]).toBe(0);
      expect(series.points).toHaveLength(season.races.length);
    }
  });
});

describe("evolutionRows", () => {
  const series = driversEvolution(season, points);
  const rows = evolutionRows(series);

  it("is a row per round, numbered from one", () => {
    expect(rows).toHaveLength(season.races.length);
    expect(rows.map((row) => row.round)).toEqual(season.races.map((_, index) => index + 1));
  });

  it("carries every series in every row, at the value that series holds", () => {
    for (const [round, row] of rows.entries()) {
      for (const line of series) {
        expect(row[line.key]).toBe(line.points[round]);
      }
    }
  });

  it("is empty when there is nothing to plot", () => {
    expect(evolutionRows([])).toEqual([]);
  });
});
