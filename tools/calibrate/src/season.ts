/**
 * Season viewer.
 *
 * Runs a full 14-race 1980 season and prints the round-by-round winners and the
 * final drivers' championship. The counterpart to `race.ts`: same grid, same
 * seeded determinism, one year instead of one afternoon.
 *
 *   pnpm season          # seed 1
 *   pnpm season 12       # seed 12 — same seed always gives the same season
 *   pnpm season 12 --randomness 1  # the same season, with the dice turned down
 */

import {
  buildField,
  driversById,
  seasonConstants,
  seasonSeed,
  teamIdentityIn,
  teamsById,
} from "@alt-hist/data";
import {
  championshipStandings,
  constructorStandings,
  createRng,
  simulateSeason,
} from "@alt-hist/engine";
import { parseSeed } from "./args.js";
import { padLeft, padRight } from "./format.js";
import { CALIBRATION_RATING_MODE } from "./mode.js";
import { parseRandomness } from "./randomness.js";
import { parseYear, withoutFlags } from "./year.js";

function main(): void {
  const argv = withoutFlags(process.argv);
  const year = parseYear(process.argv);
  const authored = seasonSeed(year);
  const seed = parseSeed(argv);
  const randomness = parseRandomness(process.argv);
  const field = buildField(authored, undefined, CALIBRATION_RATING_MODE);
  // The calendar decides how many rounds the year has, and where each is held —
  // which is what the home-advantage term reads.
  const calendar = authored.calendar;
  const constants = seasonConstants(authored, randomness);
  const season = simulateSeason(field, calendar, createRng(seed), constants);
  // The year's own scale, straight off its seed file: 9-6-4-3-2-1 in 1980,
  // 25-18-15-12-10-8-6-4-2-1 in 2010.
  const table = championshipStandings(season, authored.points);
  const constructors = constructorStandings(season, authored.points);

  const drivers = driversById();
  const teams = teamsById();
  const nameOf = (driverId: string | null): string =>
    driverId === null ? "—" : (drivers.get(driverId)?.name ?? driverId);
  const teamOf = (teamId: string): string => {
    const team = teams.get(teamId);
    return team === undefined ? teamId : teamIdentityIn(team, authored.year).name;
  };

  /** "Nelson Piquet (Brabham)", from a driver id alone. */
  const teamFor = new Map(field.map((entrant) => [entrant.driverId, entrant.teamId]));
  const nameAndTeamOf = (driverId: string | null): string => {
    if (driverId === null) {
      return "—";
    }
    const teamId = teamFor.get(driverId);
    return teamId === undefined ? nameOf(driverId) : `${nameOf(driverId)} (${teamOf(teamId)})`;
  };

  console.log("");
  console.log(`${authored.year} season — ${season.races.length} races, seed ${seed}`);
  console.log("");

  console.log(
    [
      padLeft("RND", 4),
      "  ",
      // Matching the row widths below, which the header did not before the sky
      // column made the drift visible.
      padRight("GRAND PRIX", 44),
      padRight("SKY", 9),
      padRight("POLE", 33),
      "WINNER",
    ].join(""),
  );
  console.log("-".repeat(115));
  season.races.forEach((race, index) => {
    const round = calendar[index];
    const title = round === undefined ? `Round ${index + 1}` : `${round.name} (${round.circuit})`;
    console.log(
      [
        padLeft(String(index + 1), 4),
        "  ",
        padRight(title, 44),
        // Blank rather than "dry", for the reason the UI draws no dry badge: a
        // column reading "dry" twenty times down the page says nothing.
        padRight(race.weather.wet ? `wet ${Math.round(race.weather.wetness * 100)}%` : "", 9),
        padRight(nameAndTeamOf(race.poleDriverId), 33),
        nameAndTeamOf(race.winnerDriverId),
      ].join(""),
    );
  });

  console.log("");
  console.log("DRIVERS' CHAMPIONSHIP");
  console.log(
    [
      padLeft("POS", 4),
      "  ",
      padRight("DRIVER", 22),
      padRight("TEAM", 12),
      padLeft("PTS", 5),
      padLeft("WINS", 6),
      padLeft("PODS", 6),
      padLeft("POLES", 7),
      padLeft("DNF", 5),
      padLeft("DNQ", 5),
    ].join(""),
  );
  console.log("-".repeat(74));

  table.forEach((standing, index) => {
    console.log(
      [
        padLeft(String(index + 1), 4),
        "  ",
        padRight(nameOf(standing.driverId), 22),
        padRight(teamOf(standing.teamId), 12),
        padLeft(String(standing.points), 5),
        padLeft(String(standing.wins), 6),
        padLeft(String(standing.podiums), 6),
        padLeft(String(standing.poles), 7),
        padLeft(String(standing.retirements), 5),
        padLeft(String(standing.nonQualifications), 5),
      ].join(""),
    );
  });

  console.log("");
  console.log("CONSTRUCTORS' CHAMPIONSHIP");
  console.log(
    [
      padLeft("POS", 4),
      "  ",
      padRight("TEAM", 14),
      padLeft("PTS", 5),
      padLeft("WINS", 6),
      padLeft("PODS", 6),
      padLeft("POLES", 7),
      padLeft("DNF", 5),
      padLeft("DNQ", 5),
    ].join(""),
  );
  console.log("-".repeat(54));

  constructors.forEach((standing, index) => {
    console.log(
      [
        padLeft(String(index + 1), 4),
        "  ",
        padRight(teamOf(standing.teamId), 14),
        padLeft(String(standing.points), 5),
        padLeft(String(standing.wins), 6),
        padLeft(String(standing.podiums), 6),
        padLeft(String(standing.poles), 7),
        padLeft(String(standing.retirements), 5),
        padLeft(String(standing.nonQualifications), 5),
      ].join(""),
    );
  });

  const champion = table[0];
  const topTeam = constructors[0];
  console.log("");
  console.log(
    champion === undefined
      ? "No champion — nobody scored."
      : `Champion: ${nameOf(champion.driverId)} (${teamOf(champion.teamId)}), ` +
          `${champion.points} points from ${champion.wins} win${champion.wins === 1 ? "" : "s"}.`,
  );
  if (topTeam !== undefined) {
    console.log(`Constructors: ${teamOf(topTeam.teamId)}, ${topTeam.points} points.`);
  }
  console.log("");
}

main();
