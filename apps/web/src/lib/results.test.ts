/**
 * Slicing a season's results by competitor.
 *
 * Two halves, deliberately. The properties that must hold for *any* season run
 * against the seeded world — every round accounted for, the points agreeing
 * with the championship the engine derives — and the shapes the seed data does
 * not contain, which are built by hand: a team running one car, and a team
 * running three.
 */

import {
  championshipStandings,
  constructorStandings,
  DRY,
  type RaceEntryResult,
  type RaceResult,
  type SeasonResult,
} from "@alt-hist/engine";
import { describe, expect, it } from "vitest";
import { seededWorld } from "../test-support.js";
import { byClassification, driverRounds, pointsFor, statusOf, teamRounds } from "./results.js";

const world = seededWorld();
const season = world.season;
/** The scale the seeded world was scored on. Its year's, not a fixed one. */
const points = world.points;

/** A result row with everything defaulted, so a case states only what it means. */
function entryOf(over: Partial<RaceEntryResult> & Pick<RaceEntryResult, "driverId">) {
  return {
    teamId: "team",
    gridPosition: 1,
    started: true,
    finishPosition: null,
    retired: false,
    dnfCause: null,
    mechanicalFailure: false,
    driverError: false,
    qualifyingScore: 0,
    raceScore: null,
    qualifyingGapToPole: 0,
    raceGapToWinner: null,
    ...over,
  } satisfies RaceEntryResult;
}

function raceOf(entries: readonly RaceEntryResult[]): RaceResult {
  const classified = entries.filter((entry) => entry.finishPosition !== null);
  return {
    entries,
    poleDriverId: entries[0]?.driverId ?? "",
    winnerDriverId: entries.find((entry) => entry.finishPosition === 1)?.driverId ?? null,
    retirements: entries.filter((entry) => entry.retired).length,
    classifiedCount: classified.length,
    nonQualifiers: entries.filter((entry) => !entry.started).length,
    weather: DRY,
  };
}

describe("classification order", () => {
  it("puts finishers by position, then retirements and non-qualifiers by grid", () => {
    const winner = entryOf({ driverId: "winner", gridPosition: 4, finishPosition: 1 });
    const second = entryOf({ driverId: "second", gridPosition: 1, finishPosition: 2 });
    const retiredEarly = entryOf({
      driverId: "retired-front",
      gridPosition: 2,
      retired: true,
      dnfCause: "mechanical",
      mechanicalFailure: true,
    });
    const retiredBack = entryOf({
      driverId: "retired-back",
      gridPosition: 9,
      retired: true,
      dnfCause: "driver-error",
      driverError: true,
    });
    const dnq = entryOf({ driverId: "dnq", gridPosition: 27, started: false });

    const order = [dnq, retiredBack, second, retiredEarly, winner]
      .sort(byClassification)
      .map((entry) => entry.driverId);

    expect(order).toEqual(["winner", "second", "retired-front", "retired-back", "dnq"]);
  });

  it("does not drop a car it cannot place", () => {
    // Nothing produces a started, unretired car with no finishing position
    // today. If something ever does, it belongs at the foot of the sheet rather
    // than missing from it — a classification that silently loses a car is the
    // worst of the three outcomes.
    const odd = entryOf({ driverId: "odd", gridPosition: 3 });
    const finisher = entryOf({ driverId: "finisher", gridPosition: 8, finishPosition: 1 });
    expect([odd, finisher].sort(byClassification).map((entry) => entry.driverId)).toEqual([
      "finisher",
      "odd",
    ]);
  });
});

describe("what a row is worth", () => {
  it("pays a finish and pays nothing for a retirement or a non-start", () => {
    expect(pointsFor(entryOf({ driverId: "a", finishPosition: 1 }), points)).toBeGreaterThan(0);
    expect(pointsFor(entryOf({ driverId: "a", retired: true }), points)).toBe(0);
    expect(pointsFor(entryOf({ driverId: "a", started: false }), points)).toBe(0);
  });

  it("names why a car is not in the results", () => {
    expect(statusOf(entryOf({ driverId: "a", finishPosition: 3 }))).toBe("Finished");
    expect(statusOf(entryOf({ driverId: "a", started: false }))).toContain("Did not qualify");
    expect(statusOf(entryOf({ driverId: "a", retired: true, dnfCause: "mechanical" }))).toContain(
      "mechanical",
    );
    expect(statusOf(entryOf({ driverId: "a", retired: true, dnfCause: "driver-error" }))).toContain(
      "driver error",
    );
  });
});

describe("a driver's season", () => {
  const someone = world.field[0]?.driverId ?? "";

  it("has a row for every round they entered, in order", () => {
    const rounds = driverRounds(season, points, someone);
    // Counted off the season rather than written down: the calendar grows.
    expect(rounds).toHaveLength(season.races.length);
    expect(rounds.map((round) => round.round)).toEqual(season.races.map((_race, index) => index));
    for (const round of rounds) {
      expect(round.entry.driverId).toBe(someone);
    }
  });

  it("adds up to the points the championship credits them with", () => {
    // The link that matters: this is a different walk over the same rows, so if
    // it ever disagrees with the derived table, one of the two is wrong.
    for (const standing of championshipStandings(season, points)) {
      const total = driverRounds(season, points, standing.driverId).reduce(
        (sum, round) => sum + round.points,
        0,
      );
      expect(total, `points for ${standing.driverId}`).toBe(standing.points);
    }
  });

  it("leaves out the rounds a driver was not entered for", () => {
    const partial: SeasonResult = {
      races: [
        raceOf([entryOf({ driverId: "a", finishPosition: 1 })]),
        raceOf([entryOf({ driverId: "b", finishPosition: 1 })]),
        raceOf([entryOf({ driverId: "a", finishPosition: 2 })]),
      ],
    };
    // Rounds 1 and 3, keeping their real numbers so the gap is visible.
    expect(driverRounds(partial, points, "a").map((round) => round.round)).toEqual([0, 2]);
  });
});

describe("a team's season", () => {
  const someTeam = world.field[0]?.teamId ?? "";

  it("has a row per car, not per round", () => {
    const rows = teamRounds(season, points, someTeam);
    const cars = season.races.reduce(
      (count, race) => count + race.entries.filter((entry) => entry.teamId === someTeam).length,
      0,
    );
    expect(rows).toHaveLength(cars);
    for (const row of rows) {
      expect(row.entry.teamId).toBe(someTeam);
    }
  });

  it("adds up to the points the constructors' table credits them with", () => {
    for (const standing of constructorStandings(season, points)) {
      const total = teamRounds(season, points, standing.teamId).reduce(
        (sum, round) => sum + round.points,
        0,
      );
      expect(total, `points for ${standing.teamId}`).toBe(standing.points);
    }
  });

  it("copes with a one-car entry and with a three-car entry", () => {
    // No season in the data does either, which is exactly why this is built by
    // hand: the row-per-car shape has to survive a team that enters whatever it
    // feels like, because eras before 1980 routinely did.
    const three: SeasonResult = {
      races: [
        raceOf([entryOf({ driverId: "solo", teamId: "big", gridPosition: 5, finishPosition: 4 })]),
        raceOf([
          entryOf({ driverId: "third", teamId: "big", gridPosition: 3, finishPosition: 6 }),
          entryOf({ driverId: "first", teamId: "big", gridPosition: 7, finishPosition: 1 }),
          entryOf({
            driverId: "second",
            teamId: "big",
            gridPosition: 2,
            retired: true,
            dnfCause: "mechanical",
            mechanicalFailure: true,
          }),
        ]),
      ],
    };
    const rows = teamRounds(three, points, "big");

    expect(rows.map((row) => row.round)).toEqual([0, 1, 1, 1]);
    expect(rows).toHaveLength(4);
  });

  it("keeps a team's cars in one order, whatever each race did", () => {
    // The point of the rule: a reader following one driver down the panel must
    // not have to find the name again on every line. In round two the team-mate
    // is the one on the sheet and the leader is out of the race, and the panel
    // still lists the leader first.
    const swapped: SeasonResult = {
      races: [
        raceOf([
          entryOf({ driverId: "star", teamId: "us", gridPosition: 1, finishPosition: 1 }),
          entryOf({ driverId: "mate", teamId: "us", gridPosition: 2, finishPosition: 10 }),
        ]),
        raceOf([
          entryOf({ driverId: "mate", teamId: "us", gridPosition: 4, finishPosition: 4 }),
          entryOf({
            driverId: "star",
            teamId: "us",
            gridPosition: 1,
            retired: true,
            dnfCause: "mechanical",
            mechanicalFailure: true,
          }),
        ]),
      ],
    };
    const [champion] = championshipStandings(swapped, points);
    expect(champion?.driverId).toBe("star");

    // Round two put "mate" first on the sheet and "star" out of the race, and
    // the panel still lists them the way the championship does.
    expect(teamRounds(swapped, points, "us").map((row) => row.entry.driverId)).toEqual([
      "star",
      "mate",
      "star",
      "mate",
    ]);
  });

  it("keeps that order across every round of a real season", () => {
    // The same rule as a property, over whatever the seed produced: each round
    // is the season-long order with the absent cars taken out.
    const order = championshipStandings(season, points).map((standing) => standing.driverId);
    for (const teamId of new Set(world.field.map((entrant) => entrant.teamId))) {
      const rows = teamRounds(season, points, teamId);
      const byRound = new Map<number, string[]>();
      for (const row of rows) {
        byRound.set(row.round, [...(byRound.get(row.round) ?? []), row.entry.driverId]);
      }
      for (const [round, drivers] of byRound) {
        const expected = order.filter((driverId) => drivers.includes(driverId));
        expect(drivers, `${teamId} in round ${round + 1}`).toEqual(expected);
      }
    }
  });

  it("does not count a rival's car towards a team", () => {
    const shared: SeasonResult = {
      races: [
        raceOf([
          entryOf({ driverId: "ours", teamId: "us", finishPosition: 1 }),
          entryOf({ driverId: "theirs", teamId: "them", gridPosition: 2, finishPosition: 2 }),
        ]),
      ],
    };
    expect(teamRounds(shared, points, "us").map((row) => row.entry.driverId)).toEqual(["ours"]);
  });
});
