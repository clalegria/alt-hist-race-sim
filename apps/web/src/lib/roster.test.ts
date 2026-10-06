/**
 * Who is in the run, what a people URL may show, and how an index is ordered.
 *
 * Runs are built straight from worlds, so any beat can be the cursor. Nothing
 * asserts who drove or what they scored: the roster is checked against the
 * fields it was read from, the gate against the cursor, and the order against
 * synthetic rows.
 */

import { describe, expect, it } from "vitest";
import type { Run } from "../store/season.js";
import { seededWorld, YEAR } from "../test-support.js";
import { careerRecords } from "./records.js";
import { revealed } from "./reveal.js";
import { type IndexRow, indexRows, indexSearch, rosterOf, sortIndex } from "./roster.js";
import {
  driverLink,
  driversLink,
  parseId,
  type RosterPage,
  resolveRosterPage,
  rosterPageOf,
  teamsLink,
} from "./roster-places.js";
import { linkTo } from "./run-places.js";
import { PLAYABLE_SEASONS } from "./seasons.js";
import type { Beat } from "./timeline.js";

const first = seededWorld(3, "aged", YEAR);
const second = seededWorld(4, "aged", YEAR + 1);
const ROUNDS = second.season.races.length;

/** An era in its second year, the first crowned behind it. */
function era(cursor: Beat): Run {
  return { kind: "era", run: { startYear: YEAR, seasons: [first] }, world: second, cursor };
}

/** Every beat of a season with `rounds` rounds, grid to summary. */
function beatsOf(rounds: number): Beat[] {
  const beats: Beat[] = [{ kind: "grid" }];
  for (let round = 0; round < rounds; round += 1) {
    beats.push({ kind: "qualifying", round }, { kind: "race", round });
  }
  beats.push({ kind: "summary" });
  return beats;
}

/** A driver on a later year's grid and on neither of the era's two — searched for, not named. */
function laterDriver(): string {
  const known = new Set([...first.field, ...second.field].map((entrant) => entrant.driverId));
  for (const year of PLAYABLE_SEASONS.filter((each) => each > YEAR + 1)) {
    const found = seededWorld(5, "aged", year).field.find(
      (entrant) => !known.has(entrant.driverId),
    );
    if (found !== undefined) {
      return found.driverId;
    }
  }
  throw new Error("No later season brings in a new driver");
}

describe("the roster", () => {
  it("is everyone in the field of every year reached, at every beat", () => {
    for (const beat of [...beatsOf(ROUNDS), { kind: "review" } as const]) {
      const roster = rosterOf(revealed(era(beat)).years);
      const expected = new Set([...first.field, ...second.field].map((each) => each.driverId));
      expect(new Set(roster.drivers.keys()), JSON.stringify(beat)).toEqual(expected);
      const teams = new Set([...first.field, ...second.field].map((each) => each.teamId));
      expect(new Set(roster.teams.keys())).toEqual(teams);
    }
  });

  it("counts a season once for each year on the grid, earliest first", () => {
    const roster = rosterOf([second, first]);
    for (const [driverId, years] of roster.drivers) {
      const expected = [first, second]
        .filter((world) => world.field.some((entrant) => entrant.driverId === driverId))
        .map((world) => world.year);
      expect(years.map((each) => each.year)).toEqual(expected);
    }
    for (const [teamId, years] of roster.teams) {
      for (const { year, driverIds } of years) {
        const world = year === first.year ? first : second;
        expect(driverIds).toEqual(
          world.field.filter((each) => each.teamId === teamId).map((each) => each.driverId),
        );
      }
    }
  });

  it("lists someone on the grid who has not raced, with nothing scored", () => {
    // The grid beat: the second year is reached, none of it raced.
    const years = revealed(era({ kind: "grid" })).years;
    const rows = indexRows(rosterOf(years).drivers, careerRecords(years).drivers);
    const newcomers = second.field
      .map((entrant) => entrant.driverId)
      .filter((driverId) => !first.field.some((entrant) => entrant.driverId === driverId));
    for (const driverId of newcomers) {
      const row = rows.find((each) => each.id === driverId);
      expect(row?.seasons).toBe(1);
      expect([row?.titles, row?.wins, row?.podiums, row?.poles, row?.points]).toEqual([
        0, 0, 0, 0, 0,
      ]);
    }
  });
});

describe("a people page's URL", () => {
  const pages: readonly RosterPage[] = ["drivers", "teams", "driver", "team"];

  it("shows anyone on the roster, at every beat", () => {
    for (const beat of beatsOf(ROUNDS)) {
      const run = era(beat);
      for (const entrant of [...first.field, ...second.field]) {
        const driver = resolveRosterPage(run, "driver", entrant.driverId);
        expect(driver.kind === "roster" && driver.location.id).toBe(entrant.driverId);
        const team = resolveRosterPage(run, "team", entrant.teamId);
        expect(team.kind === "roster" && team.location.id).toBe(entrant.teamId);
      }
      expect(resolveRosterPage(run, "drivers").kind).toBe("roster");
      expect(resolveRosterPage(run, "teams").kind).toBe("roster");
    }
  });

  it("sends a stranger, a typo or someone only on a grid ahead to the index", () => {
    const run = era({ kind: "race", round: 0 });
    for (const id of [laterDriver(), "nobody_at_all", "Piquet", "../x", "", undefined]) {
      expect(resolveRosterPage(run, "driver", id)).toEqual({ kind: "redirect", to: driversLink() });
      expect(resolveRosterPage(run, "team", id)).toEqual({ kind: "redirect", to: teamsLink() });
    }
  });

  it("sends every one to the season page in a one-year run, at every beat", () => {
    const summary = linkTo({ year: first.year, beat: { kind: "summary" } });
    const entrant = first.field[0];
    for (const cursor of beatsOf(first.season.races.length)) {
      const run: Run = { kind: "season", world: first, cursor };
      for (const [page, id] of [
        ["drivers", undefined],
        ["teams", undefined],
        ["driver", entrant?.driverId],
        ["team", entrant?.teamId],
      ] as const) {
        expect(resolveRosterPage(run, page, id), page).toEqual({ kind: "redirect", to: summary });
      }
    }
  });

  it("hands the page the years as the gate cut them", () => {
    const run = era({ kind: "race", round: 0 });
    const resolved = resolveRosterPage(run, "drivers");
    expect(resolved.kind === "roster" && resolved.years).toEqual(revealed(run).years);
  });

  it("reads an id as the seed data spells one, and nothing else", () => {
    expect(parseId("de_graffenried")).toBe("de_graffenried");
    expect(parseId("murray_d")).toBe("murray_d");
    for (const raw of ["", "Piquet", "pi quet", "piquet/1", "x".repeat(65), undefined]) {
      expect(parseId(raw), String(raw)).toBeNull();
    }
  });

  it("knows each route as its page, and no other route as one", () => {
    expect(pages.map((page) => rosterPageOf(linkPath(page)))).toEqual(pages);
    for (const other of ["/run/", "/run/$year/", "/run/$year/grid", "/"]) {
      expect(rosterPageOf(other)).toBeNull();
    }
  });

  it("leaves the default order out of the address", () => {
    expect(indexSearch({})).toEqual({});
    expect(indexSearch({ sort: "titles" })).toEqual({});
    expect(indexSearch({ sort: "wins" })).toEqual({ sort: "wins" });
    expect(indexSearch({ sort: "nonsense" })).toEqual({});
    expect(driverLink("piquet").params).toEqual({ driverId: "piquet" });
  });
});

/** The route id behind each page's link. */
function linkPath(page: RosterPage): string {
  switch (page) {
    case "drivers":
      return driversLink().to;
    case "teams":
      return teamsLink().to;
    case "driver":
      return "/run/driver/$driverId";
    case "team":
      return "/run/team/$teamId";
  }
}

describe("an index's order", () => {
  const row = (id: string, figures: Partial<IndexRow> = {}): IndexRow => ({
    id,
    seasons: 1,
    titles: 0,
    wins: 0,
    podiums: 0,
    poles: 0,
    points: 0,
    lastYear: 1980,
    names: 1,
    ...figures,
  });
  const ids = (rows: readonly IndexRow[]) => rows.map((each) => each.id);
  const name = (each: IndexRow) => each.id;

  it("puts the biggest figure first, a tie falling through the rest of the cabinet", () => {
    const rows = [
      row("a", { wins: 3 }),
      row("b", { wins: 3, podiums: 5 }),
      row("c", { wins: 5 }),
      row("d", { wins: 3, titles: 1 }),
    ];
    // Wins first, then titles before podiums: the record cards' order.
    expect(ids(sortIndex(rows, "wins", name))).toEqual(["c", "d", "b", "a"]);
  });

  it("is total: rows level on everything are in id order, however they arrive", () => {
    const rows = [row("c"), row("a"), row("b")];
    expect(ids(sortIndex(rows, "titles", name))).toEqual(["a", "b", "c"]);
    expect(ids(sortIndex([...rows].reverse(), "titles", name))).toEqual(["a", "b", "c"]);
  });

  it("keeps everyone, a career on zero included — an index lists the whole roster", () => {
    const rows = [row("a"), row("b", { poles: 2 })];
    expect(sortIndex(rows, "poles", name)).toHaveLength(rows.length);
  });

  it("sorts by name A to Z, with the id as the last word", () => {
    const rows = [row("z1"), row("a1"), row("m1")];
    expect(ids(sortIndex(rows, "name", (each) => (each.id === "z1" ? "Alpha" : "Beta")))).toEqual([
      "z1",
      "a1",
      "m1",
    ]);
  });
});
