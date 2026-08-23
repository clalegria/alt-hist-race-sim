/**
 * Single-race viewer.
 *
 * Runs one race on the 1980 grid and prints the classification. Useful for
 * eyeballing whether a result *looks* like a race, which aggregate percentages
 * cannot tell you.
 *
 *   pnpm race          # seed 1
 *   pnpm race 7        # seed 7 — same seed always gives the same race
 */

import { buildField, driversById, seasonSeed, teamsById } from "@alt-hist/data";
import { createRng, type RaceGap, simulateRace } from "@alt-hist/engine";
import { parseYear, withoutYear } from "./year.js";

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

/** "+5.234s", or "+1:17.230s" once a gap runs past the minute. */
function formatSeconds(seconds: number): string {
  // Round to milliseconds before splitting, so 59.9999s reads as +1:00.000s
  // rather than +60.000s.
  const totalMs = Math.round(seconds * 1000);
  const minutes = Math.floor(totalMs / 60000);
  const rest = (totalMs % 60000) / 1000;
  if (minutes === 0) {
    return `+${rest.toFixed(3)}s`;
  }
  return `+${minutes}:${rest.toFixed(3).padStart(6, "0")}s`;
}

/** A race gap: seconds as above, or "+2 laps" once a car is lapped. */
function formatGap(gap: RaceGap): string {
  if (gap.kind === "laps") {
    return `+${gap.laps} lap${gap.laps === 1 ? "" : "s"}`;
  }
  return formatSeconds(gap.seconds);
}

function main(): void {
  const argv = withoutYear(process.argv);
  const year = parseYear(process.argv);
  const seed = parseSeed(argv);
  const field = buildField(seasonSeed(year));
  const result = simulateRace(field, createRng(seed));

  const drivers = driversById();
  const teams = teamsById();
  const nameOf = (driverId: string): string => drivers.get(driverId)?.name ?? driverId;
  const teamOf = (teamId: string): string => teams.get(teamId)?.name ?? teamId;

  console.log("");
  console.log(`${year} grid — race seed ${seed}`);
  console.log(`Pole: ${nameOf(result.poleDriverId)}`);
  console.log(
    `Winner: ${result.winnerDriverId === null ? "none — every car retired" : nameOf(result.winnerDriverId)}`,
  );
  console.log("");

  console.log("QUALIFYING");
  console.log(
    [padLeft("POS", 4), "  ", padRight("DRIVER", 22), padRight("TEAM", 12), "GAP"].join(""),
  );
  console.log("-".repeat(52));

  const qualifying = [...result.entries].sort((a, b) => a.gridPosition - b.gridPosition);
  for (const entry of qualifying) {
    const gap =
      entry.gridPosition === 1 ? "pole position" : formatSeconds(entry.qualifyingGapToPole);
    console.log(
      [
        padLeft(String(entry.gridPosition), 4),
        "  ",
        padRight(nameOf(entry.driverId), 22),
        padRight(teamOf(entry.teamId), 12),
        entry.started ? gap : `${gap}  DNQ`,
      ].join(""),
    );
  }

  console.log("");
  console.log("RACE");
  console.log(
    [
      padLeft("POS", 4),
      "  ",
      padRight("DRIVER", 22),
      padRight("TEAM", 12),
      padLeft("GRID", 5),
      "  ",
      padRight("GAP", 12),
      "STATUS",
    ].join(""),
  );
  console.log("-".repeat(72));

  const classified = result.entries
    .filter((entry) => entry.started && !entry.retired)
    .sort((a, b) => (a.finishPosition ?? 0) - (b.finishPosition ?? 0));

  for (const entry of classified) {
    console.log(
      [
        padLeft(String(entry.finishPosition), 4),
        "  ",
        padRight(nameOf(entry.driverId), 22),
        padRight(teamOf(entry.teamId), 12),
        padLeft(String(entry.gridPosition), 5),
        "  ",
        padRight(
          entry.finishPosition === 1
            ? "winner"
            : entry.raceGapToWinner === null
              ? ""
              : formatGap(entry.raceGapToWinner),
          12,
        ),
        "Finished",
      ].join(""),
    );
  }

  const retired = result.entries
    .filter((entry) => entry.started && entry.retired)
    .sort((a, b) => a.gridPosition - b.gridPosition);

  for (const entry of retired) {
    const cause = entry.dnfCause === "mechanical" ? "DNF — mechanical" : "DNF — driver error";
    console.log(
      [
        padLeft("-", 4),
        "  ",
        padRight(nameOf(entry.driverId), 22),
        padRight(teamOf(entry.teamId), 12),
        padLeft(String(entry.gridPosition), 5),
        "  ",
        padRight("", 12),
        cause,
      ].join(""),
    );
  }

  const nonQualifiers = result.entries
    .filter((entry) => !entry.started)
    .sort((a, b) => a.gridPosition - b.gridPosition);

  for (const entry of nonQualifiers) {
    console.log(
      [
        padLeft("-", 4),
        "  ",
        padRight(nameOf(entry.driverId), 22),
        padRight(teamOf(entry.teamId), 12),
        padLeft(String(entry.gridPosition), 5),
        "  ",
        padRight("", 12),
        "DNQ",
      ].join(""),
    );
  }

  const starters = field.length - result.nonQualifiers;
  console.log("");
  console.log(
    `${result.classifiedCount} classified, ${result.retirements} retired of ${starters} starters` +
      (result.nonQualifiers === 0
        ? ""
        : `, ${result.nonQualifiers} DNQ of ${field.length} entries`),
  );
  console.log("");
}

main();
