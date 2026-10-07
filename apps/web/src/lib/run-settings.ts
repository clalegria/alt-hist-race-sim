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

import { type Driver, drivers, driversWithoutCareerEvents } from "@alt-hist/data";
import type { Breakdowns, PointsScale } from "@alt-hist/engine";
import { isPlayable, PLAYABLE_SEASONS, seasonSeed } from "./seasons.js";

/** The Breakdowns answers that are what-ifs; Realistic is null. */
export type FewerBreakdowns = Exclude<Breakdowns, "realistic">;

export interface RunSettings {
  /** How often cars break down: fewer, none, or null for as often as each year's did. */
  readonly breakdowns: FewerBreakdowns | null;
  /**
   * The season whose `retirementFactor` every year's cars break down at, or
   * null for each year's own. Driver error keeps the year's own. A playable year.
   */
  readonly reliability: number | null;
  /**
   * The points table every year is scored on, or null for each year's own.
   * Only ever one of `pointsTables()`: the reader picks an authored table,
   * never writes one.
   */
  readonly points: PointsScale | null;
  /**
   * Whether drivers have the career events authored for them — a `stepDown`,
   * `offSeasons` — or none, every career on the plain ageing curve. **Era
   * only**: `seasonSettings` drops it from a standalone season.
   */
  readonly careerEvents: "none" | null;
}

/** Every setting on its historical answer: the run as it happened. */
export const HISTORICAL_SETTINGS: RunSettings = {
  breakdowns: null,
  reliability: null,
  points: null,
  careerEvents: null,
};

/**
 * The settings that change a run: Reliability only sets how often cars break
 * down, so under Breakdowns: None it is dropped. The setup screen keeps the
 * reader's choice (greyed out) so switching back restores it; a world records
 * only what is in force.
 */
export function settingsInForce(settings: RunSettings): RunSettings {
  return settings.breakdowns === "none" && settings.reliability !== null
    ? { ...settings, reliability: null }
    : settings;
}

/**
 * The settings a standalone season runs: the era-only ones dropped. One
 * remembered set serves both setup screens, so the reader's era choice is kept
 * there while a season records only what it offers.
 */
export function seasonSettings(settings: RunSettings): RunSettings {
  return settings.careerEvents === null ? settings : { ...settings, careerEvents: null };
}

/**
 * The drivers a run's ratings come from: the pool, or the pool without career
 * events. Every data function that rates a driver takes a pool, so this is the
 * one place the setting reaches them.
 */
export function driverPoolOf(settings: RunSettings): readonly Driver[] {
  return settings.careerEvents === "none" ? driversWithoutCareerEvents() : drivers;
}

/** What the reader is shown for each Breakdowns answer. */
export const BREAKDOWNS_LABELS: Readonly<Record<Breakdowns, string>> = {
  realistic: "Realistic",
  fewer: "Fewer",
  none: "None",
};

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
 * could have produced: a missing field, a points table that is not one of the
 * authored ones, a year with no season, or a Breakdowns or Career events
 * answer that is not a what-if. Takes `unknown` because both callers read storage the reader controls.
 */
export function parseRunSettings(raw: unknown): RunSettings | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return null;
  }
  if (!("points" in raw && "breakdowns" in raw && "reliability" in raw && "careerEvents" in raw)) {
    return null;
  }
  const points = parsePoints(raw.points);
  const breakdowns = parseFewerBreakdowns(raw.breakdowns);
  const reliability = parseReliability(raw.reliability);
  const { careerEvents } = raw;
  if (
    points === undefined ||
    breakdowns === undefined ||
    reliability === undefined ||
    (careerEvents !== null && careerEvents !== "none")
  ) {
    return null;
  }
  return { breakdowns, reliability, points, careerEvents };
}

/** Each of these is the field's value, or undefined when it is not one this build offers. */
function parsePoints(points: unknown): PointsScale | null | undefined {
  if (points === null) {
    return null;
  }
  if (!Array.isArray(points)) {
    return undefined;
  }
  return pointsTables().find((known) => samePoints(known.scale, points))?.scale;
}

function parseFewerBreakdowns(breakdowns: unknown): FewerBreakdowns | null | undefined {
  return breakdowns === null || breakdowns === "fewer" || breakdowns === "none"
    ? breakdowns
    : undefined;
}

function parseReliability(year: unknown): number | null | undefined {
  if (year === null) {
    return null;
  }
  return typeof year === "number" && Number.isInteger(year) && isPlayable(year) ? year : undefined;
}

/** One line per setting that is not historical, in the order the setup card lists them. */
export function whatIfsOf(settings: RunSettings): readonly Setting[] {
  const lines: Setting[] = [];
  if (settings.breakdowns !== null) {
    lines.push({ name: "Breakdowns", value: BREAKDOWNS_LABELS[settings.breakdowns] });
  }
  if (settings.reliability !== null) {
    lines.push({ name: "Reliability", value: `as in ${settings.reliability}` });
  }
  if (settings.points !== null) {
    lines.push({ name: "Points", value: pointsValues(settings.points) });
  }
  if (settings.careerEvents !== null) {
    lines.push({ name: "Career events", value: "None" });
  }
  return lines;
}
