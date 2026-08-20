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

import { driversById, teamsById } from "@alt-hist/data";
import { createRng, simulateRace } from "@alt-hist/engine";
import { buildField } from "./buildField.js";

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
  const result = simulateRace(field, createRng(seed));

  const drivers = driversById();
  const teams = teamsById();
  const nameOf = (driverId: string): string => drivers.get(driverId)?.name ?? driverId;
  const teamOf = (teamId: string): string => teams.get(teamId)?.name ?? teamId;

  console.log("");
  console.log(`1980 grid — race seed ${seed}`);
  console.log(`Pole: ${nameOf(result.poleDriverId)}`);
  console.log(
    `Winner: ${result.winnerDriverId === null ? "none — every car retired" : nameOf(result.winnerDriverId)}`,
  );
  console.log("");

  console.log(
    [
      padLeft("POS", 4),
      "  ",
      padRight("DRIVER", 22),
      padRight("TEAM", 12),
      padLeft("GRID", 5),
      "  STATUS",
    ].join(""),
  );
  console.log("-".repeat(60));

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
        "  Finished",
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
        `  ${cause}`,
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
        "  DNQ",
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
