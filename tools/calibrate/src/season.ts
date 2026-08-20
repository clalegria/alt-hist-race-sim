/**
 * Season viewer.
 *
 * Runs a full 14-race 1980 season and prints the round-by-round winners and the
 * final drivers' championship. The counterpart to `race.ts`: same grid, same
 * seeded determinism, one year instead of one afternoon.
 *
 *   pnpm season          # seed 1
 *   pnpm season 12       # seed 12 — same seed always gives the same season
 */

import { buildField, driversById, season1980, teamsById } from "@alt-hist/data";
import {
  championshipStandings,
  constructorStandings,
  createRng,
  simulateSeason,
} from "@alt-hist/engine";

function parseSeed(argv: readonly string[]): number {
  const raw = argv[2];
  if (raw === undefined) {
    return 1;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Seed must be an integer, received "${raw}"`);
  }
  return parsed;
}

function padRight(text: string, width: number): string {
  return text.length >= width ? text.slice(0, width) : text + " ".repeat(width - text.length);
}

function padLeft(text: string, width: number): string {
  return text.length >= width ? text : " ".repeat(width - text.length) + text;
}

function main(): void {
  const seed = parseSeed(process.argv);
  const field = buildField();
  // The calendar decides how many rounds the year has; it is also the only
  // thing that distinguishes them, since no circuit has any properties.
  const calendar = season1980.calendar;
  const season = simulateSeason(field, calendar.length, createRng(seed));
  const table = championshipStandings(season);
  const constructors = constructorStandings(season);

  const drivers = driversById();
  const teams = teamsById();
  const nameOf = (driverId: string | null): string =>
    driverId === null ? "—" : (drivers.get(driverId)?.name ?? driverId);
  const teamOf = (teamId: string): string => teams.get(teamId)?.name ?? teamId;

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
  console.log(`${season1980.year} season — ${season.races.length} races, seed ${seed}`);
  console.log("");

  console.log(
    [padLeft("RND", 4), "  ", padRight("GRAND PRIX", 32), padRight("POLE", 34), "WINNER"].join(""),
  );
  console.log("-".repeat(106));
  season.races.forEach((race, index) => {
    const round = calendar[index];
    const title = round === undefined ? `Round ${index + 1}` : `${round.name} (${round.circuit})`;
    console.log(
      [
        padLeft(String(index + 1), 4),
        "  ",
        padRight(title, 44),
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
