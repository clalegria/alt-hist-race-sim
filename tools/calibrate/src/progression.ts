/**
 * Driver progression viewer.
 *
 * Prints one driver's ageing curve season by season, from age 16 to 55, with
 * every attribute and the same overall rating the web grid shows. The curve is
 * deterministic, so this is the whole truth about a driver — there is no seed to
 * vary and no distribution to sample.
 *
 * The `Curve` column is the driver's **canonical** age: where his real age lands
 * on the population curve once `developmentSpeed` and `declineSpeed` have warped
 * the axis. It is the column to read when a career looks wrong — a 44-year-old
 * who is still quick reads as 38, and one who is finished reads as 52.
 *
 *   pnpm progression prost      # by id
 *   pnpm progression "Keke"     # or by a fragment of the name
 *   pnpm progression            # no argument: lists the pool
 */

import type { Driver } from "@alt-hist/data";
import { driverCareer, driverOverall, drivers } from "@alt-hist/data";
import {
  canonicalAge,
  type DriverRatings,
  peakWindow,
  ratingsForSeason,
  seasonDeficits,
} from "@alt-hist/engine";
import { padLeft, padRight } from "./format.js";

const FIRST_AGE = 16;
const LAST_AGE = 55;

const ATTRIBUTES = [
  ["Racing", "racing"],
  ["Qualifying", "qualifying"],
  ["Consistency", "consistency"],
  ["Adaptability", "adaptability"],
  ["Composure", "composure"],
] as const satisfies readonly (readonly [string, keyof DriverRatings])[];

/**
 * Finds a driver by exact id, then by a case-insensitive name fragment.
 *
 * An ambiguous fragment is an error rather than a silent first match — there are
 * two Fittipaldis' worth of ways to pick the wrong driver.
 */
function findDriver(query: string): Driver {
  const exact = drivers.find((driver) => driver.id === query);
  if (exact !== undefined) {
    return exact;
  }

  const needle = query.toLowerCase();
  const matches = drivers.filter(
    (driver) =>
      driver.name.toLowerCase().includes(needle) || driver.id.toLowerCase().includes(needle),
  );
  const first = matches[0];
  if (first === undefined) {
    throw new Error(`No driver matches "${query}". Run with no argument to list the pool.`);
  }
  if (matches.length > 1) {
    throw new Error(
      `"${query}" matches ${matches.length} drivers: ${matches.map((d) => d.id).join(", ")}`,
    );
  }
  return first;
}

function listPool(): void {
  console.log(`${drivers.length} drivers in the pool:\n`);
  for (const driver of drivers) {
    console.log(
      `  ${padRight(driver.id, 16)} ${padRight(driver.name, 24)} ` +
        `${driver.debutSeason}-${driver.finalSeason}, peak ${driver.peak.season}`,
    );
  }
  console.log("\n  pnpm progression <id or name fragment>");
}

/** What is happening to a driver in a season, in a few characters. */
function noteFor(driver: Driver, season: number): string {
  const window = peakWindow(driverCareer(driver));
  const notes: string[] = [];

  if (season === driver.debutSeason) {
    notes.push("rookie");
  }
  if (season === driver.peak.season) {
    notes.push("PEAK");
  } else if (season >= window.start && season <= window.end) {
    notes.push("plateau");
  }
  if (driver.stepDown !== undefined && season === driver.stepDown.season) {
    notes.push(`step down (${driver.stepDown.severity})`);
  }
  for (const off of driver.offSeasons ?? []) {
    if (off.season === season) {
      notes.push(`off form (${off.severity})`);
    }
  }
  if (season === driver.finalSeason) {
    notes.push("last season");
  }
  if (season < driver.debutSeason || season > driver.finalSeason) {
    notes.push("—");
  }

  return notes.join(", ");
}

function printProgression(driver: Driver): void {
  const career = driverCareer(driver);
  const window = peakWindow(career);

  console.log(`\n${driver.name} (${driver.id}), born ${driver.birthYear}`);
  console.log(
    `Raced ${driver.debutSeason}-${driver.finalSeason}. ` +
      `Peak ${driver.peak.season}, plateau ${window.start}-${window.end} ` +
      `(${driver.peakSeasons} season${driver.peakSeasons === 1 ? "" : "s"}). ` +
      `Development ${driver.developmentSpeed}/10, decline ${driver.declineSpeed}/10.`,
  );
  console.log(
    `Peak ratings: ${ATTRIBUTES.map(([label, key]) => `${label} ${career.peak[key]}`).join(", ")}` +
      `, overall ${driverOverall(career.peak)}.\n`,
  );

  const header =
    padLeft("Age", 4) +
    padLeft("Curve", 7) +
    padLeft("Season", 8) +
    ATTRIBUTES.map(([label]) => padLeft(label, 13)).join("") +
    padLeft("Overall", 9) +
    "  Notes";
  console.log(header);
  console.log("-".repeat(header.length));

  for (let age = FIRST_AGE; age <= LAST_AGE; age += 1) {
    const season = driver.birthYear + age;
    const ratings = ratingsForSeason(career, season);
    const deficits = seasonDeficits(career, season);
    const racing = ratings.racing;

    const row =
      padLeft(String(age), 4) +
      padLeft(canonicalAge(career, season).toFixed(1), 7) +
      padLeft(String(season), 8) +
      ATTRIBUTES.map(([, key]) => padLeft(String(ratings[key]), 13)).join("") +
      padLeft(String(driverOverall(ratings)), 9) +
      "  " +
      noteFor(driver, season);
    console.log(row);

    // A blank line where the curve changes gear, so the three phases are
    // visible without reading the numbers.
    const nextSeason = season + 1;
    const changesPhase =
      (season < window.start && nextSeason >= window.start) ||
      (season <= window.end && nextSeason > window.end);
    if (changesPhase) {
      console.log(
        padLeft("", 12) +
          `${"·".repeat(20)} ${
            nextSeason > window.end ? "decline begins" : "plateau begins"
          } (racing was ${racing}, deficits dev ${deficits.development.toFixed(3)} / decline ${deficits.decline.toFixed(3)} / form ${deficits.form.toFixed(3)})`,
      );
    }
  }
  console.log("");
}

const query = process.argv[2];
if (query === undefined) {
  listPool();
} else {
  printProgression(findDriver(query));
}
