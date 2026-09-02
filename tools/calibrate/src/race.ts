/**
 * Single-race viewer.
 *
 * Runs one race on the 1980 grid and prints the classification. Useful for
 * eyeballing whether a result *looks* like a race, which aggregate percentages
 * cannot tell you.
 *
 *   pnpm race          # seed 1
 *   pnpm race 7        # seed 7 — same seed always gives the same race
 *   pnpm race 7 --randomness 5   # the same race, with the dice turned up
 *   pnpm race 7 --phase end      # the same race, run as the season's finale
 *   pnpm race 7 --wet 0.8        # the same race, in a soaking
 *
 * Mid-season by default, which is what a race with no year around it is: every
 * car's development trend is worth nothing there, so this prints the same race
 * it printed before trends existed. `--phase start` / `--phase end` opt in.
 *
 * The weather is *rolled* by default, exactly as a real round rolls it, so a
 * given seed is wet or dry as the dice say. `--wet <0-1>` forces an afternoon
 * without disturbing the stream, which is what makes the two comparable.
 */

import { buildField, driversById, seasonSeed, teamIdentityIn, teamsById } from "@alt-hist/data";
import { createRng, type RaceGap, simulateRace, withRandomness } from "@alt-hist/engine";
import { parseSeed } from "./args.js";
import { padLeft, padRight } from "./format.js";
import { CALIBRATION_RATING_MODE } from "./mode.js";
import { DEFAULT_SEASON_PHASE, parsePhase, phaseLabel, phaseRound } from "./phase.js";
import { parseRandomness } from "./randomness.js";
import { parseWet, wetLabel } from "./wet.js";
import { parseYear, withoutFlags } from "./year.js";

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
  const argv = withoutFlags(process.argv);
  const year = parseYear(process.argv);
  const seed = parseSeed(argv);
  const randomness = parseRandomness(process.argv);
  // Where in the year this one afternoon is being run, which is all a car's
  // development trend has to go on. Mid-season by default, where it is worth
  // nothing and the race is exactly the race this tool always printed.
  const phase = parsePhase(process.argv);
  // Undefined lets the round roll its own sky, which is the default and the
  // honest one. A forced afternoon still lets the roll happen underneath it.
  const weather = parseWet(process.argv);
  const field = buildField(seasonSeed(year), undefined, CALIBRATION_RATING_MODE);
  const result = simulateRace(field, createRng(seed), withRandomness(randomness), {
    ...phaseRound(phase),
    ...(weather === undefined ? {} : { weather }),
  });

  const drivers = driversById();
  const teams = teamsById();
  const nameOf = (driverId: string): string => drivers.get(driverId)?.name ?? driverId;
  const teamOf = (teamId: string): string => {
    const team = teams.get(teamId);
    return team === undefined ? teamId : teamIdentityIn(team, year).name;
  };

  console.log("");
  console.log(
    `${year} grid — race seed ${seed}` +
      (phase === DEFAULT_SEASON_PHASE ? "" : ` — ${phaseLabel(phase)}`) +
      // Always stated, unlike the phase: the sky is rolled rather than chosen,
      // so "dry" is news here in a way "mid-season" is not.
      ` — ${wetLabel(result.weather)}`,
  );
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
