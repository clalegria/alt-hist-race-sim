/**
 * Headless Monte Carlo harness.
 *
 * Runs the same 1980 grid N times with seeds 1..N and prints the resulting
 * distributions. This is how the race constants get tuned — the seed ratings
 * and `RACE_CONSTANTS` are hand-authored guesses until this table says
 * otherwise.
 *
 *   pnpm calibrate            # 5000 races
 *   pnpm calibrate 20000      # more races, tighter numbers
 */

import { buildField, driversById, seasonSeed, teamIdentityIn, teamsById } from "@alt-hist/data";
import { createRng, simulateRace, withRandomness } from "@alt-hist/engine";
import { parseCount } from "./args.js";
import { padLeft, padRight, pct } from "./format.js";
import { parseRandomness } from "./randomness.js";
import { parseYear, withoutFlags } from "./year.js";

const DEFAULT_RACES = 5000;

interface TeamTally {
  teamId: string;
  name: string;
  wins: number;
  poles: number;
  retirements: number;
  mechanical: number;
  driverError: number;
  starts: number;
  nonQualifications: number;
}

interface DriverTally {
  driverId: string;
  name: string;
  teamId: string;
  wins: number;
  poles: number;
  retirements: number;
  starts: number;
  nonQualifications: number;
}

function main(): void {
  const argv = withoutFlags(process.argv);
  const year = parseYear(process.argv);
  const races = parseCount(argv[2], DEFAULT_RACES, "Race count");
  const randomness = parseRandomness(process.argv);
  const constants = withRandomness(randomness);
  const field = buildField(seasonSeed(year));
  const teams = teamsById();

  /**
   * What a team was called in the year being run. A lineage carries one name
   * per era — the team that raced as Toleman is Alpine by 2021 — so anything
   * printed has to say which year it is printing.
   */
  const teamNameOf = (teamId: string): string => {
    const team = teams.get(teamId);
    return team === undefined ? teamId : teamIdentityIn(team, year).name;
  };

  const drivers = driversById();

  const teamTallies = new Map<string, TeamTally>();
  const driverTallies = new Map<string, DriverTally>();

  for (const entrant of field) {
    if (!teamTallies.has(entrant.teamId)) {
      teamTallies.set(entrant.teamId, {
        teamId: entrant.teamId,
        name: teamNameOf(entrant.teamId),
        wins: 0,
        poles: 0,
        retirements: 0,
        mechanical: 0,
        driverError: 0,
        starts: 0,
        nonQualifications: 0,
      });
    }
    driverTallies.set(entrant.driverId, {
      driverId: entrant.driverId,
      name: drivers.get(entrant.driverId)?.name ?? entrant.driverId,
      teamId: entrant.teamId,
      wins: 0,
      poles: 0,
      retirements: 0,
      starts: 0,
      nonQualifications: 0,
    });
  }

  let totalRetirements = 0;
  let totalStarters = 0;
  const startedAt = performance.now();

  for (let seed = 1; seed <= races; seed += 1) {
    const result = simulateRace(field, createRng(seed), constants);
    totalRetirements += result.retirements;
    totalStarters += field.length - result.nonQualifiers;

    for (const entry of result.entries) {
      const team = teamTallies.get(entry.teamId);
      const driver = driverTallies.get(entry.driverId);
      if (team === undefined || driver === undefined) {
        throw new Error(`Unexpected entrant ${entry.driverId} / ${entry.teamId}`);
      }

      // Pole is a Saturday result, so it counts whether or not the car started.
      if (entry.driverId === result.poleDriverId) {
        team.poles += 1;
        driver.poles += 1;
      }

      // Everything below is a race rate, and a weekend that ended on Saturday
      // is not a start. Leaving DNQs in the denominators would read as a car
      // that keeps finishing.
      if (!entry.started) {
        team.nonQualifications += 1;
        driver.nonQualifications += 1;
        continue;
      }

      team.starts += 1;
      driver.starts += 1;
      if (entry.retired) {
        team.retirements += 1;
        driver.retirements += 1;
      }
      if (entry.mechanicalFailure) {
        team.mechanical += 1;
      }
      if (entry.driverError) {
        team.driverError += 1;
      }
      if (entry.driverId === result.winnerDriverId) {
        team.wins += 1;
        driver.wins += 1;
      }
    }
  }

  const elapsed = performance.now() - startedAt;

  console.log("");
  console.log(`${year} grid — ${races} races, seeds 1..${races}`);
  console.log(
    `${field.length} cars, ${teamTallies.size} teams, randomness ${randomness}, ${elapsed.toFixed(0)}ms`,
  );
  console.log("");

  console.log(
    [
      padRight("TEAM", 16),
      padLeft("WIN%", 7),
      padLeft("POLE%", 7),
      padLeft("DNF/RACE", 10),
      padLeft("DNF%", 7),
      padLeft("MECH%", 7),
      padLeft("ERR%", 7),
      padLeft("DNQ%", 7),
    ].join(""),
  );
  console.log("-".repeat(68));

  const rankedTeams = [...teamTallies.values()].sort(
    (a, b) => b.wins - a.wins || b.poles - a.poles,
  );
  for (const team of rankedTeams) {
    console.log(
      [
        padRight(team.name, 16),
        padLeft(pct(team.wins, races), 7),
        padLeft(pct(team.poles, races), 7),
        padLeft((team.retirements / races).toFixed(2), 10),
        padLeft(pct(team.retirements, team.starts), 7),
        padLeft(pct(team.mechanical, team.starts), 7),
        padLeft(pct(team.driverError, team.starts), 7),
        padLeft(pct(team.nonQualifications, team.starts + team.nonQualifications), 7),
      ].join(""),
    );
  }

  console.log("");
  console.log(
    [
      padRight("DRIVER", 22),
      padRight("TEAM", 16),
      padLeft("WINS", 7),
      padLeft("WIN%", 7),
      padLeft("POLE%", 7),
      padLeft("DNF%", 7),
      padLeft("DNQ%", 7),
    ].join(""),
  );
  console.log("-".repeat(73));

  const rankedDrivers = [...driverTallies.values()].sort(
    (a, b) => b.wins - a.wins || b.poles - a.poles,
  );
  for (const driver of rankedDrivers) {
    console.log(
      [
        padRight(driver.name, 22),
        padRight(teamNameOf(driver.teamId), 16),
        padLeft(String(driver.wins), 7),
        padLeft(pct(driver.wins, races), 7),
        padLeft(pct(driver.poles, races), 7),
        padLeft(pct(driver.retirements, driver.starts), 7),
        padLeft(pct(driver.nonQualifications, races), 7),
      ].join(""),
    );
  }

  console.log("");
  const startersPerRace = totalStarters / races;
  console.log(
    `Average retirements per race: ${(totalRetirements / races).toFixed(2)} of ` +
      `${startersPerRace.toFixed(1)} starters (${pct(totalRetirements, totalStarters)}), ` +
      `from ${field.length} entries`,
  );
  console.log("");
}

main();
