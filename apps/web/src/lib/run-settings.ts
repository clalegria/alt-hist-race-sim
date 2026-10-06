/**
 * Run settings: the what-ifs chosen on a setup screen, beside Randomness, and
 * fixed for the whole run.
 *
 * **Every setting's historical answer is null**, the way a null `lineup` is the
 * grid history had: "is this a what-if?" is a property of the value rather than
 * a comparison somebody has to remember to make, and an all-historical run is
 * exactly the run it was before settings existed.
 *
 * Recorded on each `World` (`settings`), so the recipe picks them up with the
 * rest of a world's inputs, and remembered between visits like Randomness. Both
 * of those read untrusted storage, so both go through `parseRunSettings`.
 *
 * Pure: no storage here (`preferences.ts` reads and writes it).
 */

import type { PointsScale } from "@alt-hist/engine";
import { PLAYABLE_SEASONS, seasonSeed } from "./seasons.js";

export interface RunSettings {
  /**
   * The points table every year is scored on, or null for each year's own.
   * Only ever one of `pointsTables()`: the reader picks an authored table,
   * never writes one.
   */
  readonly points: PointsScale | null;
}

/** Every setting on its historical answer: the run as it happened. */
export const HISTORICAL_SETTINGS: RunSettings = { points: null };

/** One line of a run's settings, as `SimulationSettings` draws it. */
export interface Setting {
  readonly name: string;
  readonly value: string;
}

/** A points table the seed data uses, and the years that used it. */
export interface PointsTable {
  readonly scale: PointsScale;
  /** "1950–1959", or "1961–1965, 1980" for a table that came back. */
  readonly years: string;
  /** The years and the values, for the picker. */
  readonly label: string;
}

/** The values alone: "25 18 15 12 10 8 6 4 2 1". */
export function pointsValues(scale: PointsScale): string {
  return scale.join(" ");
}

/** Whether two tables hand out the same points. */
export function samePoints(a: PointsScale, b: PointsScale): boolean {
  return a.length === b.length && a.every((points, index) => points === b[index]);
}

/** Years as runs of consecutive ones: [1950, 1951, 1952, 1980] → "1950–1952, 1980". */
function yearSpans(years: readonly number[]): string {
  const spans: string[] = [];
  let start = years[0];
  let end = start;
  for (const year of [...years.slice(1), undefined]) {
    if (year !== undefined && end !== undefined && year === end + 1) {
      end = year;
      continue;
    }
    if (start !== undefined && end !== undefined) {
      spans.push(start === end ? `${start}` : `${start}–${end}`);
    }
    start = year;
    end = year;
  }
  return spans.join(", ");
}

let tables: readonly PointsTable[] | null = null;

/**
 * The distinct points tables across the playable seasons, oldest first.
 *
 * Read off the seed data rather than listed, so a re-authored or newly
 * authored season's table appears here the moment it exists.
 */
export function pointsTables(): readonly PointsTable[] {
  if (tables !== null) {
    return tables;
  }
  const found: { scale: PointsScale; years: number[] }[] = [];
  for (const year of PLAYABLE_SEASONS) {
    const scale = seasonSeed(year).points;
    const known = found.find((table) => samePoints(table.scale, scale));
    if (known === undefined) {
      found.push({ scale, years: [year] });
    } else {
      known.years.push(year);
    }
  }
  tables = found.map(({ scale, years }) => {
    const span = yearSpans(years);
    return { scale, years: span, label: `${span} · ${pointsValues(scale)}` };
  });
  return tables;
}

/** The table a year was scored on: the one *Same all run* starts from. */
export function pointsTableOf(year: number): PointsTable | undefined {
  const scale = seasonSeed(year).points;
  return pointsTables().find((table) => samePoints(table.scale, scale));
}

/**
 * The settings `raw` describes, or null when it is not settings this build
 * could have produced: a missing field, or a points table that is not one of
 * the authored ones. Takes `unknown` because both callers read storage the
 * reader controls.
 */
export function parseRunSettings(raw: unknown): RunSettings | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw) || !("points" in raw)) {
    return null;
  }
  const { points } = raw;
  if (points === null) {
    return { points: null };
  }
  if (!Array.isArray(points)) {
    return null;
  }
  const table = pointsTables().find((known) => samePoints(known.scale, points));
  return table === undefined ? null : { points: table.scale };
}

/** One line per setting that is not historical, in the order the setup card lists them. */
export function whatIfsOf(settings: RunSettings): readonly Setting[] {
  return settings.points === null ? [] : [{ name: "Points", value: pointsValues(settings.points) }];
}
